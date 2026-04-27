import { useState, useEffect, useRef } from 'react';
import {
  Globe, MapPin, Shield, Search, Clock, Server,
  AlertTriangle, CheckCircle, XCircle, Copy, Trash2,
  ChevronDown, ChevronUp, Loader2, Wifi, Database,
  FileText, List, History, Download
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IPInfo {
  ip: string;
  country: string;
  country_code: string;
  city: string;
  region: string;
  timezone: string;
  isp: string;
  org: string;
  asn: string;
  latitude: number | null;
  longitude: number | null;
  continent: string;
  mobile: boolean;
  proxy: boolean;
  hosting: boolean;
}

interface RiskInfo {
  score: number;
  is_vpn: boolean;
  is_tor: boolean;
  is_proxy: boolean;
  is_datacenter: boolean;
  abuse_confidence: number;
  threat_level: 'low' | 'medium' | 'high' | 'critical';
}

interface DNSRecord {
  type: string;
  value: string;
  ttl?: number;
}

interface WhoisInfo {
  domain?: string;
  registrar?: string;
  created?: string;
  expires?: string;
  country?: string;
  org?: string;
  raw: string;
}

interface HistoryEntry {
  ip: string;
  country: string;
  city: string;
  isp: string;
  timestamp: string;
  threat_level: string;
}

type ActiveTab = 'overview' | 'risk' | 'whois' | 'dns' | 'bulk' | 'history';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',  label: 'Overview',  icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'risk',      label: 'Risk Score', icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'whois',     label: 'WHOIS',      icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'dns',       label: 'DNS Records', icon: <Server className="w-3.5 h-3.5" /> },
  { id: 'bulk',      label: 'Bulk Lookup', icon: <List className="w-3.5 h-3.5" /> },
  { id: 'history',   label: 'History',    icon: <History className="w-3.5 h-3.5" /> },
];

const DNS_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function threatColor(level: string) {
  switch (level) {
    case 'low':      return 'text-emerald-400';
    case 'medium':   return 'text-yellow-400';
    case 'high':     return 'text-orange-400';
    case 'critical': return 'text-red-400';
    default:         return 'text-gray-400';
  }
}

function threatBg(level: string) {
  switch (level) {
    case 'low':      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    case 'medium':   return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    case 'high':     return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    case 'critical': return 'bg-red-500/10 border-red-500/30 text-red-400';
    default:         return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
  }
}

function scoreColor(score: number) {
  if (score < 25)  return '#10b981';
  if (score < 50)  return '#f59e0b';
  if (score < 75)  return '#f97316';
  return '#ef4444';
}

