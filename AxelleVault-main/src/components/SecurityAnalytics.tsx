import { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface AnalyticsData {
  totalScans: number;
  threatsDetected: number;
  safeResults: number;
  toolUsage: { name: string; count: number }[];
}

export const SecurityAnalytics = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData>({
    totalScans: 0,
    threatsDetected: 0,
    safeResults: 0,
    toolUsage: [],
  });
  const [toolUsageHistory, setToolUsageHistory] = useState<Array<{id:string, tool_name:string, created_at:string}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    fetchAnalytics();

    const channel = supabase
      .channel('public:security_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_logs' }, () => {
        fetchAnalytics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      const { data: logs } = await supabase
        .from('security_logs')
        .select('event_type, risk_level')
        .eq('user_id', user.id);

      if (logs) {
        const totalScans = logs.length;
        const threatsDetected = logs.filter(log => log.risk_level === 'high' || log.risk_level === 'medium').length;
        const safeResults = logs.filter(log => log.risk_level === 'low').length;

        // Tool usage
        const toolCounts: Record<string, number> = {};
        logs.forEach(log => {
          const tool = log.event_type;
          toolCounts[tool] = (toolCounts[tool] || 0) + 1;
        });

        const toolUsage = Object.entries(toolCounts).map(([name, count]) => ({
          name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          count,
        }));

        const { data: usageHistory } = await supabase
          .from('tool_usage_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (usageHistory) setToolUsageHistory(usageHistory as any);

        setData({
          totalScans,
          threatsDetected,
          safeResults,
          toolUsage,
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'Safe', value: data.safeResults, color: '#00ff88' },
    { name: 'Threats', value: data.threatsDetected, color: '#ff4444' },
  ];

  if (loading) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
        <div className="flex items-center mb-6">
          <BarChart3 className="w-6 h-6 text-cyan-400 mr-3" />
          <h3 className="text-xl font-semibold text-white">Security Analytics Dashboard</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Scans</p>
                <p className="text-2xl font-bold text-white">{data.totalScans}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-cyan-400" />
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Safe Results</p>
                <p className="text-2xl font-bold text-green-400">{data.safeResults}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Threats Detected</p>
                <p className="text-2xl font-bold text-red-400">{data.threatsDetected}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <PieChart className="w-5 h-5 mr-2" />
              Scan Results Distribution
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Tool Usage
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.toolUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#00ff88" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
        <h4 className="text-lg font-semibold text-white mb-4">Recent Tool Usage</h4>
        {toolUsageHistory.length === 0 ? (
          <p className="text-gray-400">No tool usage history found yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-200 max-h-60 overflow-y-auto">
            {toolUsageHistory.map((row) => (
              <li key={row.id} className="border border-gray-700 rounded p-2">
                <div className="flex justify-between items-center">
                  <span>{row.tool_name}</span>
                  <span className="text-xs text-gray-400">{new Date(row.created_at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};