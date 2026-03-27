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
  Mail,
  Search,
  Info,
  Lock,
  Brain,
  BarChart3,
  FileText,
  AlertTriangle,
  Settings as SettingsIcon,
} from 'lucide-react';
import { AdminPanel } from './AdminPanel';
import { Profile } from './Profile';
import { Settings } from './Settings';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { PasswordGenerator } from './tools/PasswordGenerator';
import { PasswordAnalyzer } from './tools/PasswordAnalyzer';
import { HashGenerator } from './tools/HashGenerator';
import { PhishingDetector } from './tools/PhishingDetector';
import { IPIntelligence } from './tools/IPIntelligence';
import { EmailBreachChecker } from './tools/EmailBreachChecker';
import { URLScanner } from './tools/URLScanner';
import { WhoisLookup } from './tools/WhoisLookup';
import { EncryptionTool } from './tools/EncryptionTool';
import { ThreatDetection } from './tools/ThreatDetection';
import { SecureNotesVault } from './tools/SecureNotesVault';
import { PortScanner } from './tools/PortScanner';
import { MalwareHashAnalyzer } from './tools/MalwareHashAnalyzer';
import { APIKeyStrengthChecker } from './tools/APIKeyStrengthChecker';
import { FileHashGenerator } from './tools/FileHashGenerator';
import { DNSLookupTool } from './tools/DNSLookupTool';
import { HTTPHeaderAnalyzer } from './tools/HTTPHeaderAnalyzer';
import { JWTDecoderValidator } from './tools/JWTDecoderValidator';
import { DarkWebExposureChecker } from './tools/DarkWebExposureChecker';
import { SSLCertificateChecker } from './tools/SSLCertificateChecker';
import { SecurityAnalytics } from './SecurityAnalytics';
import { SecurityDashboard } from './SecurityDashboard';
import { useLocation, useNavigate } from 'react-router-dom';

type Tool =
  | 'dashboard'
  | 'profile'
  | 'settings'
  | 'password-generator'
  | 'password-analyzer'
  | 'hash-generator'
  | 'phishing-detector'
  | 'ip-intelligence'
  | 'email-breach'
  | 'url-scanner'
  | 'whois'
  | 'encryption'
  | 'threat-detection'
  | 'analytics';

