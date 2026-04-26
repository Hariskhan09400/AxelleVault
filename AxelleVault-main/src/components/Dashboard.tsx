import { useState, useEffect } from 'react';
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
  MessageSquare,
  Terminal,
  Cpu,
  Zap,
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
import PortScanner from './tools/PortScanner'
import { MalwareHashAnalyzer } from './tools/MalwareHashAnalyzer';
import { APIKeyStrengthChecker } from './tools/APIKeyStrengthChecker';
import { FileHashGenerator } from './tools/FileHashGenerator';
import { DNSLookupTool } from './tools/DNSLookupTool';
import { HTTPHeaderAnalyzer } from './tools/HTTPHeaderAnalyzer';
import { JWTDecoderValidator } from './tools/JWTDecoderValidator';
import DarkWebExposureChecker from './tools/DarkWebExposureChecker';
import { SSLCertificateChecker } from './tools/SSLCertificateChecker';
import { SecurityAnalytics } from './SecurityAnalytics';
import { SecurityDashboard } from './SecurityDashboard';
import IPChat from './tools/ipchat';
import { useLocation, useNavigate } from 'react-router-dom';

type Tool =
  | 'dashboard'
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
  | 'analytics'
  | 'port-scanner'
  | 'malware-hash'
  | 'apikey-strength'
  | 'file-hash'
  | 'dns-lookup'
  | 'http-header'
  | 'jwt-validator'
  | 'darkweb'
  | 'ssl-monitor'
  | 'secure-notes'
  | 'ipchat'
  | 'profile'
  | 'settings'
  | 'admin-panel';

// ─── Tool Groups ─────────────────────────────────────────────────────────────
const toolGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { id: 'dashboard' as Tool, name: 'Security Dashboard', icon: Activity, path: '/dashboard' },
    ],
  },
  {
    label: 'PASSWORD TOOLS',
    items: [
      { id: 'password-generator' as Tool, name: 'Password Generator', icon: Key, path: '/tools/password-generator' },
      { id: 'password-analyzer' as Tool, name: 'Password Analyzer', icon: Shield, path: '/tools/password-analyzer' },
    ],
  },
  {
    label: 'NETWORK & WEB',
    items: [
      { id: 'ip-intelligence' as Tool, name: 'IP Intelligence', icon: Globe, path: '/tools/ip-intelligence' },
      { id: 'url-scanner' as Tool, name: 'URL Scanner', icon: Search, path: '/tools/url-scanner' },
      { id: 'whois' as Tool, name: 'WHOIS Lookup', icon: Info, path: '/tools/whois' },
      { id: 'dns-lookup' as Tool, name: 'DNS Lookup', icon: Globe, path: '/tools/dns-lookup' },
      { id: 'http-header' as Tool, name: 'HTTP Header Analyzer', icon: Shield, path: '/tools/http-header' },
      { id: 'port-scanner' as Tool, name: 'Port Scanner', icon: Activity, path: '/tools/port-scanner' },
      { id: 'ssl-monitor' as Tool, name: 'SSL Certificate Checker', icon: Lock, path: '/tools/ssl-check' },
      { id: 'ipchat' as Tool, name: 'IP Chat', icon: MessageSquare, path: '/tools/ipchat' },
    ],
  },
  {
    label: 'CRYPTO & HASH',
    items: [
      { id: 'hash-generator' as Tool, name: 'Hash Tools', icon: Hash, path: '/tools/hash-generator' },
      { id: 'encryption' as Tool, name: 'Encryption Tool', icon: Lock, path: '/tools/encryption' },
      { id: 'malware-hash' as Tool, name: 'Malware Hash Analyzer', icon: Hash, path: '/tools/malware-hash' },
      { id: 'file-hash' as Tool, name: 'File Hash Generator', icon: Hash, path: '/tools/file-hash' },
      { id: 'jwt-validator' as Tool, name: 'JWT Decoder/Validator', icon: Shield, path: '/tools/jwt-validator' },
      { id: 'apikey-strength' as Tool, name: 'API Key Strength', icon: Key, path: '/tools/apikey-strength' },
    ],
  },
  {
    label: 'THREAT INTEL',
    items: [
      { id: 'phishing-detector' as Tool, name: 'Phishing Detector', icon: AlertTriangle, path: '/tools/phishing-detector' },
      { id: 'email-breach' as Tool, name: 'Email Breach Checker', icon: Mail, path: '/tools/email-breach' },
      { id: 'darkweb' as Tool, name: 'Dark Web Exposure', icon: Terminal, path: '/tools/darkweb' },
      { id: 'threat-detection' as Tool, name: 'AI Threat Detection', icon: Brain, path: '/tools/threat-detection' },
    ],
  },
  {
    label: 'VAULT & ANALYTICS',
    items: [
      { id: 'secure-notes' as Tool, name: 'Secure Notes Vault', icon: FileText, path: '/tools/secure-notes' },
      { id: 'analytics' as Tool, name: 'Security Analytics', icon: BarChart3, path: '/analytics' },
    ],
  },
];

