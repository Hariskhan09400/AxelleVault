import { useState } from 'react';
import { Globe, AlertTriangle, CheckCircle, Search, Shield, ExternalLink, Activity } from 'lucide-react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface VTStats {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  total: number;
}

interface VTEngine {
  engine: string;
  category: string;
  result: string;
}

interface ScanResult {
  safe: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  issues: string[];
  recommendations: string[];
  vtStats?: VTStats;
  vtEngines?: VTEngine[];
  vtPermalink?: string;
  scanSource: 'virustotal' | 'local' | 'combined';
}

export const URLScanner = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');

  // ── VirusTotal helpers ──────────────────────────────────────────────────────

  const submitURLtoVT = async (apiKey: string, targetUrl: string): Promise<string | null> => {
    const formData = new URLSearchParams();
    formData.append('url', targetUrl);

    const res = await fetch('https://www.virustotal.com/api/v3/urls', {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!res.ok) throw new Error(`VT submit failed: ${res.status}`);
    const json = await res.json();
    // Returns analysis id like "u-<hash>-<timestamp>"
    return json?.data?.id ?? null;
  };

  const pollVTAnalysis = async (apiKey: string, analysisId: string, maxWait = 20000): Promise<any> => {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 3000));
      const res = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: { 'x-apikey': apiKey },
      });
      if (!res.ok) throw new Error(`VT poll failed: ${res.status}`);
      const json = await res.json();
      const status = json?.data?.attributes?.status;
      if (status === 'completed') return json;
    }
    throw new Error('VT analysis timed out');
  };

  // ── Local heuristic checks (always run) ────────────────────────────────────

  const runLocalChecks = (urlFormatted: string, urlObj: URL): { issues: string[]; recommendations: string[] } => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const urlLower = urlFormatted.toLowerCase();

    if (urlObj.protocol !== 'https:') {
      issues.push('Not using HTTPS — connection is not encrypted');
      recommendations.push('Use HTTPS for secure connections');
    }

    const suspiciousKeywords = ['login', 'verify', 'bank', 'paypal', 'secure', 'account', 'password', 'signin', 'update', 'confirm'];
    const foundKeywords = suspiciousKeywords.filter(kw => urlLower.includes(kw));
    if (foundKeywords.length > 0) {
      issues.push(`Suspicious keywords in URL: ${foundKeywords.join(', ')}`);
      recommendations.push('Verify the URL is legitimate before entering credentials');
    }

    if (urlObj.hostname.length > 50) {
      issues.push('Unusually long domain name — possible typosquatting');
      recommendations.push('Check for typos or look-alike malicious domains');
    }

    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(urlObj.hostname)) {
      issues.push('URL uses a raw IP address instead of a domain');
      recommendations.push('Legitimate sites rarely use raw IPs — proceed with caution');
    }

    const subdomainCount = urlObj.hostname.split('.').length - 2;
    if (subdomainCount > 3) {
      issues.push('Excessive subdomains detected — possible phishing pattern');
      recommendations.push('Double-check the actual domain (last two parts before the path)');
    }

    return { issues, recommendations };
  };

  // ── Main scan function ──────────────────────────────────────────────────────

  const scanURL = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);

    const issues: string[] = [];
    const recommendations: string[] = [];
    let vtStats: VTStats | undefined;
    let vtEngines: VTEngine[] | undefined;
    let vtPermalink: string | undefined;
    let scanSource: ScanResult['scanSource'] = 'local';

    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const urlFormatted = urlObj.href;

      // 1. Local heuristics (always)
      const local = runLocalChecks(urlFormatted, urlObj);
      issues.push(...local.issues);
      recommendations.push(...local.recommendations);

      // 2. Google Safe Browsing (if key present)
      const safeBrowsingKey = import.meta.env.VITE_GOOGLE_SAFE_BROWSING_KEY;
      if (safeBrowsingKey) {
        try {
          setLoadingStep('Checking Google Safe Browsing...');
          const res = await fetch(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${safeBrowsingKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                client: { clientId: 'axellevault', clientVersion: '1.0.0' },
                threatInfo: {
                  threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
                  platformTypes: ['ANY_PLATFORM'],
                  threatEntryTypes: ['URL'],
                  threatEntries: [{ url: urlFormatted }],
                },
              }),
            }
          );
          const json = await res.json();
          if (json.matches?.length > 0) {
            const threatTypes = json.matches.map((m: any) => m.threatType).join(', ');
            issues.push(`Flagged by Google Safe Browsing: ${threatTypes}`);
            recommendations.push('Do not visit this URL — it has been flagged as harmful');
            scanSource = 'combined';
          }
        } catch (_) {
          // Safe Browsing optional — silently skip
        }
      }

      // 3. VirusTotal (if key present)
      const vtKey = import.meta.env.VITE_VIRUSTOTAL_API_KEY;
      if (vtKey) {
        try {
          setLoadingStep('Submitting to VirusTotal...');
          const analysisId = await submitURLtoVT(vtKey, urlFormatted);

          if (analysisId) {
            setLoadingStep('Waiting for VirusTotal analysis (up to 20s)...');
            const analysis = await pollVTAnalysis(vtKey, analysisId);
            const attrs = analysis?.data?.attributes;
            const stats = attrs?.stats;
            const enginesRaw = attrs?.results ?? {};

            if (stats) {
              vtStats = {
                malicious: stats.malicious ?? 0,
                suspicious: stats.suspicious ?? 0,
                harmless: stats.harmless ?? 0,
                undetected: stats.undetected ?? 0,
                total: Object.values(stats).reduce((a: number, b: any) => a + (b as number), 0) as number,
              };

              // Build engine list — only flagged ones first, then a sample of clean ones
              const flagged: VTEngine[] = [];
              const clean: VTEngine[] = [];
              for (const [engine, data] of Object.entries(enginesRaw)) {
                const d = data as any;
                const entry = { engine, category: d.category, result: d.result ?? d.category };
                if (d.category === 'malicious' || d.category === 'suspicious') flagged.push(entry);
                else clean.push(entry);
              }
              vtEngines = [...flagged, ...clean.slice(0, 5)];

              if ((vtStats.malicious ?? 0) >= 3) {
                issues.push(`VirusTotal: ${vtStats.malicious} engines flagged as malicious`);
                recommendations.push('This URL is likely dangerous — do not proceed');
              } else if ((vtStats.malicious ?? 0) >= 1 || (vtStats.suspicious ?? 0) >= 2) {
                issues.push(`VirusTotal: flagged by ${vtStats.malicious} malicious + ${vtStats.suspicious} suspicious engines`);
                recommendations.push('Treat this URL with caution');
              }
            }

            // Permalink to full VT report
            const urlId = btoa(urlFormatted).replace(/=/g, '');
            vtPermalink = `https://www.virustotal.com/gui/url/${urlId}`;
            scanSource = scanSource === 'combined' ? 'combined' : 'virustotal';
          }
        } catch (vtErr: any) {
          issues.push(`VirusTotal check failed: ${vtErr.message}`);
          recommendations.push('Add VITE_VIRUSTOTAL_API_KEY to .env for full scanning');
        }
      } else {
        recommendations.push('Add VITE_VIRUSTOTAL_API_KEY to your .env for deep threat scanning');
      }

    } catch (_) {
      issues.push('Invalid URL format');
      recommendations.push('Ensure the URL is properly formatted (e.g. https://example.com)');
    }

    // Risk level — VT malicious count takes priority
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const malCount = vtStats?.malicious ?? 0;
    if (malCount >= 3 || issues.some(i => i.toLowerCase().includes('malicious') || i.toLowerCase().includes('safe browsing'))) {
      riskLevel = 'high';
    } else if (malCount >= 1 || issues.length >= 2) {
      riskLevel = 'medium';
    } else if (issues.length >= 1) {
      riskLevel = 'medium';
    }

    const scanResult: ScanResult = {
      safe: issues.length === 0,
      riskLevel,
      issues,
      recommendations,
      vtStats,
      vtEngines,
      vtPermalink,
      scanSource,
    };

    setResult(scanResult);
    setLoadingStep('');

    // Supabase logging (same as before)
    if (user) {
      await logToolUsage(user.id, 'url-scanner', url, JSON.stringify(scanResult));
      await supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'url_scan',
        event_data: {
          url: url.toLowerCase(),
          risk_level: riskLevel,
          issues_count: issues.length,
          vt_malicious: vtStats?.malicious ?? null,
          scan_source: scanSource,
        },
        risk_level: riskLevel,
      });
    }

    setLoading(false);
  };

  // ── Styling helpers (same colour scheme as original) ───────────────────────

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high':   return 'text-red-400 border-red-500/50 bg-red-500/10';
      case 'medium': return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
      case 'low':    return 'text-green-400 border-green-500/50 bg-green-500/10';
      default:       return 'text-gray-400 border-gray-500/50 bg-gray-500/10';
    }
  };

  const getEngineColor = (category: string) => {
    switch (category) {
      case 'malicious':  return 'text-red-400 bg-red-500/10';
      case 'suspicious': return 'text-yellow-400 bg-yellow-500/10';
      case 'harmless':   return 'text-green-400 bg-green-500/10';
      default:           return 'text-gray-400 bg-gray-500/10';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Globe className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">URL Scanner</h3>
        <span className="ml-auto text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded">
          VirusTotal + Safe Browsing
        </span>
      </div>

      <div className="space-y-4">
        {/* Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">URL to Scan</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && scanURL()}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            placeholder="https://example.com"
          />
        </div>

        {/* Scan Button */}
        <button
          onClick={scanURL}
          disabled={!url.trim() || loading}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center shadow-lg shadow-cyan-500/30"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              {loadingStep || 'Scanning...'}
            </>
          ) : (
            <>
              <Search className="w-5 h-5 mr-2" />
              Scan URL
            </>
          )}
        </button>

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-4">
            {/* Verdict card */}
            <div className={`bg-gray-800/50 border rounded-lg p-4 ${getRiskColor(result.riskLevel)}`}>
              <div className="flex items-center mb-3">
                {result.safe ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
                )}
                <span className={`text-lg font-semibold ${
                  result.safe ? 'text-green-400' : result.riskLevel === 'high' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {result.safe ? 'SAFE' : result.riskLevel === 'high' ? 'DANGEROUS' : 'SUSPICIOUS'}
                </span>

                {result.vtPermalink && (
                  <a
                    href={result.vtPermalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center text-xs text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Full VT Report <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
              </div>

              <div className="flex items-center mb-1">
                <Shield className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-400">Risk Level:</span>
                <span className={`ml-2 text-sm font-semibold uppercase ${
                  result.riskLevel === 'high' ? 'text-red-400' :
                  result.riskLevel === 'medium' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {result.riskLevel}
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  via {result.scanSource === 'virustotal' ? 'VirusTotal' : result.scanSource === 'combined' ? 'VT + Safe Browsing' : 'Local checks'}
                </span>
              </div>
            </div>

            {/* VirusTotal stats */}
            {result.vtStats && (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h4 className="text-cyan-400 font-semibold mb-3 flex items-center text-sm">
                  <Activity className="w-4 h-4 mr-2" />
                  VirusTotal — {result.vtStats.total} engines scanned
                </h4>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Malicious',  value: result.vtStats.malicious,  color: 'text-red-400',    bg: 'bg-red-500/10' },
                    { label: 'Suspicious', value: result.vtStats.suspicious, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                    { label: 'Harmless',   value: result.vtStats.harmless,   color: 'text-green-400',  bg: 'bg-green-500/10' },
                    { label: 'Undetected', value: result.vtStats.undetected, color: 'text-gray-400',   bg: 'bg-gray-500/10' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`${bg} rounded-lg p-3 text-center`}>
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-gray-400 mt-1">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Engine breakdown */}
                {result.vtEngines && result.vtEngines.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {result.vtEngines.map(({ engine, category, result: res }) => (
                      <div key={engine} className="flex items-center justify-between text-xs bg-gray-900/50 rounded px-3 py-1.5">
                        <span className="text-gray-300">{engine}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getEngineColor(category)}`}>
                          {res || category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                <h4 className="text-red-400 font-semibold mb-2 flex items-center text-sm">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Issues Found ({result.issues.length})
                </h4>
                <ul className="text-red-200 text-sm space-y-1">
                  {result.issues.map((issue, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-red-400 mr-2 mt-0.5">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                <h4 className="text-blue-400 font-semibold mb-2 flex items-center text-sm">
                  <Shield className="w-4 h-4 mr-2" />
                  Recommendations
                </h4>
                <ul className="text-blue-200 text-sm space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-blue-400 mr-2 mt-0.5">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};