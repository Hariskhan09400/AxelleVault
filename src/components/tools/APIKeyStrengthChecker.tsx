import { useState } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const scoreAPIKey = (value: string) => {
  let score = 0;
  if (value.length >= 20) score += 40;
  if (/[a-z]/.test(value)) score += 15;
  if (/[A-Z]/.test(value)) score += 15;
  if (/[0-9]/.test(value)) score += 15;
  if (/[^a-zA-Z0-9]/.test(value)) score += 15;
  const entropy = Math.min(100, Math.round(score));
  const strength = entropy >= 80 ? 'Very Strong' : entropy >= 60 ? 'Strong' : entropy >= 40 ? 'Moderate' : 'Weak';
  return { entropy, strength };
};

export const APIKeyStrengthChecker = () => {
  const { user } = useAuth();
  const [key, setKey] = useState('');
  const [result, setResult] = useState<{ entropy: number; strength: string } | null>(null);

  const check = async () => {
    const r = scoreAPIKey(key);
    setResult(r);
    if (user) {
      await logToolUsage(user.id, 'api-key-strength-checker', key, JSON.stringify(r));
      await supabase.from('security_logs').insert({ user_id: user.id, event_type: 'apikey_strength_check', event_data: { key: key.slice(0, 4) + '...' }, risk_level: 'low' });
    }
  };

  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl text-white mb-3">API Key Strength Checker</h3>
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Enter API key" className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-white mb-2" />
      <button disabled={!key} onClick={check} className="bg-cyan-500 px-3 py-2 rounded font-semibold">Evaluate</button>
      {result && (
        <div className="mt-3 text-sm text-cyan-100">
          <p>Strength: <strong>{result.strength}</strong></p>
          <p>Entropy score: <strong>{result.entropy}</strong></p>
        </div>
      )}
    </div>
  );
};