import { useState } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export const DNSLookupTool = () => {
  const { user } = useAuth();
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookup = async () => {
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=ANY`);
      const data = await response.json();
      setResult(data);
      if (user) {
        await logToolUsage(user.id, 'dns-lookup', domain, JSON.stringify(data).slice(0, 2000));
        await supabase.from('security_logs').insert({ user_id: user.id, event_type: 'dns_lookup', event_data: { domain }, risk_level: 'low' });
      }
    } catch (err) {
      setError((err as Error).message || 'DNS lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl text-white mb-3">DNS Lookup Tool</h3>
      <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="w-full bg-gray-800 rounded p-2 text-white mb-2" />
      <button onClick={lookup} disabled={!domain || loading} className="bg-cyan-500 px-4 py-2 rounded font-semibold">{loading ? 'Looking up...' : 'Lookup'}</button>
      {error && <p className="text-red-400 mt-2">{error}</p>}
      {result && <pre className="bg-gray-800 rounded p-3 mt-3 text-xs max-h-80 overflow-y-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
};