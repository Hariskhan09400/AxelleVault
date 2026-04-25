import { useState } from 'react';
import { Key, Copy, RefreshCw, Check } from 'lucide-react';
import { generatePassword, analyzePasswordStrength } from '../../utils/securityTools';
import { useAuth } from '../../hooks/useAuth';
import { saveLog } from '../../lib/securityLogger';

export const PasswordGenerator = () => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [keyword, setKeyword] = useState('');
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [copied, setCopied] = useState(false);
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzePasswordStrength> | null>(null);

  const generate = async () => {
    const newPassword = generatePassword(
      length,
      includeUppercase,
      includeLowercase,
      includeNumbers,
      includeSymbols,
      keyword
    );
    setPassword(newPassword);
    setAnalysis(analyzePasswordStrength(newPassword));

    if (user) {
      await saveLog(user.id, 'password_generated', { length, keyword: keyword ? 'yes' : 'no' }, 'low');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Key className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">Password Generator</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Password Length: {length}
          </label>
          <input
            type="range"
            min="8"
            max="32"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Keyword (Optional)
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            placeholder="e.g., secure, vault"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeUppercase}
              onChange={(e) => setIncludeUppercase(e.target.checked)}
              className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
            />
            <span className="text-sm text-gray-300">Uppercase (A-Z)</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLowercase}
              onChange={(e) => setIncludeLowercase(e.target.checked)}
              className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
            />
            <span className="text-sm text-gray-300">Lowercase (a-z)</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers(e.target.checked)}
              className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
            />
            <span className="text-sm text-gray-300">Numbers (0-9)</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSymbols}
              onChange={(e) => setIncludeSymbols(e.target.checked)}
              className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
            />
            <span className="text-sm text-gray-300">Symbols (!@#$)</span>
          </label>
        </div>

        <button
          onClick={generate}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 transition duration-200 flex items-center justify-center shadow-lg shadow-cyan-500/30"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          Generate Password
        </button>

        {password && (
          <div className="mt-6 space-y-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Generated Password</span>
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
              <p className="text-white font-mono text-lg break-all">{password}</p>
            </div>

            {analysis && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Strength Analysis</h4>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Strength Score</span>
                    <span className={`font-semibold ${
                      analysis.score >= 80 ? 'text-green-400' :
                      analysis.score >= 60 ? 'text-cyan-400' :
                      analysis.score >= 40 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {analysis.score}/100 - {analysis.strength}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        analysis.score >= 80 ? 'bg-green-500' :
                        analysis.score >= 60 ? 'bg-cyan-500' :
                        analysis.score >= 40 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${analysis.score}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-xs text-gray-400 space-y-1">
                  <p>Entropy: {analysis.entropy.toFixed(2)} bits</p>
                  <p>Estimated crack time: {analysis.crackTime}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
