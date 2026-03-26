import { useState } from 'react';
import {
  Shield,
  Key,
  Hash,
  Globe,
  Activity,
  LogOut,
  Menu,
  X,
  User,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PasswordGenerator } from './tools/PasswordGenerator';
import { PasswordAnalyzer } from './tools/PasswordAnalyzer';
import { HashGenerator } from './tools/HashGenerator';
import { PhishingDetector } from './tools/PhishingDetector';
import { IPIntelligence } from './tools/IPIntelligence';
import { SecurityDashboard } from './SecurityDashboard';
import { useLocation, useNavigate } from 'react-router-dom';

type Tool =
  | 'dashboard'
  | 'password-generator'
  | 'password-analyzer'
  | 'hash-generator'
  | 'phishing-detector'
  | 'ip-intelligence';

export const Dashboard = () => {
  const { user, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const tools = [
    { id: 'dashboard' as Tool, name: 'Security Dashboard', icon: Activity, path: '/dashboard' },
    { id: 'password-generator' as Tool, name: 'Password Generator', icon: Key, path: '/tools/password-generator' },
    { id: 'password-analyzer' as Tool, name: 'Password Analyzer', icon: Shield, path: '/tools/password-analyzer' },
    { id: 'hash-generator' as Tool, name: 'Hash Tools', icon: Hash, path: '/tools/hash-generator' },
    { id: 'phishing-detector' as Tool, name: 'Phishing Detector', icon: Shield, path: '/tools/phishing-detector' },
    { id: 'ip-intelligence' as Tool, name: 'IP Intelligence', icon: Globe, path: '/tools/ip-intelligence' },
  ];

  const activeTool =
    tools.find((tool) => tool.path === location.pathname)?.id ??
    (location.pathname.startsWith('/tools') ? 'password-generator' : 'dashboard');

  const renderTool = () => {
    switch (activeTool) {
      case 'dashboard':
        return <SecurityDashboard />;
      case 'password-generator':
        return <PasswordGenerator />;
      case 'password-analyzer':
        return <PasswordAnalyzer />;
      case 'hash-generator':
        return <HashGenerator />;
      case 'phishing-detector':
        return <PhishingDetector />;
      case 'ip-intelligence':
        return <IPIntelligence />;
      default:
        return <SecurityDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-black to-green-900/20"></div>

      <div className="relative flex h-screen overflow-hidden">
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 fixed md:static inset-y-0 left-0 z-50 w-64 bg-gray-900/95 backdrop-blur-xl border-r border-cyan-500/30 transition-transform duration-300 flex flex-col animate-glow-pulse`}
        >
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="w-8 h-8 text-cyan-400 mr-3" />
                <h1 className="text-xl font-bold text-white">AxelleVault</h1>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <nav className="space-y-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      navigate(tool.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition ${
                      activeTool === tool.id
                        ? 'bg-gradient-to-r from-cyan-500/20 to-green-500/20 border border-cyan-500/50 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className="w-5 h-5 mr-3" />
                      <span className="text-sm font-medium">{tool.name}</span>
                    </div>
                    {activeTool === tool.id && <ChevronRight className="w-4 h-4" />}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="bg-gray-800/50 rounded-lg p-4 mb-3">
              <div className="flex items-center mb-2">
                <User className="w-5 h-5 text-cyan-400 mr-2" />
                <span className="text-sm text-white font-medium">
                  {profile?.username || 'User'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Security Score</span>
                <span className={`font-semibold ${
                  (profile?.security_score || 50) >= 80 ? 'text-green-400' :
                  (profile?.security_score || 50) >= 60 ? 'text-cyan-400' :
                  (profile?.security_score || 50) >= 40 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {profile?.security_score || 50}/100
                </span>
              </div>
            </div>

            <button
              onClick={signOut}
              className="w-full flex items-center justify-center px-4 py-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 hover:bg-red-500/20 transition"
            >
              <LogOut className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-gray-900/50 backdrop-blur-xl border-b border-cyan-500/30 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden mr-4 text-gray-400 hover:text-white"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {tools.find((t) => t.id === activeTool)?.name}
                  </h2>
                  <p className="text-sm text-gray-400">
                    Welcome back, {profile?.username || user?.email}
                  </p>
                </div>
              </div>

              <div className="hidden md:flex items-center space-x-4">
                <div className="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
                  <p className="text-xs text-gray-400">Total Logins</p>
                  <p className="text-lg font-semibold text-white">{profile?.total_logins || 0}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">{renderTool()}</div>
          </main>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};