function calcThreat(risk: Partial<RiskInfo>): 'low' | 'medium' | 'high' | 'critical' {
  const score = risk.score ?? 0;
  if (risk.is_tor) return 'critical';
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow = ({
  label, value, mono = false, copyable = false,
}: {
  label: string; value: string | React.ReactNode; mono?: boolean; copyable?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (typeof value === 'string') {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-700/50 last:border-0 group">
      <span className="text-xs text-gray-500 uppercase tracking-wider min-w-[130px] pt-0.5">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm text-white text-right ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
        {copyable && typeof value === 'string' && (
          <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
            {copied
              ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              : <Copy className="w-3.5 h-3.5 text-gray-500 hover:text-cyan-400" />}
          </button>
        )}
      </div>
    </div>
  );
};

const Badge = ({ value, good }: { value: boolean; good: boolean }) => (
  value === good
    ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Yes</span>
    : <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" /> No</span>
);

const RiskBar = ({ label, value, max = 100 }: { label: string; value: number; max?: number }) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono" style={{ color: scoreColor((value / max) * 100) }}>{value}/{max}</span>
    </div>
    <div className="h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: scoreColor((value / max) * 100) }}
      />
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const IPIntelligence = () => {
  const [ip, setIp]                 = useState('');
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState<ActiveTab>('overview');
  const [error, setError]           = useState('');

  // Results
  const [ipInfo, setIpInfo]         = useState<IPInfo | null>(null);
  const [riskInfo, setRiskInfo]     = useState<RiskInfo | null>(null);
  const [whoisInfo, setWhoisInfo]   = useState<WhoisInfo | null>(null);
  const [dnsRecords, setDnsRecords] = useState<Record<string, DNSRecord[]>>({});
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsTarget, setDnsTarget]   = useState('');
  const [dnsInput, setDnsInput]     = useState('');

  // Bulk
  const [bulkInput, setBulkInput]   = useState('');
  const [bulkResults, setBulkResults] = useState<{ ip: string; info: IPInfo | null; error?: string }[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // History
  const [history, setHistory]       = useState<HistoryEntry[]>([]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ip_intel_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const saveToHistory = (info: IPInfo, threat: string) => {
    const entry: HistoryEntry = {
      ip: info.ip,
      country: info.country,
      city: info.city,
      isp: info.isp,
      timestamp: new Date().toISOString(),
      threat_level: threat,
    };
    setHistory(prev => {
      const updated = [entry, ...prev.filter(h => h.ip !== info.ip)].slice(0, 50);
      try { localStorage.setItem('ip_intel_history', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // ── IP Lookup ──────────────────────────────────────────────────────────────

  const handleLookup = async (targetIp?: string) => {
    const target = (targetIp ?? ip).trim();
    if (!target) return;
    setLoading(true);
    setError('');
    setIpInfo(null);
    setRiskInfo(null);
    setWhoisInfo(null);
    setDnsRecords({});

    try {
      // Primary: ipwho.is — free, HTTPS, no API key needed
      const res = await fetch(`https://ipwho.is/${encodeURIComponent(target)}`);
      const d = await res.json();

      if (!d.success) {
        // Fallback: ipapi.co — also free + HTTPS
        try {
          const res2 = await fetch(`https://ipapi.co/${encodeURIComponent(target)}/json/`);
          const d2 = await res2.json();
          if (d2.error) {
            setError(d2.reason || 'Invalid IP or domain');
            setLoading(false);
            return;
          }
          const info: IPInfo = {
            ip: d2.ip,
            country: d2.country_name || 'Unknown',
            country_code: d2.country_code || '',
            city: d2.city || 'Unknown',
            region: d2.region || 'Unknown',
            timezone: d2.timezone || 'Unknown',
            isp: d2.org || 'Unknown',
            org: d2.org || 'Unknown',
            asn: d2.asn || 'Unknown',
            latitude: typeof d2.latitude === 'number' ? d2.latitude : null,
            longitude: typeof d2.longitude === 'number' ? d2.longitude : null,
            continent: d2.continent_code || 'Unknown',
            mobile: false,
            proxy: false,
            hosting: false,
          };
          setIpInfo(info);
          const score = 5;
          const risk: RiskInfo = {
            score, is_vpn: false, is_tor: false, is_proxy: false,
            is_datacenter: false, abuse_confidence: score,
            threat_level: calcThreat({ score }),
          };
          setRiskInfo(risk);
          saveToHistory(info, risk.threat_level);
          setLoading(false);
          return;
        } catch {
          setError('Failed to fetch IP information. Check your connection.');
          setLoading(false);
          return;
        }
      }

      const info: IPInfo = {
        ip: d.ip,
        country: d.country || 'Unknown',
        country_code: d.country_code || '',
        city: d.city || 'Unknown',
        region: d.region || 'Unknown',
        timezone: d.timezone?.id || 'Unknown',
        isp: d.connection?.isp || d.connection?.org || 'Unknown',
        org: d.connection?.org || 'Unknown',
        asn: d.connection?.asn ? `AS${d.connection.asn}` : 'Unknown',
        latitude: typeof d.latitude === 'number' ? d.latitude : null,
        longitude: typeof d.longitude === 'number' ? d.longitude : null,
        continent: d.continent || 'Unknown',
        mobile: d.type === 'mobile',
        proxy: d.security?.is_proxy || false,
        hosting: d.type === 'hosting' || d.security?.is_datacenter || false,
      };
      setIpInfo(info);

      // Build risk from ipwho.is security field
      const sec = d.security || {};
      const isProxy   = !!sec.is_proxy;
      const isTor     = !!sec.is_tor;
      const isDC      = !!sec.is_datacenter;
      const isVPN     = !!sec.is_vpn;
      const abuseScore = isTor ? 90 : isProxy || isVPN ? 65 : isDC ? 30 : 5;

      const risk: RiskInfo = {
        score: abuseScore,
        is_vpn: isVPN,
        is_tor: isTor,
        is_proxy: isProxy,
        is_datacenter: isDC,
        abuse_confidence: abuseScore,
        threat_level: calcThreat({ score: abuseScore, is_tor: isTor }),
      };
      setRiskInfo(risk);
      saveToHistory(info, risk.threat_level);
    } catch {
      setError('Failed to fetch IP information. Check your connection.');
    }
    setLoading(false);
  };

  // ── My IP ──────────────────────────────────────────────────────────────────

  const getMyIP = async () => {
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      const d = await r.json();
      setIp(d.ip);
      handleLookup(d.ip);
    } catch {
      setError('Could not detect your IP.');
    }
  };

  // ── DNS Lookup ────────────────────────────────────────────────────────────

  const handleDNS = async () => {
    const target = dnsInput.trim();
    if (!target) return;
    setDnsLoading(true);
    setDnsTarget(target);
    setDnsRecords({});

    const results: Record<string, DNSRecord[]> = {};
    await Promise.all(
      DNS_TYPES.map(async (type) => {
        try {
          const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(target)}&type=${type}`);
          const d = await r.json();
          if (d.Answer?.length) {
            results[type] = d.Answer.map((a: { data: string; TTL: number }) => ({
              type,
              value: a.data,
              ttl: a.TTL,
            }));
          }
        } catch {}
      })
    );
    setDnsRecords(results);
    setDnsLoading(false);
  };

  // ── WHOIS ──────────────────────────────────────────────────────────────────

  const handleWhois = async () => {
    if (!ipInfo) return;
    try {
      const r = await fetch(
        `https://api.allorigins.win/get?url=${encodeURIComponent(`https://rdap.arin.net/registry/ip/${ipInfo.ip}`)}`
      );
      const d = await r.json();
      if (d?.contents) {
        const data = JSON.parse(d.contents);
        const org = data.entities?.find((e: { roles: string[] }) => e.roles?.includes('registrant'))?.vcardArray?.[1];
        const orgName = org?.find((f: [string, unknown, string, string]) => f[0] === 'fn')?.[3] ?? 'Unknown';
        const country = data.country ?? ipInfo.country;
        const startAddress = data.startAddress ?? '';
        const endAddress = data.endAddress ?? '';

        setWhoisInfo({
          org: orgName,
          country,
          raw: `Network: ${data.name ?? 'N/A'}\nHandle: ${data.handle ?? 'N/A'}\nStart: ${startAddress}\nEnd: ${endAddress}\nType: ${data.type ?? 'N/A'}\nCountry: ${country}\nOrg: ${orgName}`,
        });
      }
    } catch {
      // fallback minimal whois from existing data
      setWhoisInfo({
        org: ipInfo.org,
        country: ipInfo.country,
        raw: `IP: ${ipInfo.ip}\nOrg: ${ipInfo.org}\nASN: ${ipInfo.asn}\nCountry: ${ipInfo.country}\nISP: ${ipInfo.isp}`,
      });
    }
  };

  // Trigger whois when tab opened and result available
  useEffect(() => {
    if (activeTab === 'whois' && ipInfo && !whoisInfo) {
      handleWhois();
    }
  }, [activeTab, ipInfo]);

  // ── Bulk Lookup ────────────────────────────────────────────────────────────

  const handleBulk = async () => {
    const ips = bulkInput
      .split(/[\n,\s]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (!ips.length) return;
    setBulkLoading(true);
    setBulkResults([]);

    const results: { ip: string; info: IPInfo | null; error?: string }[] = [];
    for (const target of ips) {
      try {
        const r = await fetch(`https://ipwho.is/${encodeURIComponent(target)}`);
        const d = await r.json();
        if (!d.success) {
          results.push({ ip: target, info: null, error: d.message || 'Invalid IP' });
        } else {
          results.push({
            ip: target,
            info: {
              ip: d.ip, country: d.country, country_code: d.country_code,
              city: d.city, region: d.region, timezone: d.timezone?.id || '',
              isp: d.connection?.isp || d.connection?.org || 'Unknown',
              org: d.connection?.org || 'Unknown',
              asn: d.connection?.asn ? `AS${d.connection.asn}` : 'Unknown',
              latitude: typeof d.latitude === 'number' ? d.latitude : null,
              longitude: typeof d.longitude === 'number' ? d.longitude : null,
              continent: d.continent || '', mobile: d.type === 'mobile',
              proxy: d.security?.is_proxy || false,
              hosting: d.type === 'hosting' || d.security?.is_datacenter || false,
            },
          });
        }
        await new Promise(res => setTimeout(res, 200));
      } catch {
        results.push({ ip: target, info: null, error: 'Request failed' });
      }
    }
    setBulkResults(results);
    setBulkLoading(false);
  };

  const exportBulk = () => {
    const csv = [
      'IP,Country,City,ISP,Proxy,Hosting,Error',
      ...bulkResults.map(r =>
        r.info
          ? `${r.ip},"${r.info.country}","${r.info.city}","${r.info.isp}",${r.info.proxy},${r.info.hosting},`
          : `${r.ip},,,,,,${r.error ?? ''}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ip_bulk_results.csv';
    a.click();
  };

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem('ip_intel_history'); } catch {}
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-6 xl:p-8 shadow-2xl w-full min-h-[500px] flex flex-col">

      {/* ── Header ── */}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-cyan-400" />
          <div>
            <h3 className="text-xl font-semibold text-white tracking-tight">IP Intelligence</h3>
            <p className="text-xs text-gray-500 font-mono">Advanced network reconnaissance tool</p>
          </div>
        </div>
        {riskInfo && (
          <span className={`text-xs px-3 py-1 rounded-full border font-mono uppercase tracking-wider ${threatBg(riskInfo.threat_level)}`}>
            {riskInfo.threat_level} risk
          </span>
        )}
      </div>

      {/* ── Search Bar ── */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={ip}
            onChange={e => setIp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            placeholder="e.g., 8.8.8.8 or domain.com"
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-9 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono text-sm transition-colors"
          />
        </div>
        <button
          onClick={() => handleLookup()}
          disabled={!ip || loading}
          className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/20 text-sm whitespace-nowrap"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup IP'}
        </button>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={getMyIP} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-mono">
          ↳ Use my IP
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: OVERVIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {!ipInfo && !loading && (
            <div className="text-center py-12 text-gray-600 text-sm font-mono">
              [ Enter an IP address to begin analysis ]
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-3 py-12 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="font-mono text-sm">Fetching data...</span>
            </div>
          )}
          {ipInfo && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">

              {/* Basic Info */}
              <div className="bg-gray-800/40 border border-gray-700/60 rounded-lg p-4">
                <p className="text-xs text-cyan-400 font-mono uppercase tracking-widest mb-3">Basic Info</p>
                <InfoRow label="IP Address"  value={ipInfo.ip}         mono copyable />
                <InfoRow label="Country"     value={`${ipInfo.country_code ? `[${ipInfo.country_code}] ` : ''}${ipInfo.country}`} />
                <InfoRow label="City"        value={ipInfo.city} />
                <InfoRow label="Region"      value={ipInfo.region} />
                <InfoRow label="Continent"   value={ipInfo.continent} />
                <InfoRow label="Timezone"    value={ipInfo.timezone} mono />
              </div>

              {/* Network */}
              <div className="bg-gray-800/40 border border-gray-700/60 rounded-lg p-4">
                <p className="text-xs text-cyan-400 font-mono uppercase tracking-widest mb-3">Network</p>
                <InfoRow label="ISP"         value={ipInfo.isp} />
                <InfoRow label="Org"         value={ipInfo.org} />
                <InfoRow label="ASN"         value={ipInfo.asn} mono copyable />
                <InfoRow label="Mobile"      value={<Badge value={ipInfo.mobile} good={true} />} />
                <InfoRow label="Proxy / VPN" value={ipInfo.proxy ? <span className="flex items-center gap-1 text-red-400 text-xs"><AlertTriangle className="w-3.5 h-3.5" /> Detected</span> : <span className="text-emerald-400 text-xs">Clean</span>} />
                <InfoRow label="Datacenter"  value={ipInfo.hosting ? <span className="text-yellow-400 text-xs">Yes</span> : <span className="text-emerald-400 text-xs">No</span>} />
              </div>

              {/* Map */}
              {ipInfo.latitude !== null && ipInfo.longitude !== null && (
                <div className="lg:col-span-2 xl:col-span-3 bg-gray-800/40 border border-gray-700/60 rounded-lg p-4">
                  <p className="text-xs text-cyan-400 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" /> Map Preview
                  </p>
                  <iframe
                    title="IP location map"
                    className="w-full h-64 rounded-lg border border-gray-700"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${ipInfo.longitude - 0.3}%2C${ipInfo.latitude - 0.3}%2C${ipInfo.longitude + 0.3}%2C${ipInfo.latitude + 0.3}&layer=mapnik&marker=${ipInfo.latitude}%2C${ipInfo.longitude}`}
                  />
                  <p className="text-xs text-gray-600 mt-2 font-mono">
                    Coords: {ipInfo.latitude.toFixed(4)}, {ipInfo.longitude.toFixed(4)} — approximate location
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: RISK SCORE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'risk' && (
        <div className="space-y-4">
          {!riskInfo ? (
            <div className="text-center py-12 text-gray-600 text-sm font-mono">
              [ Run an IP lookup first ]
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Score gauge */}
              <div className="bg-gray-800/40 border border-gray-700/60 rounded-lg p-5 flex flex-col items-center">
                <p className="text-xs text-cyan-400 font-mono uppercase tracking-widest mb-4">Threat Score</p>
                <div className="relative w-36 h-36 mb-4">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#1f2937" strokeWidth="10"/>
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke={scoreColor(riskInfo.score)}
                      strokeWidth="10"
                      strokeDasharray={`${riskInfo.score * 2.51} 251`}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white font-mono">{riskInfo.score}</span>
                    <span className="text-xs text-gray-500">/100</span>
                  </div>
                </div>
                <span className={`text-sm font-semibold uppercase tracking-wider ${threatColor(riskInfo.threat_level)}`}>
                  {riskInfo.threat_level} Risk
                </span>
              </div>

              {/* Indicators */}
              <div className="bg-gray-800/40 border border-gray-700/60 rounded-lg p-4">
                <p className="text-xs text-cyan-400 font-mono uppercase tracking-widest mb-4">Threat Indicators</p>
                <InfoRow label="VPN Detected"   value={riskInfo.is_vpn ? <span className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/>Yes</span> : <span className="text-emerald-400 text-xs">Clean</span>} />
                <InfoRow label="Tor Exit Node"  value={riskInfo.is_tor ? <span className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/>Yes</span> : <span className="text-emerald-400 text-xs">No</span>} />
                <InfoRow label="Proxy"          value={riskInfo.is_proxy ? <span className="text-orange-400 text-xs">Detected</span> : <span className="text-emerald-400 text-xs">No</span>} />
                <InfoRow label="Datacenter IP"  value={riskInfo.is_datacenter ? <span className="text-yellow-400 text-xs">Yes</span> : <span className="text-emerald-400 text-xs">No</span>} />
              </div>

              {/* Risk bars */}
              <div className="lg:col-span-2 xl:col-span-3 bg-gray-800/40 border border-gray-700/60 rounded-lg p-4">
                <p className="text-xs text-cyan-400 font-mono uppercase tracking-widest mb-4">Score Breakdown</p>
                <RiskBar label="Abuse Confidence"  value={riskInfo.abuse_confidence} />
                <RiskBar label="Overall Threat"    value={riskInfo.score} />
                <RiskBar label="Proxy / Anonymizer" value={riskInfo.is_proxy ? 80 : riskInfo.is_vpn ? 60 : 5} />
                <RiskBar label="Botnet / Malware"  value={riskInfo.is_tor ? 90 : riskInfo.score > 50 ? 40 : 5} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: WHOIS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'whois' && (
        <div className="space-y-4">
          {!ipInfo ? (
            <div className="text-center py-12 text-gray-600 text-sm font-mono">[ Run an IP lookup first ]</div>
          ) : !whoisInfo ? (
            <div className="flex items-center justify-center gap-3 py-12 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="font-mono text-sm">Fetching WHOIS data...</span>
            </div>
          ) : (
            <div className="bg-gray-800/40 border border-gray-700/60 rounded-lg p-4">
              <p className="text-xs text-cyan-400 font-mono uppercase tracking-widest mb-4">WHOIS / RDAP Record</p>
              {whoisInfo.org     && <InfoRow label="Organization" value={whoisInfo.org} />}
              {whoisInfo.country && <InfoRow label="Country"      value={whoisInfo.country} />}
              {whoisInfo.registrar && <InfoRow label="Registrar"  value={whoisInfo.registrar} />}
              {whoisInfo.created   && <InfoRow label="Created"    value={whoisInfo.created} mono />}
              {whoisInfo.expires   && <InfoRow label="Expires"    value={whoisInfo.expires} mono />}
              <div className="mt-4">
                <p className="text-xs text-gray-500 font-mono mb-2">Raw Record</p>
                <pre className="bg-gray-900/60 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap border border-gray-700/40">
                  {whoisInfo.raw}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: DNS RECORDS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dns' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={dnsInput}
              onChange={e => setDnsInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDNS()}
              placeholder="e.g., google.com"
              className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono text-sm"
            />
            <button
              onClick={handleDNS}
              disabled={!dnsInput || dnsLoading}
              className="bg-gradient-to-r from-cyan-500 to-emerald-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg text-sm"
            >
              {dnsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup DNS'}
            </button>
          </div>

          {dnsLoading && (
            <div className="flex items-center gap-3 py-6 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span className="font-mono text-sm">Querying {DNS_TYPES.join(', ')} records...</span>
            </div>
          )}

          {!dnsLoading && Object.keys(dnsRecords).length > 0 && (
            <div className="space-y-3">
              {DNS_TYPES.filter(t => dnsRecords[t]?.length).map(type => (
                <div key={type} className="bg-gray-800/40 border border-gray-700/60 rounded-lg p-4">
                  <p className="text-xs font-mono font-bold text-cyan-400 mb-2 uppercase">{type} Records</p>
                  {dnsRecords[type].map((rec, i) => (
                    <div key={i} className="flex justify-between items-start py-1.5 border-b border-gray-700/40 last:border-0 gap-4">
                      <code className="text-sm text-gray-200 font-mono break-all flex-1">{rec.value}</code>
                      {rec.ttl !== undefined && (
                        <span className="text-xs text-gray-600 font-mono whitespace-nowrap">TTL {rec.ttl}s</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {!dnsLoading && dnsTarget && Object.keys(dnsRecords).length === 0 && (
            <div className="text-center py-8 text-gray-600 font-mono text-sm">
              No DNS records found for {dnsTarget}
            </div>
          )}

          {!dnsTarget && (
            <div className="text-center py-10 text-gray-600 text-sm font-mono">
              [ Enter a domain to fetch A, AAAA, MX, NS, TXT, CNAME, SOA records ]
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: BULK LOOKUP
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bulk' && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 font-mono mb-2">Paste IPs (one per line, comma or space separated — max 20)</p>
            <textarea
              value={bulkInput}
              onChange={e => setBulkInput(e.target.value)}
              placeholder={"8.8.8.8\n1.1.1.1\n208.67.222.222"}
              rows={5}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono text-sm resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulk}
              disabled={!bulkInput.trim() || bulkLoading}
              className="bg-gradient-to-r from-cyan-500 to-emerald-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2"
            >
              {bulkLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : 'Analyze All'}
            </button>
            {bulkResults.length > 0 && (
              <button
                onClick={exportBulk}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 px-4 py-2.5 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            )}
          </div>

          {bulkResults.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-700/40">
              <table className="w-full text-xs font-mono min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900/60">
                    {['IP', 'Country', 'City', 'ISP', 'Proxy', 'DC', 'Status'].map(h => (
                      <th key={h} className="text-left py-2.5 px-4 text-gray-500 uppercase tracking-widest font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors">
                      <td className="py-2.5 px-4 text-cyan-400 font-mono">{r.ip}</td>
                      <td className="py-2.5 px-4 text-gray-300">{r.info?.country ?? '—'}</td>
                      <td className="py-2.5 px-4 text-gray-300">{r.info?.city ?? '—'}</td>
                      <td className="py-2.5 px-4 text-gray-400 max-w-[200px] truncate">{r.info?.isp ?? '—'}</td>
                      <td className="py-2.5 px-4">{r.info ? (r.info.proxy ? <span className="text-red-400">Yes</span> : <span className="text-emerald-400">No</span>) : '—'}</td>
                      <td className="py-2.5 px-4">{r.info ? (r.info.hosting ? <span className="text-yellow-400">Yes</span> : <span className="text-emerald-400">No</span>) : '—'}</td>
                      <td className="py-2.5 px-4">
                        {r.error
                          ? <span className="text-red-400">Error</span>
                          : <span className="text-emerald-400">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: HISTORY
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-mono">{history.length} recent lookups</p>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm font-mono">
              [ No lookup history yet ]
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div
                  key={i}
                  onClick={() => { setIp(h.ip); handleLookup(h.ip); setActiveTab('overview'); }}
                  className="flex items-center justify-between bg-gray-800/40 border border-gray-700/40 rounded-lg px-5 py-3.5 hover:border-cyan-500/30 hover:bg-gray-800/60 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Wifi className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 transition-colors" />
                    <div>
                      <p className="text-sm font-mono text-white">{h.ip}</p>
                      <p className="text-xs text-gray-500">{h.city}, {h.country} — {h.isp}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono uppercase ${threatColor(h.threat_level)}`}>{h.threat_level}</span>
                    <span className="text-xs text-gray-600 font-mono hidden sm:block">
                      {new Date(h.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};