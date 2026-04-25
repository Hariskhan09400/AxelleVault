import { useState } from 'react';
import { User, Shield, CheckCircle, Info, Edit3 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';

export const Profile = () => {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const { error } = await updateProfile(fullName.trim());
    if (error) {
      showToast('error', error.message || 'Failed to update profile');
    } else {
      showToast('success', 'Profile updated successfully');
      await refreshProfile();
    }

    setIsSaving(false);
  };

  return (
    <div className="bg-gray-900/70 border border-cyan-500/30 rounded-2xl p-6 shadow-lg shadow-cyan-500/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Your Profile</h1>
          <p className="text-sm text-gray-400">Manage your account details safely.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
          <p className="text-sm text-white mt-1">{user?.email || 'unknown'}</p>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Username</p>
          <p className="text-sm text-white mt-1">{profile?.username || user?.email?.split('@')[0] || 'Anonymous'}</p>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Security Score</p>
          <p className="text-sm text-white mt-1">{profile?.security_score ?? 0} / 100</p>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Logins</p>
          <p className="text-sm text-white mt-1">{profile?.total_logins ?? 0}</p>
        </div>
      </div>

      <div className="mb-4 p-4 rounded-xl border border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <Info className="w-4 h-4" />
          <span>Update your full name. This is stored in your secure profile.</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <label className="block text-sm font-medium text-gray-300">Full Name</label>
        <div className="relative">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Put your legal name here"
            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <Edit3 className="absolute right-3 top-3 text-gray-400 w-4 h-4" />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-green-500 rounded-lg text-white font-semibold transition disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-xl text-gray-300 text-sm">
        <CheckCircle className="inline w-4 h-4 mr-2 text-green-400" />
        Keep your profile updated for better personalization and account recovery.
      </div>
    </div>
  );
};
