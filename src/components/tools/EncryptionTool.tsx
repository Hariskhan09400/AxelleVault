import { useState } from 'react';
import { Lock, Copy, Check, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import CryptoJS from 'crypto-js';

type Algorithm = 'base64' | 'sha256' | 'md5';

export const EncryptionTool = () => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [algorithm, setAlgorithm] = useState<Algorithm>('base64');
  const [output, setOutput] = useState('');
  const [isEncrypt, setIsEncrypt] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const encrypt = async (text: string, alg: Algorithm): Promise<string> => {
    switch (alg) {
      case 'base64':
        return btoa(text);
      case 'sha256':
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      case 'md5':
        return CryptoJS.MD5(text).toString();
      default:
        return text;
    }
  };

  const decrypt = (text: string, alg: Algorithm): string => {
    switch (alg) {
      case 'base64':
        try {
          return atob(text);
        } catch {
          return 'Invalid Base64';
        }
      default:
        return 'Decryption not supported for this algorithm';
    }
  };

  const process = async () => {
    if (!input.trim()) return;

    setLoading(true);
    let result = '';

    if (isEncrypt) {
      result = await encrypt(input, algorithm);
    } else {
      result = decrypt(input, algorithm);
    }

    setOutput(result);

    if (user) {
      await supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'encryption_tool',
        event_data: { algorithm, operation: isEncrypt ? 'encrypt' : 'decrypt' },
        risk_level: 'low',
      });
    }

    setLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canDecrypt = algorithm === 'base64';

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Key className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">Encryption Tool</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Input Text
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
            placeholder="Enter text to encrypt/decrypt"
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Algorithm
            </label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="base64">Base64</option>
              <option value="sha256">SHA-256</option>
              <option value="md5">MD5</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="operation"
                checked={isEncrypt}
                onChange={() => setIsEncrypt(true)}
                className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-300">Encrypt</span>
            </label>
            {canDecrypt && (
              <label className="flex items-center space-x-2 cursor-pointer ml-4">
                <input
                  type="radio"
                  name="operation"
                  checked={!isEncrypt}
                  onChange={() => setIsEncrypt(false)}
                  className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
                />
                <span className="text-sm text-gray-300">Decrypt</span>
              </label>
            )}
          </div>
        </div>

        <button
          onClick={process}
          disabled={!input.trim() || loading}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center shadow-lg shadow-cyan-500/30"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <Lock className="w-5 h-5 mr-2" />
          )}
          {isEncrypt ? 'Encrypt' : 'Decrypt'}
        </button>

        {output && (
          <div className="mt-6 space-y-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Result ({algorithm.toUpperCase()})</span>
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
              <p className="text-white font-mono text-sm break-all">{output}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};