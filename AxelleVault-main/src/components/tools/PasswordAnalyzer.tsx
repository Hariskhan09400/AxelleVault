import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Clock3, Sparkles } from 'lucide-react';
import { analyzePasswordStrength } from '../../utils/securityTools';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

export const PasswordAnalyzer = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzePasswordStrength> | null>(null);

  useEffect(() => {
    if (!password) {
      setAnalysis(null);
      return;
    }
    const result = analyzePasswordStrength(password);
    setAnalysis(result);
  }, [password]);

  const logAnalysis = async () => {
    if (!user || !analysis) return;
    await supabase.from('security_logs').insert({
      user_id: user.id,
      event_type: 'password_analyzed',
      event_data: {
        strength: analysis.strength,
        score: analysis.score,
        crackTime: analysis.crackTime,
      },
      risk_level: analysis.score < 40 ? 'high' : analysis.score < 70 ? 'medium' : 'low',
    });
    showToast('info', `Password strength: ${analysis.strength} (${analysis.score}/100)`);
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Shield className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">Password Analyzer</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Enter Password to Analyze
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            placeholder="Enter password..."
          />
        </div>

        {analysis && (
          <button
            onClick={logAnalysis}
            className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Save Analysis to History
          </button>
        )}

        {analysis && (
          <div className="mt-6 space-y-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Security Analysis</h4>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Overall Strength</span>
                  <span className={`font-semibold ${
                    analysis.score >= 80 ? 'text-green-400' :
                    analysis.score >= 60 ? 'text-cyan-400' :
                    analysis.score >= 40 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {analysis.score}/100
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      analysis.score >= 80 ? 'bg-green-500' :
                      analysis.score >= 60 ? 'bg-cyan-500' :
                      analysis.score >= 40 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${analysis.score}%` }}
                  ></div>
                </div>
                <p className={`text-sm mt-2 font-medium ${
                  analysis.score >= 80 ? 'text-green-400' :
                  analysis.score >= 60 ? 'text-cyan-400' :
                  analysis.score >= 40 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {analysis.strength}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Entropy</p>
                  <p className="text-lg font-semibold text-white">{analysis.entropy.toFixed(1)} bits</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Crack Time</p>
                  <p className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Clock3 className="h-4 w-4 text-cyan-400" />
                    {analysis.crackTime}
                  </p>
                </div>
              </div>

              {analysis.feedback.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-yellow-400 mb-2">Recommendations</h5>
                      <ul className="text-xs text-yellow-200 space-y-1">
                        {analysis.feedback.map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs text-cyan-200">
                <p className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  Suggested baseline: 14+ chars, mixed case, numbers, and symbols.
                </p>
              </div>
            </div>
          </div>
        )}

        {!analysis && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Enter a password to see detailed security analysis
          </div>
        )}
      </div>
    </div>
  );
};