const allTools = toolGroups.flatMap((g) => g.items);

// ─── Sign Out Modal ───────────────────────────────────────────────────────────
const SignOutModal = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onCancel} />
    <div className="relative bg-gray-950 border border-red-500/30 rounded-2xl p-7 w-full max-w-sm shadow-2xl shadow-red-500/20">
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      </div>
      <div className="flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center relative">
          <AlertTriangle className="w-7 h-7 text-red-400" />
          <div className="absolute inset-0 rounded-full animate-ping bg-red-500/10" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white font-mono tracking-wider">[ SIGN OUT ]</h3>
          <p className="text-sm text-gray-500 mt-2">Terminate current secure session?</p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700/60 text-gray-300 hover:bg-gray-700 hover:text-white transition-all text-sm font-mono"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 hover:border-red-500/60 hover:text-red-300 transition-all text-sm font-mono"
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── User Menu Dropdown ───────────────────────────────────────────────────────
const UserMenu = ({
  username,
  onProfile,
  onSettings,
  onSignOut,
}: {
  username: string;
  onProfile: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 bg-gray-900/80 border border-cyan-500/20 rounded-xl px-3 py-2 text-gray-300 hover:text-white hover:border-cyan-500/50 transition-all group"
      >
        <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <span className="text-xs font-mono text-cyan-300 max-w-[120px] truncate">{username}</span>
        <Zap className={`w-3 h-3 transition-transform ${open ? 'rotate-180 text-cyan-400' : 'text-gray-600'}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-48 bg-gray-950 border border-cyan-500/20 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
            {[
              { label: 'My Profile', icon: User, action: onProfile },
              { label: 'Settings', icon: SettingsIcon, action: onSettings },
            ].map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                onClick={() => { setOpen(false); action(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-cyan-500/8 transition-colors text-sm font-mono border-b border-gray-800/60 last:border-0"
              >
                <Icon className="w-4 h-4 text-cyan-500/60" />
                {label}
              </button>
            ))}
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/8 transition-colors text-sm font-mono"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export const Dashboard = () => {
  // ✅ FIX 1: 'loading' ko useAuth se destructure karo
  const { user, profile, signOut, loading } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const activeTool =
    allTools.find((t) => t.path === location.pathname)?.id ??
    (location.pathname.startsWith('/tools') ? 'password-generator' : 'dashboard');

  const filteredToolGroups = searchQuery.trim()
    ? [
        {
          label: 'SEARCH RESULTS',
          items: allTools.filter((tool) =>
            tool.name.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        },
      ]
    : toolGroups;

  // ✅ FIX 2: loading check ke baad hi redirect karo — black screen gone
  useEffect(() => {
    if (!loading && user === null) {
      console.log('[Dashboard] User is null, redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  // ✅ FIX 3: Loading state mein proper UI dikhao, blank nahi
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a0e] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <Shield className="w-16 h-16 text-cyan-500/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-cyan-400 text-sm tracking-widest uppercase">Initializing Vault</p>
            <p className="text-gray-600 text-xs mt-1">Verifying secure session...</p>
          </div>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ✅ FIX 4: User null hai aur redirect ho raha hai toh blank return
  if (!user) return null;

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    try {
      showToast('success', 'Session terminating...');
      await signOut();
      await new Promise(resolve => setTimeout(resolve, 300));
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[Dashboard] signOut failed:', err);
      showToast('error', 'Sign out failed. Retry.');
      setTimeout(() => navigate('/login', { replace: true }), 1000);
    }
  };

  const renderTool = () => {
    switch (activeTool) {
      case 'dashboard':          return <SecurityDashboard />;
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
      case 'secure-notes':       return <SecureNotesVault userId={user?.id} userEmail={user?.email} />;
      case 'ipchat':             return <IPChat />;
      case 'profile':            return <Profile />;
      case 'settings':           return <Settings />;
      case 'admin-panel':        return <AdminPanel />;
      default:                   return <SecurityDashboard />;
    }
  };

  const activeToolName = allTools.find((t) => t.id === activeTool)?.name ?? 'Security Dashboard';
  const username = profile?.username || user?.email?.split('@')[0] || 'operator';
  const secScore = profile?.security_score ?? 50;
  const scoreColor =
    secScore >= 80 ? 'text-green-400' :
    secScore >= 60 ? 'text-cyan-400' :
    secScore >= 40 ? 'text-yellow-400' : 'text-red-400';
  const scoreBarColor =
    secScore >= 80 ? 'bg-green-500' :
    secScore >= 60 ? 'bg-cyan-500' :
    secScore >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-[#050a0e] font-mono">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-green-500/4 rounded-full blur-3xl" />
      </div>

      <div className="relative flex h-screen overflow-hidden">

        {/* ── SIDEBAR ── */}
        <aside
          className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
            fixed md:static inset-y-0 left-0 z-50
            w-72 md:w-64
            bg-gray-950/98 backdrop-blur-xl
            border-r border-cyan-500/15
            transition-transform duration-300 ease-in-out
            flex flex-col
          `}
        >
          {/* Logo */}
          <div className="px-5 py-4 border-b border-gray-800/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Shield className="w-8 h-8 text-cyan-400" />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-gray-950 animate-pulse" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-widest">AXELLE<span className="text-cyan-400">VAULT</span></h1>
                <p className="text-[10px] text-gray-600 tracking-widest">CYBER SECURITY</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-2 py-3 border-b border-gray-800/80 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900/60 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:bg-gray-900 transition-all"
              />
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-800">
            {filteredToolGroups.length > 0 ? (
              filteredToolGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 mb-1.5 text-[10px] font-bold text-gray-600 tracking-[0.2em]">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.items.map((tool) => {
                      const Icon = tool.icon;
                      const isActive = activeTool === tool.id;
                      return (
                        <button
                          key={tool.id}
                          onClick={() => { navigate(tool.path); setSidebarOpen(false); }}
                          className={`
                            w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-150 group
                            ${isActive
                              ? 'bg-cyan-500/10 border border-cyan-500/30 text-white'
                              : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                            <span className="text-xs truncate">{tool.name}</span>
                          </div>
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 animate-pulse" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-8 text-center">
                <Search className="w-8 h-8 text-gray-700 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-gray-600">No tools found</p>
                <p className="text-[10px] text-gray-700 mt-1">Try different keywords</p>
              </div>
            )}
          </nav>

          {/* Bottom */}
          <div className="shrink-0 border-t border-gray-800/80 p-3 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => { navigate('/profile'); setSidebarOpen(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-all border
                  ${activeTool === 'profile' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'bg-gray-900/60 border-gray-800/60 text-gray-400 hover:text-white hover:border-gray-700'}`}
              >
                <User className="w-3.5 h-3.5" /> Profile
              </button>
              <button
                onClick={() => { navigate('/settings'); setSidebarOpen(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-all border
                  ${activeTool === 'settings' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'bg-gray-900/60 border-gray-800/60 text-gray-400 hover:text-white hover:border-gray-700'}`}
              >
                <SettingsIcon className="w-3.5 h-3.5" /> Settings
              </button>
            </div>

            <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white font-semibold truncate">{username}</p>
                  <p className="text-[10px] text-gray-600 truncate">{user?.email}</p>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-gray-600 tracking-wider">SEC SCORE</span>
                  <span className={`font-bold ${scoreColor}`}>{secScore}/100</span>
                </div>
                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${scoreBarColor}`} style={{ width: `${secScore}%` }} />
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSignOutModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/8 border border-red-500/25 text-red-500 hover:bg-red-500/15 hover:border-red-500/45 hover:text-red-400 transition-all text-xs tracking-widest"
            >
              <LogOut className="w-3.5 h-3.5" /> SIGN OUT
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="bg-gray-950/90 backdrop-blur-xl border-b border-cyan-500/10 px-4 md:px-6 py-3.5 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition shrink-0">
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-cyan-500/60 tracking-widest hidden sm:block">AXELLEVAULT //</span>
                    <h2 className="text-sm md:text-base font-bold text-white tracking-wider truncate uppercase">{activeToolName}</h2>
                  </div>
                  <p className="text-[11px] text-gray-600 truncate">operator: <span className="text-cyan-500/80">{username}</span></p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden lg:flex items-center gap-2">
                  <div className="bg-gray-900/80 border border-gray-800/60 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-[9px] text-gray-600 tracking-widest">LOGINS</p>
                    <p className="text-sm font-bold text-white">{profile?.total_logins ?? 0}</p>
                  </div>
                  <div className="bg-gray-900/80 border border-gray-800/60 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-[9px] text-gray-600 tracking-widest">SEC SCORE</p>
                    <p className={`text-sm font-bold ${scoreColor}`}>{secScore}/100</p>
                  </div>
                </div>
                <div className="hidden md:block">
                  <UserMenu
                    username={username}
                    onProfile={() => navigate('/profile')}
                    onSettings={() => navigate('/settings')}
                    onSignOut={() => setShowSignOutModal(true)}
                  />
                </div>
                <button onClick={() => setShowSignOutModal(true)} className="md:hidden p-2 rounded-lg text-red-500/70 hover:bg-red-500/10 hover:text-red-400 transition">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-[#050a0e] p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              {renderTool()}
            </div>
          </main>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {showSignOutModal && (
        <SignOutModal onConfirm={handleSignOut} onCancel={() => setShowSignOutModal(false)} />
      )}
    </div>
  );
};