// ─── Custom Signout Modal ────────────────────────────────────────────────────
const SignOutModal = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    />
    {/* Modal */}
    <div className="relative bg-gray-900 border border-red-500/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-red-500/10 animate-fade-in">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Sign Out?</h3>
          <p className="text-sm text-gray-400 mt-1">
            Kya aap sach mein AxelleVault se logout karna chahte hain?
          </p>
        </div>
        <div className="flex gap-3 w-full mt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export const Dashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const tools = [
    { id: 'dashboard' as Tool, name: 'Security Dashboard', icon: Activity, path: '/dashboard' },
    { id: 'profile' as Tool, name: 'My Profile', icon: User, path: '/profile' },
    { id: 'settings' as Tool, name: 'Settings', icon: SettingsIcon, path: '/settings' },
    { id: 'password-generator' as Tool, name: 'Password Generator', icon: Key, path: '/tools/password-generator' },
    { id: 'password-analyzer' as Tool, name: 'Password Analyzer', icon: Shield, path: '/tools/password-analyzer' },
    { id: 'hash-generator' as Tool, name: 'Hash Tools', icon: Hash, path: '/tools/hash-generator' },
    { id: 'phishing-detector' as Tool, name: 'Phishing Detector', icon: Shield, path: '/tools/phishing-detector' },
    { id: 'ip-intelligence' as Tool, name: 'IP Intelligence', icon: Globe, path: '/tools/ip-intelligence' },
    { id: 'email-breach' as Tool, name: 'Email Breach Checker', icon: Mail, path: '/tools/email-breach' },
    { id: 'url-scanner' as Tool, name: 'URL Scanner', icon: Search, path: '/tools/url-scanner' },
    { id: 'whois' as Tool, name: 'WHOIS Lookup', icon: Info, path: '/tools/whois' },
    { id: 'encryption' as Tool, name: 'Encryption Tool', icon: Lock, path: '/tools/encryption' },
    { id: 'port-scanner' as Tool, name: 'Port Scanner', icon: Activity, path: '/tools/port-scanner' },
    { id: 'malware-hash' as Tool, name: 'Malware Hash Analyzer', icon: Hash, path: '/tools/malware-hash' },
    { id: 'apikey-strength' as Tool, name: 'API Key Strength Checker', icon: Key, path: '/tools/apikey-strength' },
    { id: 'file-hash' as Tool, name: 'File Hash Generator', icon: Hash, path: '/tools/file-hash' },
    { id: 'dns-lookup' as Tool, name: 'DNS Lookup', icon: Globe, path: '/tools/dns-lookup' },
    { id: 'http-header' as Tool, name: 'HTTP Header Analyzer', icon: Shield, path: '/tools/http-header' },
    { id: 'jwt-validator' as Tool, name: 'JWT Decoder/Validator', icon: Shield, path: '/tools/jwt-validator' },
    { id: 'darkweb' as Tool, name: 'Dark Web Exposure', icon: AlertTriangle, path: '/tools/darkweb' },
    { id: 'ssl-monitor' as Tool, name: 'SSL Certificate Checker', icon: Globe, path: '/tools/ssl-check' },
    { id: 'threat-detection' as Tool, name: 'AI Threat Detection', icon: Brain, path: '/tools/threat-detection' },
    { id: 'analytics' as Tool, name: 'Security Analytics', icon: BarChart3, path: '/analytics' },
    { id: 'secure-notes' as Tool, name: 'Secure Notes Vault', icon: FileText, path: '/tools/secure-notes' },
  ];

  const activeTool =
    tools.find((tool) => tool.path === location.pathname)?.id ??
    (location.pathname.startsWith('/tools') ? 'password-generator' : 'dashboard');

  const handleSignOut = async () => {
    setShowSignOutModal(false);

    try {
      await signOut();
      showToast('success', 'Successfully signed out.');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[Dashboard] signOut failed:', err);
      showToast('error', 'Failed to sign out. Please try again.');
    }
  };

  const renderTool = () => {
    switch (activeTool) {
      case 'dashboard':        return <SecurityDashboard />;
      case 'password-generator': return <PasswordGenerator />;
      case 'password-analyzer':  return <PasswordAnalyzer />;
      case 'hash-generator':     return <HashGenerator />;
      case 'phishing-detector':  return <PhishingDetector />;
      case 'ip-intelligence':    return <IPIntelligence />;
      case 'email-breach':       return <EmailBreachChecker />;
      case 'url-scanner':        return <URLScanner />;
      case 'whois':              return <WhoisLookup />;
      case 'encryption':         return <EncryptionTool />;
      case 'threat-detection':   return <ThreatDetection />;
      case 'port-scanner':       return <PortScanner />;
      case 'malware-hash':       return <MalwareHashAnalyzer />;
      case 'apikey-strength':    return <APIKeyStrengthChecker />;
      case 'file-hash':          return <FileHashGenerator />;
      case 'dns-lookup':         return <DNSLookupTool />;
      case 'http-header':        return <HTTPHeaderAnalyzer />;
      case 'jwt-validator':      return <JWTDecoderValidator />;
      case 'darkweb':            return <DarkWebExposureChecker />;
      case 'ssl-monitor':        return <SSLCertificateChecker />;
      case 'analytics':          return <SecurityAnalytics />;
      case 'secure-notes':       return <SecureNotesVault />;
      case 'profile':            return <Profile />;
      case 'settings':           return <Settings />;
      case 'admin-panel':        return <AdminPanel />;
      default:                  return <SecurityDashboard />;
    }
  };

  const activeToolName = tools.find((t) => t.id === activeTool)?.name ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-black to-green-900/20 pointer-events-none" />

      <div className="relative flex h-screen overflow-hidden">

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside
          className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
            fixed md:static inset-y-0 left-0 z-50
            w-[280px] md:w-64
            bg-gray-900/95 backdrop-blur-xl
            border-r border-cyan-500/30
            transition-transform duration-300
            flex flex-col
          `}
        >
          {/* Logo */}
          <div className="p-5 border-b border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-cyan-400 shrink-0" />
              <h1 className="text-xl font-bold text-white">AxelleVault</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    navigate(tool.path);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200
                    ${isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-green-500/20 border border-cyan-500/50 text-white shadow-lg shadow-cyan-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-cyan-400' : ''}`} />
                    <span className="text-sm font-medium truncate">{tool.name}</span>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </nav>

          {/* User + Signout */}
          <div className="p-3 border-t border-gray-800 shrink-0">
            <div className="bg-gray-800/60 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {profile?.username || user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                <span>Security Score</span>
                <span
                  className={`font-semibold ${
                    (profile?.security_score || 50) >= 80 ? 'text-green-400' :
                    (profile?.security_score || 50) >= 60 ? 'text-cyan-400' :
                    (profile?.security_score || 50) >= 40 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}
                >
                  {profile?.security_score || 50}/100
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-1.5">
                <div
                  className={`h-1 rounded-full transition-all duration-500 ${
                    (profile?.security_score || 50) >= 80 ? 'bg-green-500' :
                    (profile?.security_score || 50) >= 60 ? 'bg-cyan-500' :
                    (profile?.security_score || 50) >= 40 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${profile?.security_score || 50}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setShowSignOutModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/40 rounded-xl text-red-400 hover:bg-red-500/20 hover:border-red-500/60 transition text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Header */}
          <header className="bg-gray-900/50 backdrop-blur-xl border-b border-cyan-500/30 px-4 md:px-6 py-4 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {/* Hamburger — mobile only */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition shrink-0"
                  aria-label="Open sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h2 className="text-lg md:text-2xl font-bold text-white truncate">
                    {activeToolName}
                  </h2>
                  <p className="text-xs md:text-sm text-gray-400 truncate">
                    Welcome back,{' '}
                    <span className="text-cyan-400">
                      {profile?.username || user?.email?.split('@')[0] || 'User'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Stats — desktop */}
              <div className="hidden md:flex items-center gap-3 shrink-0">
                <div className="bg-gray-800/60 px-4 py-2 rounded-xl border border-gray-700/60">
                  <p className="text-xs text-gray-400">Total Logins</p>
                  <p className="text-lg font-semibold text-white">{profile?.total_logins || 0}</p>
                </div>
                <div className="bg-gray-800/60 px-4 py-2 rounded-xl border border-gray-700/60">
                  <p className="text-xs text-gray-400">Security Score</p>
                  <p className={`text-lg font-semibold ${
                    (profile?.security_score || 50) >= 80 ? 'text-green-400' :
                    (profile?.security_score || 50) >= 60 ? 'text-cyan-400' :
                    'text-yellow-400'
                  }`}>
                    {profile?.security_score || 50}/100
                  </p>
                </div>
              </div>

              {/* User dropdown - desktop */}
              <div className="hidden md:flex items-center relative">
                <button
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition"
                >
                  <User className="w-4 h-4" />
                  <span className="text-xs font-medium">{profile?.username || user?.email?.split('@')[0] || 'Account'}</span>
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-gray-900 border border-cyan-500/30 rounded-xl shadow-lg shadow-black/30 z-30">
                    <button
                      onClick={() => { setProfileMenuOpen(false); navigate('/profile'); }}
                      className="w-full text-left px-4 py-2 hover:bg-cyan-500/10 text-white"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => { setProfileMenuOpen(false); navigate('/settings'); }}
                      className="w-full text-left px-4 py-2 hover:bg-cyan-500/10 text-white"
                    >
                      Settings
                    </button>
                    <button
                      onClick={() => { setProfileMenuOpen(false); setShowSignOutModal(true); }}
                      className="w-full text-left px-4 py-2 hover:bg-red-500/10 text-red-300"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile signout shortcut */}
              <button
                onClick={() => setShowSignOutModal(true)}
                className="md:hidden p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition shrink-0"
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto">{renderTool()}</div>
          </main>
        </div>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Signout confirmation modal */}
      {showSignOutModal && (
        <SignOutModal
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOutModal(false)}
        />
      )}
    </div>
  );
};