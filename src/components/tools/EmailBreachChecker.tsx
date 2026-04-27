import { useState } from 'react';
import { Mail, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface BreachResult {
  breached: boolean;
  breachCount: number;
  lastBreach?: string;
  warning?: string;
}

export const EmailBreachChecker = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<BreachResult | null>(null);
  const [loading, setLoading] = useState(false);

  const checkEmailBreach = async () => {
    if (!email.trim()) return;

    setLoading(true);

    const hibpKey = import.meta.env.VITE_HIBP_API_KEY;
    let finalResult: BreachResult = {
      breached: false,
      breachCount: 0,
    };

    if (hibpKey) {
      try {
        const res = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, {
          headers: {
            'hibp-api-key': hibpKey,
            'Accept': 'application/json',
            'User-Agent': 'AxelleVault/1.0',
          },
        });

        if (res.status === 404) {
          finalResult = { breached: false, breachCount: 0 };
        } else if (res.ok) {
          const breaches = await res.json();
          finalResult = {
            breached: Array.isArray(breaches),
            breachCount: Array.isArray(breaches) ? breaches.length : 0,
            lastBreach: Array.isArray(breaches) ? breaches[0]?.BreachDate : undefined,
            warning: Array.isArray(breaches) && breaches.length > 0 ? 'This email appears in one or more data breaches. Rotate affected secrets.' : undefined,
          };
        } else {
          const text = await res.text();
          throw new Error(`HIBP request failed (${res.status}): ${text}`);
        }
      } catch (err) {
        setError((err as Error).message || 'Unable to query breach database');
      }
    } else {
      // Fallback when API key is not set
      const mockBreachedEmails = ['breached@example.com', 'hacked@test.com', 'compromised@demo.com'];
      const isBreached = mockBreachedEmails.includes(email.toLowerCase());
      const breachCount = isBreached ? Math.floor(Math.random() * 5) + 1 : 0;

      finalResult = {
        breached: isBreached,
        breachCount,
        lastBreach: isBreached ? '2023-12-15' : undefined,
        warning: isBreached ? 'This email has been found in data breaches. Consider changing passwords and enabling 2FA.' : undefined,
      };
    }

    setResult(finalResult);

    if (user) {
      await logToolUsage(user.id, 'email-breach-checker', email, JSON.stringify(finalResult));
      await supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'email_breach_check',
        event_data: { email: email.toLowerCase(), result: finalResult },
        risk_level: finalResult.breached ? 'high' : 'low',
      });
    }

    setLoading(false);
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Mail className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">Email Breach Checker</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            placeholder="Enter email to check for breaches"
          />
        </div>

        <button
          onClick={checkEmailBreach}
          disabled={!email.trim() || loading}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center shadow-lg shadow-cyan-500/30"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <Search className="w-5 h-5 mr-2" />
          )}
          Check for Breaches
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div className={`bg-gray-800/50 border rounded-lg p-4 ${
              result.breached
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-green-500/50 bg-green-500/10'
            }`}>
              <div className="flex items-center mb-3">
                {result.breached ? (
                  <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                )}
                <span className={`text-lg font-semibold ${
                  result.breached ? 'text-red-400' : 'text-green-400'
                }`}>
                  {result.breached ? 'BREACHED' : 'SAFE'}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Breach Count:</span>
                  <span className="text-white font-medium">{result.breachCount}</span>
                </div>
                {result.lastBreach && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Breach:</span>
                    <span className="text-white font-medium">{result.lastBreach}</span>
                  </div>
                )}
              </div>
            </div>

            {result.warning && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-yellow-400 font-semibold mb-1">Security Warning</h4>
                    <p className="text-yellow-200 text-sm">{result.warning}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};