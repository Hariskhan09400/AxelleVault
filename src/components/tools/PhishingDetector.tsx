import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { analyzePhishingURL } from '../../utils/securityTools';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export const PhishingDetector = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ReturnType<typeof analyzePhishingURL> | null>(null);

  const handleAnalyze = () => {
    if (!url) return;

    const analysis = analyzePhishingURL(url);
    setResult(analysis);

    if (user) {
      supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'phishing_scan',
        event_data: {
          classification: analysis.classification,
          score: analysis.score
        },
        risk_level: analysis.classification === 'Dangerous' ? 'high' :
                    analysis.classification === 'Suspicious' ? 'medium' : 'low',
      });
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Shield className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">Phishing Detection Engine</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Enter URL to Analyze
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            placeholder="https://example.com"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!url}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30"
        >
          Analyze URL
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div className={`border rounded-lg p-4 ${
              result.classification === 'Safe' ? 'bg-green-500/10 border-green-500/50' :
              result.classification === 'Suspicious' ? 'bg-yellow-500/10 border-yellow-500/50' :
              'bg-red-500/10 border-red-500/50'
            }`}>
              <div className="flex items-center mb-3">
                {result.classification === 'Safe' ? (
                  <CheckCircle className="w-8 h-8 text-green-400 mr-3" />
                ) : result.classification === 'Suspicious' ? (
                  <AlertTriangle className="w-8 h-8 text-yellow-400 mr-3" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-400 mr-3" />
                )}
                <div>
                  <h4 className={`font-semibold text-lg ${
                    result.classification === 'Safe' ? 'text-green-400' :
                    result.classification === 'Suspicious' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {result.classification}
                  </h4>
                  <p className="text-sm text-gray-400">Risk Score: {result.score}/100</p>
                </div>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    result.classification === 'Safe' ? 'bg-green-500' :
                    result.classification === 'Suspicious' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${result.score}%` }}
                ></div>
              </div>

              <div className={`rounded-lg p-3 ${
                result.classification === 'Safe' ? 'bg-green-900/30' :
                result.classification === 'Suspicious' ? 'bg-yellow-900/30' :
                'bg-red-900/30'
              }`}>
                <h5 className="text-sm font-medium text-gray-300 mb-2">Findings</h5>
                <ul className="text-sm space-y-1">
                  {result.findings.map((finding, index) => (
                    <li key={index} className={`${
                      result.classification === 'Safe' ? 'text-green-200' :
                      result.classification === 'Suspicious' ? 'text-yellow-200' :
                      'text-red-200'
                    }`}>
                      • {finding}
                    </li>
                  ))}
                </ul>
              </div>

              {result.classification !== 'Safe' && (
                <div className="mt-3 p-3 bg-gray-900/50 rounded-lg">
                  <p className="text-xs text-gray-400">
                    ⚠️ Exercise caution when accessing this URL. Verify the source and avoid entering sensitive information.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!result && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Enter a URL to analyze for potential phishing threats
          </div>
        )}
      </div>
    </div>
  );
};
