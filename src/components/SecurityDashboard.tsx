import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Shield, Clock, ScanLine } from 'lucide-react';
import { supabase, SecurityLog, ToolUsageHistory } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { calculateSecurityScore } from '../utils/securityTools';

export const SecurityDashboard = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [securityScore, setSecurityScore] = useState(50);
  const [totalScans, setTotalScans] = useState(0);
  const [toolUsageHistory, setToolUsageHistory] = useState<ToolUsageHistory[]>([]);

  useEffect(() => {
    if (user) {
      fetchLogs();
      calculateUserSecurityScore();
    }
  }, [user]);

  const fetchLogs = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('security_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setLogs(data);
      const scanCount = data.filter((log) =>
        ['ip_lookup', 'phishing_scan', 'password_analyzed', 'hash_verified'].includes(log.event_type)
      ).length;
      setTotalScans(scanCount);
    }

    setLoading(false);
  };

  const calculateUserSecurityScore = async () => {
    if (!user || !profile) return;

    const accountAge = Math.floor(
      (new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    const { data: logsData } = await supabase
      .from('security_logs')
      .select('*')
      .eq('user_id', user.id);

    const toolUsage = logsData?.length || 0;

    const score = calculateSecurityScore({
      passwordStrength: 75,
      recentFailedLogins: profile.failed_login_count || 0,
      accountAge,
      toolUsage,
    });

    setSecurityScore(score);

    await supabase.from('user_profiles').update({ security_score: score }).eq('id', user.id);

    await supabase.from('security_scores_history').insert({
      user_id: user.id,
      score,
      factors: {
        passwordStrength: 75,
        failedLogins: profile.failed_login_count || 0,
        accountAge,
        toolUsage,
      },
    });

    refreshProfile();
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-400 bg-red-500/10 border-red-500/50';
      case 'high':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/50';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/50';
      default:
        return 'text-green-400 bg-green-500/10 border-green-500/50';
    }
  };

  const formatEventType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-cyan-500/10 to-green-500/10 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-cyan-400 mr-3" />
              <div>
                <p className="text-sm text-gray-400">Security Score</p>
                <p className="text-3xl font-bold text-white">{securityScore}</p>
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                securityScore >= 80 ? 'bg-green-500' :
                securityScore >= 60 ? 'bg-cyan-500' :
                securityScore >= 40 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${securityScore}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {securityScore >= 80 ? 'Excellent security posture' :
             securityScore >= 60 ? 'Good security practices' :
             securityScore >= 40 ? 'Needs improvement' :
             'Critical improvements needed'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl border border-purple-500/30 rounded-lg p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <Activity className="w-8 h-8 text-purple-400 mr-3" />
            <div>
              <p className="text-sm text-gray-400">Total Activities</p>
              <p className="text-3xl font-bold text-white">{logs.length}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Security events logged</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-xl border border-blue-500/30 rounded-lg p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <ScanLine className="w-8 h-8 text-blue-400 mr-3" />
            <div>
              <p className="text-sm text-gray-400">Total Scans</p>
              <p className="text-3xl font-bold text-white">{totalScans}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">IP and security tool scans</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-xl border border-orange-500/30 rounded-lg p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-8 h-8 text-orange-400 mr-3" />
            <div>
              <p className="text-sm text-gray-400">Failed Logins</p>
              <p className="text-3xl font-bold text-white">{profile?.failed_login_count || 0}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Suspicious activity detected</p>
          <p className="mt-2 text-xs text-gray-400">
            Last activity: {logs[0]?.created_at ? new Date(logs[0].created_at).toLocaleString() : 'No activity'}
          </p>
        </div>
      </div>

      <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
        <div className="flex items-center mb-6">
          <Clock className="w-6 h-6 text-cyan-400 mr-3" />
          <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading activity...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No security events logged yet. Start using the tools!
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="text-white font-medium">
                        {formatEventType(log.event_type)}
                      </span>
                      <span
                        className={`ml-3 px-2 py-1 text-xs rounded-full border ${getRiskLevelColor(
                          log.risk_level
                        )}`}
                      >
                        {log.risk_level.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
