import { useState } from 'react';
import { Globe, Info, Search, Calendar, MapPin, Building } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface WhoisResult {
  domain: string;
  registrar: string;
  expiryDate: string;
  country: string;
  createdDate: string;
  status: string;
}

export const WhoisLookup = () => {
  const { user } = useAuth();
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<WhoisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const lookupWhois = async () => {
    if (!domain.trim()) return;

    setLoading(true);

    // Mock WHOIS data - in real app, use WHOIS API
    const mockData: Record<string, WhoisResult> = {
      'google.com': {
        domain: 'google.com',
        registrar: 'MarkMonitor Inc.',
        expiryDate: '2024-09-14',
        country: 'United States',
        createdDate: '1997-09-15',
        status: 'Active',
      },
      'github.com': {
        domain: 'github.com',
        registrar: 'GoDaddy.com, LLC',
        expiryDate: '2024-10-09',
        country: 'United States',
        createdDate: '2007-10-09',
        status: 'Active',
      },
      'example.com': {
        domain: 'example.com',
        registrar: 'RESERVED-INTERNET ASSIGNED NUMBERS AUTHORITY',
        expiryDate: '2024-08-14',
        country: 'United States',
        createdDate: '1992-01-01',
        status: 'Reserved',
      },
    };

    // Default mock data for unknown domains
    const defaultData: WhoisResult = {
      domain: domain.toLowerCase(),
      registrar: 'Unknown Registrar',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      country: 'Unknown',
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Active',
    };

    const whoisResult = mockData[domain.toLowerCase()] || defaultData;
    setResult(whoisResult);

    if (user) {
      await supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'whois_lookup',
        event_data: { domain: domain.toLowerCase() },
        risk_level: 'low',
      });
    }

    setLoading(false);
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Globe className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">WHOIS Lookup</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Domain Name
          </label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            placeholder="example.com"
          />
        </div>

        <button
          onClick={lookupWhois}
          disabled={!domain.trim() || loading}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center shadow-lg shadow-cyan-500/30"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <Search className="w-5 h-5 mr-2" />
          )}
          Lookup WHOIS
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <h4 className="text-cyan-400 font-semibold mb-4 flex items-center">
                <Info className="w-5 h-5 mr-2" />
                WHOIS Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Globe className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-xs text-gray-400">Domain</p>
                      <p className="text-white font-medium">{result.domain}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Building className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-xs text-gray-400">Registrar</p>
                      <p className="text-white font-medium">{result.registrar}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-xs text-gray-400">Country</p>
                      <p className="text-white font-medium">{result.country}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-xs text-gray-400">Created</p>
                      <p className="text-white font-medium">{result.createdDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-xs text-gray-400">Expires</p>
                      <p className="text-white font-medium">{result.expiryDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Info className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-xs text-gray-400">Status</p>
                      <p className="text-white font-medium">{result.status}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};