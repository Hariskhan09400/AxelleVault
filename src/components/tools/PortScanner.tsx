import { useState } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export const PortScanner = () => {
  const { user } = useAuth();
  const [host, setHost] = useState('');
  const [ports, setPorts] = useState('1-1024');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const scan = async () => {
    if (!host) return;
    setError('');
    setOutput('');
    setLoading(true);

    try {
      const response = await fetch(`https://api.hackertarget.com/nmap/?q=${encodeURIComponent(host)}&ports=${encodeURIComponent(ports)}`);
      const text = await response.text();
      if (text.toLowerCase().includes('error')) {
        throw new Error(text);
      }
      setOutput(text);
      if (user) await logToolUsage(user.id, 'port-scanner', `${host}:${ports}`, text.substring(0, 2000));
      await supabase.from('security_logs').insert({ user_id: user?.id, event_type: 'port_scan', event_data: { host, ports }, risk_level: 'low' });
    } catch (err) {
      setError((err as Error).message || 'Port scanning failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl text-white mb-4">Port Scanner</h3>
      <div className="grid gap-2 md:grid-cols-3 mb-4">
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="domain or IP" className="bg-gray-800 rounded p-2 text-white" />
        <input value={ports} onChange={(e) => setPorts(e.target.value)} placeholder="1-1024" className="bg-gray-800 rounded p-2 text-white" />
        <button onClick={scan} disabled={loading || !host} className="bg-cyan-500 px-4 py-2 rounded text-black font-bold">{loading ? 'Scanning...' : 'Scan'}</button>
      </div>
      {error && <div className="text-red-400 mb-2">{error}</div>}
      {output && <pre className="bg-gray-800 p-3 rounded text-xs whitespace-pre-wrap max-h-80 overflow-y-auto">{output}</pre>}
    </div>
  );
};