import { useState } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface SecurityIssue {
  severity: 'critical' | 'warning' | 'info';
  header: string;
  message: string;
  recommendation: string;
}

interface HeaderAnalysisResult {
  headers: Record<string, string>;
  issues: SecurityIssue[];
  score: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export const HTTPHeaderAnalyzer = () => {
  const { user } = useAuth();
  const [inputMode, setInputMode] = useState<'url' | 'paste'>('paste');
  const [url, setUrl] = useState('');
  const [headersText, setHeadersText] = useState('');
  const [analysis, setAnalysis] = useState<HeaderAnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const SECURITY_HEADERS = {
    'content-security-policy': {
      required: true,
      description: 'Controls which content sources are allowed',
      goodExample: "default-src 'self'; script-src 'self' trusted.com"
    },
    'x-content-type-options': {
      required: true,
      description: 'Prevents MIME type sniffing',
      goodExample: 'nosniff'
    },
    'x-frame-options': {
      required: true,
      description: 'Prevents clickjacking attacks',
      goodExample: 'DENY or SAMEORIGIN'
    },
    'strict-transport-security': {
      required: true,
      description: 'Enforces HTTPS connections',
      goodExample: 'max-age=31536000; includeSubDomains'
    },
    'x-xss-protection': {
      required: true,
      description: 'XSS protection (legacy but still useful)',
      goodExample: '1; mode=block'
    },
    'referrer-policy': {
      required: true,
      description: 'Controls referrer information',
      goodExample: 'strict-origin-when-cross-origin'
    },
    'permissions-policy': {
      required: false,
      description: 'Restricts browser features and APIs',
      goodExample: 'geolocation=(), microphone=(), camera=()'
    }
  };

  const analyzeHeaders = (headerObj: Record<string, string>): HeaderAnalysisResult => {
    const issues: SecurityIssue[] = [];
    let score = 100;

    const headerKeys = Object.keys(headerObj).map(k => k.toLowerCase());

    // Check for missing critical headers
    Object.entries(SECURITY_HEADERS).forEach(([header, config]) => {
      if (!headerKeys.includes(header)) {
        if (config.required) {
          issues.push({
            severity: 'critical',
            header: header,
            message: `Missing critical security header: ${header}`,
            recommendation: `Add "${header}: ${config.goodExample}" to your response headers. Purpose: ${config.description}`
          });
          score -= 15;
        } else {
          issues.push({
            severity: 'info',
            header: header,
            message: `Optional security header not found: ${header}`,
            recommendation: `Consider adding "${header}". Purpose: ${config.description}`
          });
          score -= 2;
        }
      }
    });

    // Check for weak CSP
    const cspHeader = headerKeys.find(k => k === 'content-security-policy');
    if (cspHeader) {
      const cspValue = headerObj[cspHeader];
      if (cspValue.includes("'unsafe-inline'") || cspValue.includes("'unsafe-eval'")) {
        issues.push({
          severity: 'warning',
          header: 'content-security-policy',
          message: "CSP contains unsafe directives that allow inline scripts/styles",
          recommendation: "Remove 'unsafe-inline' and 'unsafe-eval'. Use external stylesheets and scripts instead."
        });
        score -= 10;
      }
      if (cspValue === '*' || cspValue.includes('script-src *') || cspValue.includes("script-src 'none'")) {
        issues.push({
          severity: 'critical',
          header: 'content-security-policy',
          message: "CSP is too permissive or too restrictive",
          recommendation: "Define a whitelist of trusted sources for each directive."
        });
        score -= 10;
      }
    }

    // Check for weak HSTS
    const hstsHeader = headerKeys.find(k => k === 'strict-transport-security');
    if (hstsHeader) {
      const hstsValue = headerObj[hstsHeader];
      const maxAge = parseInt(hstsValue.match(/max-age=(\d+)/)?.[1] || '0');
      if (maxAge < 31536000) {
        issues.push({
          severity: 'warning',
          header: 'strict-transport-security',
          message: `HSTS max-age (${maxAge}s) is less than recommended (31536000s / 1 year)`,
          recommendation: "Increase max-age to at least 31536000 (1 year) and include 'includeSubDomains'."
        });
        score -= 5;
      }
      if (!hstsValue.includes('includeSubDomains')) {
        issues.push({
          severity: 'info',
          header: 'strict-transport-security',
          message: "HSTS does not include subdomains",
          recommendation: "Add 'includeSubDomains' directive to protect subdomains as well."
        });
        score -= 2;
      }
    }

    // Check for deprecated or problematic headers
    const serverHeader = headerKeys.find(k => k === 'server');
    if (serverHeader) {
      issues.push({
        severity: 'warning',
        header: 'server',
        message: "Server header reveals technology stack, creating information disclosure risk",
        recommendation: "Remove or mask the 'Server' header to avoid exposing server details."
      });
      score -= 3;
    }

    // Check for X-Powered-By
    const poweredByHeader = headerKeys.find(k => k === 'x-powered-by');
    if (poweredByHeader) {
      issues.push({
        severity: 'info',
        header: 'x-powered-by',
        message: "X-Powered-By header reveals framework/language details",
        recommendation: "Remove the 'X-Powered-By' header to reduce attack surface."
      });
      score -= 2;
    }

    // Check CORS headers
    const acaoHeader = headerKeys.find(k => k === 'access-control-allow-origin');
    if (acaoHeader) {
      const acaoValue = headerObj[acaoHeader];
      if (acaoValue === '*') {
        issues.push({
          severity: 'warning',
          header: 'access-control-allow-origin',
          message: "CORS allows any origin (*), enabling potential cross-origin attacks",
          recommendation: "Specify trusted origins instead of '*'. Example: 'https://yourdomain.com'"
        });
        score -= 5;
      }
    }

    score = Math.max(0, score);
    let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (score >= 80) riskLevel = 'low';
    else if (score >= 60) riskLevel = 'medium';
    else if (score >= 40) riskLevel = 'high';
    else riskLevel = 'critical';

    return { headers: headerObj, issues, score, riskLevel };
  };

  const parseHeadersText = (text: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    const lines = text.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        headers[key.trim()] = valueParts.join(':').trim();
      }
    });
    
    return headers;
  };

  const analyzeFromUrl = async () => {
    if (!url) return;
    setError('');
    setAnalysis(null);
    setLoading(true);

    try {
      const res = await fetch(url, { method: 'HEAD', mode: 'no-cors' }).catch(() => 
        fetch(url, { method: 'GET', mode: 'no-cors' })
      );
      
      const h: Record<string, string> = {};
      res.headers.forEach((value, key) => { h[key] = value; });
      
      if (Object.keys(h).length === 0) {
        setError('Could not retrieve headers. This may be due to CORS restrictions.');
        setLoading(false);
        return;
      }

      const result = analyzeHeaders(h);
      setAnalysis(result);

      if (user) {
        await logToolUsage(user.id, 'http-header-analyzer', url, JSON.stringify(result));
        await supabase.from('security_logs').insert({
          user_id: user.id,
          event_type: 'http_header_analyze',
          event_data: { url, riskLevel: result.riskLevel, score: result.score },
          risk_level: result.riskLevel
        });
      }
    } catch (err) {
      setError((err as Error).message || 'Header analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const analyzeFromPaste = () => {
    if (!headersText.trim()) {
      setError('Please paste HTTP headers');
      return;
    }

    try {
      const h = parseHeadersText(headersText);
      if (Object.keys(h).length === 0) {
        setError('No valid headers found. Format: Header-Name: value');
        return;
      }

      const result = analyzeHeaders(h);
      setAnalysis(result);
      setError('');

      if (user) {
        logToolUsage(user.id, 'http-header-analyzer', 'paste', JSON.stringify(result)).catch(() => {});
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to parse headers');
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-cyan-400';
    }
  };

  const getSeverityBgColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-950 border-red-700';
      case 'warning': return 'bg-yellow-950 border-yellow-700';
      case 'info': return 'bg-blue-950 border-blue-700';
      default: return 'bg-gray-800 border-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-950/50 to-gray-900/50 border border-cyan-500/50 rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-cyan-400" />
          <h3 className="text-2xl font-bold text-cyan-300">HTTP Header Security Analyzer</h3>
        </div>
        <p className="text-gray-300 text-sm">Analyze HTTP headers for security vulnerabilities, missing security headers, and best practices.</p>
      </div>

      {/* Input Mode Selection */}
      <div className="flex gap-2">
        <button
          onClick={() => setInputMode('paste')}
          className={`flex-1 py-2 px-4 rounded font-semibold transition-all ${
            inputMode === 'paste'
              ? 'bg-cyan-600 text-white border border-cyan-400'
              : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-cyan-500'
          }`}
        >
          Paste Headers
        </button>
        <button
          onClick={() => setInputMode('url')}
          className={`flex-1 py-2 px-4 rounded font-semibold transition-all ${
            inputMode === 'url'
              ? 'bg-cyan-600 text-white border border-cyan-400'
              : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-cyan-500'
          }`}
        >
          Analyze URL
        </button>
      </div>

      {/* Input Section */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        {inputMode === 'paste' ? (
          <>
            <label className="block text-cyan-300 text-sm font-semibold mb-2">Paste HTTP Headers</label>
            <textarea
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              placeholder="Content-Security-Policy: default-src 'self'&#10;X-Frame-Options: DENY&#10;Strict-Transport-Security: max-age=31536000"
              className="w-full h-40 bg-gray-900 border border-cyan-500/30 rounded p-3 text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={analyzeFromPaste}
              className="mt-3 w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded font-semibold transition-colors"
            >
              Analyze Headers
            </button>
          </>
        ) : (
          <>
            <label className="block text-cyan-300 text-sm font-semibold mb-2">Website URL</label>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && analyzeFromUrl()}
                placeholder="https://example.com"
                className="flex-1 bg-gray-900 border border-cyan-500/30 rounded p-3 text-white text-sm focus:outline-none focus:border-cyan-400"
              />
              <button
                disabled={!url || loading}
                onClick={analyzeFromUrl}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-semibold transition-colors"
              >
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-950 border border-red-700 rounded-lg p-4 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Score Summary */}
          <div className="bg-gradient-to-r from-gray-900/50 to-cyan-950/30 border border-cyan-500/30 rounded-lg p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Security Score</p>
                <div className="text-4xl font-bold">
                  <span className={getRiskLevelColor(analysis.riskLevel)}>{analysis.score}/100</span>
                </div>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Risk Level</p>
                <div className={`text-3xl font-bold ${getRiskLevelColor(analysis.riskLevel)} uppercase tracking-wider`}>
                  {analysis.riskLevel}
                </div>
              </div>
            </div>
          </div>

          {/* Issues Found */}
          {analysis.issues.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-cyan-300 font-semibold text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Security Issues Found ({analysis.issues.length})
              </h4>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {analysis.issues.map((issue, idx) => (
                  <div key={idx} className={`border rounded-lg p-4 ${getSeverityBgColor(issue.severity)}`}>
                    <div className="flex items-start gap-3">
                      {issue.severity === 'critical' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                      {issue.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />}
                      {issue.severity === 'info' && <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white capitalize mb-1">
                          {issue.severity}: {issue.header}
                        </div>
                        <p className="text-gray-200 text-sm mb-2">{issue.message}</p>
                        <div className="bg-gray-900/50 border border-gray-700 rounded p-2 text-xs text-cyan-300 font-mono">
                          <strong>Recommendation:</strong> {issue.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-green-950 border border-green-700 rounded-lg p-4 flex gap-3 items-center">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
              <p className="text-green-200 font-semibold">Excellent! No critical security issues found.</p>
            </div>
          )}

          {/* Headers Table */}
          <div className="space-y-2">
            <h4 className="text-cyan-300 font-semibold text-lg">Headers Analyzed ({Object.keys(analysis.headers).length})</h4>
            <div className="bg-gray-900 border border-cyan-500/20 rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 sticky top-0 border-b border-cyan-500/20">
                    <tr>
                      <th className="text-left p-3 text-cyan-300 font-semibold">Header Name</th>
                      <th className="text-left p-3 text-cyan-300 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analysis.headers).map(([key, value]) => (
                      <tr key={key} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                        <td className="p-3 text-cyan-400 font-mono font-semibold">{key}</td>
                        <td className="p-3 text-gray-300 font-mono break-all">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="bg-blue-950/30 border border-blue-700/30 rounded-lg p-4">
            <h4 className="text-blue-300 font-semibold mb-3 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Security Best Practices
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex gap-2"><span className="text-cyan-400">•</span> Always use HTTPS (Strict-Transport-Security)</li>
              <li className="flex gap-2"><span className="text-cyan-400">•</span> Implement a strict Content Security Policy</li>
              <li className="flex gap-2"><span className="text-cyan-400">•</span> Set X-Frame-Options to DENY or SAMEORIGIN</li>
              <li className="flex gap-2"><span className="text-cyan-400">•</span> Use X-Content-Type-Options: nosniff to prevent MIME sniffing</li>
              <li className="flex gap-2"><span className="text-cyan-400">•</span> Hide server information (remove Server header)</li>
              <li className="flex gap-2"><span className="text-cyan-400">•</span> Limit CORS headers to trusted origins only</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};