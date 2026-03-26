import { useState } from 'react';
import { Globe, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

interface IPInfo {
  ip: string;
  country: string;
  city: string;
  region: string;
  timezone: string;
  isp: string;
  latitude: number | null;
  longitude: number | null;
}

export const IPIntelligence = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [ip, setIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IPInfo | null>(null);
  const [error, setError] = useState('');

  const handleLookup = async () => {
    if (!ip) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await response.json();

      if (data.error) {
        setError(data.reason || 'Invalid IP address');
        showToast('error', data.reason || 'Invalid IP address');
      } else {
        const ipInfo: IPInfo = {
          ip: data.ip,
          country: data.country_name || 'Unknown',
          city: data.city || 'Unknown',
          region: data.region || 'Unknown',
          timezone: data.timezone || 'Unknown',
          isp: data.org || 'Unknown',
          latitude: Number.isFinite(data.latitude) ? data.latitude : null,
          longitude: Number.isFinite(data.longitude) ? data.longitude : null,
        };
        setResult(ipInfo);
        showToast('success', `IP lookup complete for ${ipInfo.ip}`);

        if (user) {
          await supabase.from('security_logs').insert({
            user_id: user.id,
            event_type: 'ip_lookup',
            event_data: { ip, country: ipInfo.country, city: ipInfo.city, isp: ipInfo.isp },
            risk_level: 'low',
          });

          await supabase.from('ip_lookups').insert({
            user_id: user.id,
            ip: ipInfo.ip,
            country: ipInfo.country,
            city: ipInfo.city,
            region: ipInfo.region,
            isp: ipInfo.isp,
            latitude: ipInfo.latitude,
            longitude: ipInfo.longitude,
          });
        }
      }
    } catch {
      setError('Failed to fetch IP information');
      showToast('error', 'Failed to fetch IP information');
    }

    setLoading(false);
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Globe className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">IP Intelligence</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            IP Address
          </label>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            placeholder="e.g., 8.8.8.8"
          />
        </div>

        <button
          onClick={handleLookup}
          disabled={!ip || loading}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30"
        >
          {loading ? 'Looking up...' : 'Lookup IP'}
        </button>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center mb-4">
              <MapPin className="w-5 h-5 text-cyan-400 mr-2" />
              <h4 className="text-lg font-semibold text-white">Location Information</h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">IP Address</p>
                <p className="text-sm font-semibold text-white">{result.ip}</p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Country</p>
                <p className="text-sm font-semibold text-white">{result.country}</p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">City</p>
                <p className="text-sm font-semibold text-white">{result.city}</p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Region</p>
                <p className="text-sm font-semibold text-white">{result.region}</p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Timezone</p>
                <p className="text-sm font-semibold text-white">{result.timezone}</p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">ISP</p>
                <p className="text-sm font-semibold text-white truncate" title={result.isp}>
                  {result.isp}
                </p>
              </div>
            </div>
            {result.latitude !== null && result.longitude !== null && (
              <div className="pt-2">
                <p className="mb-2 text-xs text-gray-500">Map Preview</p>
                <iframe
                  title="IP location map"
                  className="h-56 w-full rounded-lg border border-gray-700"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${result.longitude - 0.2}%2C${result.latitude - 0.2}%2C${result.longitude + 0.2}%2C${result.latitude + 0.2}&layer=mapnik&marker=${result.latitude}%2C${result.longitude}`}
                />
              </div>
            )}
          </div>
        )}

        {!result && !error && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Enter an IP address to view geolocation and ISP information
          </div>
        )}
      </div>
    </div>
  );
};
