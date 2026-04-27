import { useState } from 'react';
import { Shield, Key, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';

export const Settings = () => {
  const { user, changePassword, deleteAccount, signOut } = useAuth();
  const { showToast } = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('error', 'New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      showToast('error', 'New password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    const { error } = await changePassword(oldPassword, newPassword);
    setBusy(false);

    if (error) {
      showToast('error', error.message || 'Password change failed.');
    } else {
      showToast('success', 'Password changed successfully. Please login again.');
      await signOut();
      navigate('/login', { replace: true });
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your account permanently? This action cannot be undone.')) {
      return;
    }

    setBusy(true);
    const { error } = await deleteAccount();
    setBusy(false);

    if (error) {
      showToast('error', error.message || 'Delete account failed.');
    } else {
      showToast('success', 'Account deleted successfully.');
      navigate('/signup', { replace: true });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="bg-gray-900/70 border border-cyan-500/30 rounded-2xl p-6 shadow-lg shadow-cyan-500/20">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Account Security</h2>
        </div>
        <p className="text-sm text-gray-400 mb-5">
          Manage your credentials and sign-in security. The original email is{' '}
          <span className="text-cyan-300">{user?.email || 'unknown'}</span>.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Current Password</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-green-500 text-white rounded-xl font-semibold transition disabled:opacity-50"
          >
            <Key className="w-4 h-4" />
            {busy ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </section>

      <section className="bg-gray-900/70 border border-red-500/30 rounded-2xl p-6 shadow-lg shadow-red-500/15">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h2 className="text-xl font-bold text-white">Danger Zone</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Permanently delete your account, including all encrypted notes and account history.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-red-500/60 text-red-400 rounded-xl hover:bg-red-500/10 transition disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {busy ? 'Processing...' : 'Delete Account'}
        </button>
      </section>

      <div className="p-4 bg-gray-800/40 border border-gray-700 rounded-xl text-gray-300 text-sm">
        <CheckCircle className="inline w-4 h-4 mr-1 text-green-400" />
        You can configure advanced security policies in the admin suite.
      </div>
    </div>
  );
};
