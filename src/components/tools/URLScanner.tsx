import { useState } from 'react';
import { Globe, AlertTriangle, CheckCircle, Search, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface ScanResult {
  safe: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  issues: string[];
  recommendations: string[];
}

export const URLScanner = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  const scanURL = async () => {
    if (!url.trim()) return;

    setLoading(true);

    // Mock URL analysis
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);

      // Check HTTPS
      if (urlObj.protocol !== 'https:') {
        issues.push('Not using HTTPS');
        recommendations.push('Use HTTPS for secure connections');
      }

      // Check for suspicious keywords
      const suspiciousKeywords = ['login', 'verify', 'bank', 'paypal', 'secure', 'account', 'password', 'signin'];
      const urlLower = url.toLowerCase();
      const foundKeywords = suspiciousKeywords.filter(keyword => urlLower.includes(keyword));

      if (foundKeywords.length > 0) {
        issues.push(`Suspicious keywords detected: ${foundKeywords.join(', ')}`);
        recommendations.push('Verify the URL is legitimate before entering credentials');
      }

      // Check domain length (long domains can be suspicious)
      if (urlObj.hostname.length > 50) {
        issues.push('Unusually long domain name');
        recommendations.push('Check for typos or malicious domains');
      }

      // Mock additional checks
      const mockSuspicious = urlLower.includes('fake') || urlLower.includes('test');
      if (mockSuspicious) {
        issues.push('Domain appears suspicious');
        recommendations.push('Avoid entering personal information');
      }

    } catch (error) {
      issues.push('Invalid URL format');
      recommendations.push('Ensure the URL is properly formatted');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (issues.length >= 3) riskLevel = 'high';
    else if (issues.length >= 1) riskLevel = 'medium';

    const scanResult: ScanResult = {
      safe: issues.length === 0,
      riskLevel,
      issues,
      recommendations,
    };

    setResult(scanResult);

    if (user) {
      await supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'url_scan',
        event_data: { url: url.toLowerCase(), risk_level: riskLevel, issues_count: issues.length },
        risk_level: riskLevel,
      });
    }

    setLoading(false);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-400 border-red-500/50 bg-red-500/10';
      case 'medium': return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
      case 'low': return 'text-green-400 border-green-500/50 bg-green-500/10';
      default: return 'text-gray-400 border-gray-500/50 bg-gray-500/10';
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Globe className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">URL Scanner</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            URL to Scan
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            placeholder="https://example.com"
          />
        </div>

        <button
          onClick={scanURL}
          disabled={!url.trim() || loading}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center shadow-lg shadow-cyan-500/30"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <Search className="w-5 h-5 mr-2" />
          )}
          Scan URL
        </button>

        {result && (
          <div className="mt-6 space-y-4">
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
                  {result.safe ? 'SAFE' : 'SUSPICIOUS'}
                </span>
              </div>

              <div className="flex items-center mb-2">
                <Shield className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-400">Risk Level:</span>
                <span className={`ml-2 text-sm font-semibold uppercase ${
                  result.riskLevel === 'high' ? 'text-red-400' :
                  result.riskLevel === 'medium' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {result.riskLevel}
                </span>
              </div>
            </div>

            {result.issues.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                <h4 className="text-red-400 font-semibold mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Issues Found
                </h4>
                <ul className="text-red-200 text-sm space-y-1">
                  {result.issues.map((issue, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-red-400 mr-2">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                <h4 className="text-blue-400 font-semibold mb-2 flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  Recommendations
                </h4>
                <ul className="text-blue-200 text-sm space-y-1">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-400 mr-2">•</span>
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