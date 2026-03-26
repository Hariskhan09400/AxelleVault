import { useState } from 'react';
import { Hash, Copy, Check, CheckCircle, XCircle } from 'lucide-react';
import { generateHash, verifyHash } from '../../utils/securityTools';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export const HashGenerator = () => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [algorithm, setAlgorithm] = useState<'MD5' | 'SHA-1' | 'SHA-256'>('SHA-256');
  const [hash, setHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [verifyText, setVerifyText] = useState('');
  const [verifyHashInput, setVerifyHashInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);

  const handleGenerate = async () => {
    if (!text) return;

    const generatedHash = await generateHash(text, algorithm);
    setHash(generatedHash);

    if (user) {
      supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'hash_generated',
        event_data: { algorithm },
        risk_level: 'low',
      });
    }
  };

  const handleVerify = async () => {
    if (!verifyText || !verifyHashInput) return;

    const isValid = await verifyHash(verifyText, verifyHashInput, algorithm);
    setVerifyResult(isValid);

    if (user) {
      supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'hash_verified',
        event_data: { algorithm, result: isValid },
        risk_level: 'low',
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Hash className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">Hash Generator & Verifier</h3>
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-4">Generate Hash</h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Algorithm
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as 'MD5' | 'SHA-1' | 'SHA-256')}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="MD5">MD5</option>
                <option value="SHA-1">SHA-1</option>
                <option value="SHA-256">SHA-256</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Text to Hash
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                placeholder="Enter text to generate hash..."
                rows={3}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!text}
              className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30"
            >
              Generate Hash
            </button>

            {hash && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">{algorithm} Hash</span>
                  <button
                    onClick={copyToClipboard}
                    className="text-cyan-400 hover:text-cyan-300 transition flex items-center text-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-white font-mono text-sm break-all">{hash}</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6">
          <h4 className="text-sm font-medium text-gray-300 mb-4">Verify Hash</h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Original Text
              </label>
              <input
                type="text"
                value={verifyText}
                onChange={(e) => setVerifyText(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                placeholder="Enter original text..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Hash to Verify
              </label>
              <input
                type="text"
                value={verifyHashInput}
                onChange={(e) => setVerifyHashInput(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
                placeholder="Enter hash to verify..."
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={!verifyText || !verifyHashInput}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/30"
            >
              Verify Hash
            </button>

            {verifyResult !== null && (
              <div className={`${
                verifyResult ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'
              } border rounded-lg p-4 flex items-center`}>
                {verifyResult ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-green-400 mr-3" />
                    <div>
                      <p className="text-green-400 font-semibold">Hash Verified!</p>
                      <p className="text-green-300 text-sm">The text matches the provided hash</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-red-400 mr-3" />
                    <div>
                      <p className="text-red-400 font-semibold">Verification Failed</p>
                      <p className="text-red-300 text-sm">The text does not match the hash</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
