import { useState } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');

export const FileHashGenerator = () => {
  const { user } = useAuth();
  const [hash, setHash] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError('');
    setHash('');
    setLoading(true);

    try {
      const array = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', array);
      const value = hex(digest);
      setHash(value);
      if (user) await logToolUsage(user.id, 'file-hash-generator', file.name, value);
      if (user) await supabase.from('security_logs').insert({ user_id: user.id, event_type: 'file_hash_generated', event_data: { name: file.name }, risk_level: 'low' });
    } catch (err) {
      setError((err as Error).message || 'Hash generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl text-white mb-4">File Hash Generator</h3>
      <input type="file" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="mb-3 text-sm text-gray-200" />
      {loading && <p className="text-cyan-300">Computing hash...</p>}
      {error && <p className="text-red-400">{error}</p>}
      {hash && <p className="text-green-300 break-all">SHA-256: {hash}</p>}
    </div>
  );
};