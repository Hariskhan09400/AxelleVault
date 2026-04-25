import { useState } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export const HTTPHeaderAnalyzer = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!url) return;
    setError('');
    setHeaders({});
    setLoading(true);

    try {
      const res = await fetch(url, { method: 'HEAD' });
      const h: Record<string, string> = {};
      res.headers.forEach((value, key) => { h[key] = value; });
      setHeaders(h);
      if (user) {
        await logToolUsage(user.id, 'http-header-analyzer', url, JSON.stringify(h));
        await supabase.from('security_logs').insert({ user_id: user.id, event_type: 'http_header_analyze', event_data: { url }, risk_level: 'low' });
      }
    } catch (err) {
      setError((err as Error).message || 'Header analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl text-white mb-3">HTTP Header Analyzer</h3>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="w-full bg-gray-800 rounded p-2 text-white mb-2" />
      <button disabled={!url || loading} onClick={analyze} className="bg-cyan-500 px-4 py-2 rounded font-semibold">{loading ? 'Analyzing...' : 'Analyze'}</button>
      {error && <p className="text-red-400 mt-2">{error}</p>}
      {Object.keys(headers).length > 0 && (
        <div className="mt-3 max-h-80 overflow-y-auto bg-gray-800 p-3 rounded text-xs">
          {Object.entries(headers).map(([k,v]) => <div key={k} className="text-gray-200"><span className="text-cyan-300">{k}</span>: {v}</div>)}
        </div>
      )}
    </div>
  );
};