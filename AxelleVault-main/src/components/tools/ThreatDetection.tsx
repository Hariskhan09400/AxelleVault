import { useState } from 'react';
import { Brain, AlertTriangle, CheckCircle, Search, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface DetectionResult {
  riskLevel: 'low' | 'medium' | 'high';
  score: number;
  threats: string[];
  recommendations: string[];
}

export const ThreatDetection = () => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'url' | 'text'>('url');
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzeThreat = async (): Promise<DetectionResult> => {
    let score = 0;
    const threats: string[] = [];
    const recommendations: string[] = [];

    const text = input.toLowerCase();

    // Phishing keywords
    const phishingKeywords = [
      'login', 'verify', 'urgent', 'bank', 'password', 'account', 'secure',
      'confirm', 'update', 'suspended', 'click here', 'free', 'win', 'prize'
    ];

    const foundKeywords = phishingKeywords.filter(keyword => text.includes(keyword));
    if (foundKeywords.length > 0) {
      score += foundKeywords.length * 10;
      threats.push(`Found suspicious keywords: ${foundKeywords.join(', ')}`);
      recommendations.push('Avoid entering personal information on this page');
    }

    // URL-specific checks
    if (inputType === 'url') {
      try {
        const url = new URL(input.startsWith('http') ? input : `https://${input}`);

        // HTTPS check
        if (url.protocol !== 'https:') {
          score += 30;
          threats.push('Not using HTTPS encryption');
          recommendations.push('Only use HTTPS websites for sensitive information');
        }

        // Domain length
        if (url.hostname.length > 30) {
          score += 15;
          threats.push('Unusually long domain name');
          recommendations.push('Check for typos or malicious domains');
        }

        // Subdomain check
        const subdomainCount = url.hostname.split('.').length - 2;
        if (subdomainCount > 2) {
          score += 10;
          threats.push('Multiple subdomains detected');
          recommendations.push('Verify the legitimacy of the website');
        }

        // Common phishing TLDs
        const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq'];
        if (suspiciousTlds.some(tld => url.hostname.endsWith(tld))) {
          score += 25;
          threats.push('Suspicious top-level domain');
          recommendations.push('Avoid websites with uncommon TLDs');
        }

      } catch {
        score += 20;
        threats.push('Invalid URL format');
        recommendations.push('Ensure the URL is properly formatted');
      }
    }

    // Text analysis for suspicious patterns
    if (inputType === 'text') {
      // Email-like patterns in text
      if (text.includes('@') && text.includes('.')) {
        score += 5;
        threats.push('Contains email-like patterns');
      }

      // Phone numbers
      const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
      if (phoneRegex.test(text)) {
        score += 10;
        threats.push('Contains phone number patterns');
        recommendations.push('Do not share personal contact information');
      }

      // Urgency words
      const urgencyWords = ['immediately', 'now', 'urgent', 'asap', 'deadline'];
      const foundUrgency = urgencyWords.filter(word => text.includes(word));
      if (foundUrgency.length > 0) {
        score += foundUrgency.length * 8;
        threats.push('Creates false sense of urgency');
        recommendations.push('Take time to verify before acting');
      }
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (score >= 50) riskLevel = 'high';
    else if (score >= 20) riskLevel = 'medium';

    // Default recommendations if none
    if (recommendations.length === 0) {
      recommendations.push('Content appears safe, but always verify sources');
    }

    return {
      riskLevel,
      score: Math.min(score, 100),
      threats,
      recommendations,
    };
  };

  const detect = async () => {
    if (!input.trim()) return;

    setLoading(true);
    const detectionResult = await analyzeThreat();
    setResult(detectionResult);

    if (user) {
      await supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'threat_detection',
        event_data: { input_type: inputType, risk_level: detectionResult.riskLevel, score: detectionResult.score },
        risk_level: detectionResult.riskLevel,
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
        <Brain className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">AI Threat Detection</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Input Type
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="inputType"
                value="url"
                checked={inputType === 'url'}
                onChange={(e) => setInputType(e.target.value as 'url')}
                className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-300">URL</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="inputType"
                value="text"
                checked={inputType === 'text'}
                onChange={(e) => setInputType(e.target.value as 'text')}
                className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-300">Text</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {inputType === 'url' ? 'URL to Analyze' : 'Text to Analyze'}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
            placeholder={inputType === 'url' ? 'https://example.com' : 'Enter text to analyze for threats'}
            rows={4}
          />
        </div>

        <button
          onClick={detect}
          disabled={!input.trim() || loading}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center shadow-lg shadow-cyan-500/30"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <Search className="w-5 h-5 mr-2" />
          )}
          Analyze Threat
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div className={`bg-gray-800/50 border rounded-lg p-4 ${getRiskColor(result.riskLevel)}`}>
              <div className="flex items-center mb-3">
                {result.riskLevel === 'low' ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
                )}
                <span className={`text-lg font-semibold ${
                  result.riskLevel === 'low' ? 'text-green-400' :
                  result.riskLevel === 'high' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {result.riskLevel.toUpperCase()} RISK
                </span>
              </div>

              <div className="flex items-center mb-2">
                <Shield className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-400">Threat Score:</span>
                <span className={`ml-2 text-sm font-semibold ${
                  result.riskLevel === 'high' ? 'text-red-400' :
                  result.riskLevel === 'medium' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {result.score}/100
                </span>
              </div>
            </div>

            {result.threats.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                <h4 className="text-red-400 font-semibold mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Detected Threats
                </h4>
                <ul className="text-red-200 text-sm space-y-1">
                  {result.threats.map((threat, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-red-400 mr-2">•</span>
                      {threat}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
              <h4 className="text-blue-400 font-semibold mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                Security Recommendations
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
          </div>
        )}
      </div>
    </div>
  );
};