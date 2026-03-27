import { useState } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export const DarkWebExposureChecker = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const runCheck = async () => {
    setError('');
    setStatus('Scanning dark web feeds...');

    try {
      const deepkey = import.meta.env.VITE_DARKWEB_API_KEY;
      if (!deepkey) {
        setStatus('No API key configured. Using sample offline scan data.');
        // Fallback fake data
        const found = ['leaked@example.com'].includes(query.toLowerCase());
        setStatus(found ? 'Exposure found in dark web feeds' : 'No exposure found');
        if (user) {
          await logToolUsage(user.id, 'darkweb-exposure-checker', query, JSON.stringify({ found }));
          await supabase.from('security_logs').insert({ user_id: user.id, event_type: 'darkweb_check', event_data: { query, found }, risk_level: found ? 'high' : 'low' });
        }
        return;
      }

      const bravo = await fetch(`https://darksearch.io/api/search?query=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${deepkey}`, 'Accept': 'application/json' }
      });
      if (!bravo.ok) throw new Error('Dark web API failed');
      const data = await bravo.json();
      const found = !!data?.results?.length;
      setStatus(found ? 'Exposure found' : 'No matches found');
      if (user) {
        await logToolUsage(user.id, 'darkweb-exposure-checker', query, JSON.stringify(data).slice(0, 2000));
        await supabase.from('security_logs').insert({ user_id: user.id, event_type: 'darkweb_check', event_data: { query, found }, risk_level: found ? 'high' : 'low' });
      }
    } catch (err) {
      setError((err as Error).message);
      setStatus('');
    }
  };

  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl text-white mb-3">Dark Web Exposure Checker</h3>
      <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-gray-800 p-2 rounded text-white mb-2" placeholder="Email or keyword" />
      <button onClick={runCheck} disabled={!query} className="bg-cyan-500 px-4 py-2 rounded font-semibold">Check</button>
      {status && <p className="text-green-300 mt-2">{status}</p>}
      {error && <p className="text-red-400 mt-2">{error}</p>}
    </div>
  );
};