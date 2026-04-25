import { useState } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export const SSLCertificateChecker = () => {
  const { user } = useAuth();
  const [host, setHost] = useState('');
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState('');

  const check = async () => {
    if (!host) return;
    setError('');
    setInfo(null);

    try {
      const response = await fetch(`https://api.securitytrails.com/v1/ssl/${encodeURIComponent(host)}`, {
        headers: { 'APIKEY': import.meta.env.VITE_SSL_API_KEY || '' }
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = await response.json();
      setInfo(data);
      if (user) {
        await logToolUsage(user.id, 'ssl-certificate-checker', host, JSON.stringify(data).slice(0, 2000));
        await supabase.from('security_logs').insert({ user_id: user.id, event_type: 'ssl_certificate_check', event_data: { host }, risk_level: 'low' });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl text-white mb-3">SSL Certificate Checker</h3>
      <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="example.com" className="w-full p-2 rounded bg-gray-800 text-white mb-2" />
      <button onClick={check} disabled={!host} className="bg-cyan-500 px-4 py-2 rounded font-semibold">Check SSL</button>
      {error && <p className="text-red-400 mt-2">{error}</p>}
      {info && <pre className="bg-gray-800 p-3 mt-2 rounded text-xs max-h-80 overflow-y-auto">{JSON.stringify(info, null, 2)}</pre>}
    </div>
  );
};