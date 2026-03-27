import { useState } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const decodeJwtPart = (str: string) => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/')))));
  } catch {
    return null;
  }
};

export const JWTDecoderValidator = () => {
  const { user } = useAuth();
  const [jwt, setJwt] = useState('');
  const [header, setHeader] = useState<Record<string, any> | null>(null);
  const [payload, setPayload] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState('');

  const decode = async () => {
    setError('');
    setHeader(null);
    setPayload(null);

    try {
      const parts = jwt.trim().split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT format');
      const h = decodeJwtPart(parts[0]);
      const p = decodeJwtPart(parts[1]);
      if (!h || !p) throw new Error('Unable to decode JWT');
      setHeader(h);
      setPayload(p);
      if (user) {
        await logToolUsage(user.id, 'jwt-decoder-validator', jwt.slice(0, 50) + '...', JSON.stringify({ header: h, payload: p }));
        await supabase.from('security_logs').insert({ user_id: user.id, event_type: 'jwt_decode', event_data: { kid: h.kid || null }, risk_level: 'low' });
      }
      const now = Math.floor(Date.now() / 1000);
      if (p.exp && now > p.exp) setError('Token expired');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl text-white mb-3">JWT Decoder + Validator</h3>
      <textarea value={jwt} onChange={(e) => setJwt(e.target.value)} className="w-full h-28 bg-gray-800 p-2 rounded text-white mb-2" placeholder="Paste JWT here" />
      <button onClick={decode} disabled={!jwt} className="bg-cyan-500 px-4 py-2 rounded font-semibold mb-3">Decode</button>
      {error && <p className="text-red-400">{error}</p>}
      {header && payload && (
        <div className="grid gap-3 md:grid-cols-2 text-xs">
          <div className="bg-gray-800 p-2 rounded"><h4 className="text-cyan-300">Header</h4><pre>{JSON.stringify(header, null, 2)}</pre></div>
          <div className="bg-gray-800 p-2 rounded"><h4 className="text-cyan-300">Payload</h4><pre>{JSON.stringify(payload, null, 2)}</pre></div>
        </div>
      )}
    </div>
  );
};