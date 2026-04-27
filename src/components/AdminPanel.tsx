import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Shield, Lock, Unlock, Users, Activity, Database, AlertTriangle } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  user_metadata: Record<string, any>;
  created_at: string;
  last_sign_in_at: string | null;
}

export const AdminPanel = () => {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !isAdmin) return;
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('auth.users').select('*');
      if (error) {
        setError(error.message);
      } else {
        setUsers((data as UserRow[]) || []);
      }
      setLoading(false);
    };
    fetchUsers();
  }, [user, isAdmin]);

  const toggleUserBlock = async (userId: string, shouldBlock: boolean) => {
    try {
      // This action requires service role or Supabase Admin API outside client scope.
      alert('Use Supabase dashboard or a secure Edge Function with service role key to block/unblock users.');
    } catch (err) {
      setError('Unable to update user block status; check your admin API');
    }
  };

  const isAllowedAdmin = isAdmin || user?.email?.toLowerCase() === 'admin@gmail.com';
  if (!isAllowedAdmin) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-8">
        <div className="text-center bg-gray-900/80 border border-red-500/40 rounded-xl p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-red-400">404 Not Found</h1>
          <p className="text-gray-400 mt-2">The page you are looking for doesn't exist.</p>
          <p className="text-gray-500 mt-1">Admin panel access is restricted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-cyan-400" />
          <h3 className="text-xl font-semibold text-white">Admin Control Panel</h3>
        </div>

        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

        {loading ? (
          <div className="text-gray-400">Loading users...</div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm text-left text-gray-300">
              <thead className="text-xs uppercase tracking-wider text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">User ID</th>
                  <th className="px-2 py-2">Created</th>
                  <th className="px-2 py-2">Last Sign-in</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                    <td className="px-2 py-2 text-white">{row.email}</td>
                    <td className="px-2 py-2 truncate max-w-[250px]">{row.id}</td>
                    <td className="px-2 py-2">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-2 py-2">{row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleString() : '-'}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => toggleUserBlock(row.id, true)}
                        className="mr-2 px-2 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      >
                        <Lock className="w-4 h-4 inline-block" /> Block
                      </button>
                      <button
                        onClick={() => toggleUserBlock(row.id, false)}
                        className="px-2 py-1 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30"
                      >
                        <Unlock className="w-4 h-4 inline-block" /> Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};