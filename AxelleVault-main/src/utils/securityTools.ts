export const generatePassword = (
  length: number = 16,
  includeUppercase: boolean = true,
  includeLowercase: boolean = true,
  includeNumbers: boolean = true,
  includeSymbols: boolean = true,
  keyword: string = ''
): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charset = '';
  if (includeUppercase) charset += uppercase;
  if (includeLowercase) charset += lowercase;
  if (includeNumbers) charset += numbers;
  if (includeSymbols) charset += symbols;

  if (charset === '') charset = lowercase;

  let password = '';
  const keywordChars = keyword.split('');

  for (let i = 0; i < length; i++) {
    if (keyword && i < keywordChars.length && Math.random() > 0.5) {
      const char = keywordChars[i];
      const randomize = Math.random();
      if (randomize < 0.3 && includeUppercase) {
        password += char.toUpperCase();
      } else if (randomize < 0.6 && includeNumbers) {
        password += String.fromCharCode(char.charCodeAt(0) + (Math.random() < 0.5 ? 1 : -1));
      } else {
        password += char;
      }
    } else {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
  }

  const array = password.split('');
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array.join('');
};

export const analyzePasswordStrength = (password: string): {
  score: number;
  strength: string;
  feedback: string[];
  entropy: number;
  crackTime: string;
} => {
  let score = 0;
  const feedback: string[] = [];

  if (password.length < 8) {
    feedback.push('Password should be at least 8 characters long');
  } else if (password.length >= 8 && password.length < 12) {
    score += 20;
  } else if (password.length >= 12 && password.length < 16) {
    score += 30;
  } else {
    score += 40;
  }

  if (/[a-z]/.test(password)) score += 10;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score += 10;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(password)) score += 10;
  else feedback.push('Add numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  else feedback.push('Add special characters');

  const uniqueChars = new Set(password.split('')).size;
  if (uniqueChars / password.length > 0.7) score += 15;
  else feedback.push('Use more diverse characters');

  const commonPatterns = ['123', 'abc', 'password', 'qwerty', '111', '000'];
  const hasCommonPattern = commonPatterns.some(pattern =>
    password.toLowerCase().includes(pattern)
  );
  if (hasCommonPattern) {
    score -= 20;
    feedback.push('Avoid common patterns');
  }

  score = Math.max(0, Math.min(100, score));

  let strength = 'Very Weak';
  if (score >= 80) strength = 'Very Strong';
  else if (score >= 60) strength = 'Strong';
  else if (score >= 40) strength = 'Medium';
  else if (score >= 20) strength = 'Weak';

  const entropy = calculateEntropy(password);
  const crackTime = estimateCrackTime(password, entropy);

  if (feedback.length === 0) {
    feedback.push('Excellent password!');
  }

  return { score, strength, feedback, entropy, crackTime };
};

const calculateEntropy = (password: string): number => {
  const charsetSize = getCharsetSize(password);
  return Math.log2(Math.pow(charsetSize, password.length));
};

const getCharsetSize = (password: string): number => {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/[0-9]/.test(password)) size += 10;
  if (/[^a-zA-Z0-9]/.test(password)) size += 32;
  return size;
};

const estimateCrackTime = (_password: string, entropy: number): string => {
  const attemptsPerSecond = 1e9;
  const totalCombinations = Math.pow(2, entropy);
  const seconds = totalCombinations / attemptsPerSecond / 2;

  if (seconds < 1) return 'Instant';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 3153600000) return `${Math.round(seconds / 31536000)} years`;
  return `${(seconds / 31536000).toExponential(2)} years`;
};

export const generateHash = async (text: string, algorithm: 'MD5' | 'SHA-1' | 'SHA-256'): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  let hashBuffer: ArrayBuffer;

  if (algorithm === 'MD5') {
    return await md5(text);
  } else if (algorithm === 'SHA-1') {
    hashBuffer = await crypto.subtle.digest('SHA-1', data);
  } else {
    hashBuffer = await crypto.subtle.digest('SHA-256', data);
  }

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const md5 = async (text: string): Promise<string> => {
  const encoder = new TextEncoder();
  encoder.encode(text);

  const md5js = (str: string) => {
    const md5cycle = (x: number[], k: number[]) => {
      let a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936);
      d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819);
      b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897);
      d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341);
      b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416);
      d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063);
      b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682);
      d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290);
      b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510);
      d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713);
      b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691);
      d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335);
      b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438);
      d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961);
      b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467);
      d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473);
      b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558);
      d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562);
      b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060);
      d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632);
      b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174);
      d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979);
      b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487);
      d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520);
      b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844);
      d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905);
      b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571);
      d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523);
      b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359);
      d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380);
      b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070);
      d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259);
      b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]);
      x[1] = add32(b, x[1]);
      x[2] = add32(c, x[2]);
      x[3] = add32(d, x[3]);
    };

    const cmn = (q: number, a: number, b: number, x: number, s: number, t: number) => {
      a = add32(add32(a, q), add32(x, t));
      return add32((a << s) | (a >>> (32 - s)), b);
    };

    const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
      cmn((b & c) | ((~b) & d), a, b, x, s, t);

    const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
      cmn((b & d) | (c & (~d)), a, b, x, s, t);

    const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
      cmn(b ^ c ^ d, a, b, x, s, t);

    const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
      cmn(c ^ (b | (~d)), a, b, x, s, t);

    const add32 = (a: number, b: number) => (a + b) & 0xFFFFFFFF;

    const md51 = (s: string) => {
      const n = s.length;
      const state = [1732584193, -271733879, -1732584194, 271733878];
      let i;
      for (i = 64; i <= s.length; i += 64) {
        md5cycle(state, md5blk(s.substring(i - 64, i)));
      }
      s = s.substring(i - 64);
      const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (i = 0; i < s.length; i++)
        tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) {
        md5cycle(state, tail);
        for (i = 0; i < 16; i++) tail[i] = 0;
      }
      tail[14] = n * 8;
      md5cycle(state, tail);
      return state;
    };

    const md5blk = (s: string) => {
      const md5blks = [];
      for (let i = 0; i < 64; i += 4) {
        md5blks[i >> 2] = s.charCodeAt(i) +
          (s.charCodeAt(i + 1) << 8) +
          (s.charCodeAt(i + 2) << 16) +
          (s.charCodeAt(i + 3) << 24);
      }
      return md5blks;
    };

    const hex_chr = '0123456789abcdef'.split('');

    const rhex = (n: number) => {
      let s = '';
      for (let j = 0; j < 4; j++)
        s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] +
          hex_chr[(n >> (j * 8)) & 0x0F];
      return s;
    };

    const hex = (x: number[]) => {
      return x.map((value) => rhex(value)).join('');
    };

    return hex(md51(str));
  };

  return md5js(text);
};

export const verifyHash = async (text: string, hash: string, algorithm: 'MD5' | 'SHA-1' | 'SHA-256'): Promise<boolean> => {
  const generatedHash = await generateHash(text, algorithm);
  return generatedHash.toLowerCase() === hash.toLowerCase();
};

export const analyzePhishingURL = (url: string): {
  score: number;
  classification: 'Safe' | 'Suspicious' | 'Dangerous';
  findings: string[];
} => {
  const findings: string[] = [];
  let score = 0;

  if (!url.startsWith('https://')) {
    score += 30;
    findings.push('Not using HTTPS protocol');
  }

  const suspiciousKeywords = ['login', 'verify', 'account', 'secure', 'update', 'banking', 'paypal', 'suspended', 'locked', 'confirm'];
  const urlLower = url.toLowerCase();
  suspiciousKeywords.forEach(keyword => {
    if (urlLower.includes(keyword)) {
      score += 5;
      findings.push(`Contains suspicious keyword: "${keyword}"`);
    }
  });

  if (url.length > 75) {
    score += 15;
    findings.push('URL is unusually long');
  }

  const ipPattern = /(\d{1,3}\.){3}\d{1,3}/;
  if (ipPattern.test(url)) {
    score += 25;
    findings.push('URL uses IP address instead of domain name');
  }

  const specialCharCount = (url.match(/[@\-_]/g) || []).length;
  if (specialCharCount > 3) {
    score += 10;
    findings.push('Excessive special characters in URL');
  }

  const domainMatch = url.match(/https?:\/\/([^\/]+)/);
  if (domainMatch) {
    const domain = domainMatch[1];
    const uniqueChars = new Set(domain.split('')).size;
    const entropy = uniqueChars / domain.length;
    if (entropy > 0.7) {
      score += 15;
      findings.push('High domain entropy (random-looking domain)');
    }

    const subdomain = domain.split('.').length - 2;
    if (subdomain > 2) {
      score += 10;
      findings.push('Multiple subdomains detected');
    }
  }

  const tinyUrlServices = ['bit.ly', 'tinyurl', 't.co', 'goo.gl', 'ow.ly'];
  if (tinyUrlServices.some(service => urlLower.includes(service))) {
    score += 20;
    findings.push('URL shortener detected (could hide malicious destination)');
  }

  score = Math.min(100, score);

  let classification: 'Safe' | 'Suspicious' | 'Dangerous' = 'Safe';
  if (score >= 60) classification = 'Dangerous';
  else if (score >= 30) classification = 'Suspicious';

  if (findings.length === 0) {
    findings.push('No suspicious indicators found');
  }

  return { score, classification, findings };
};

export const calculateSecurityScore = (factors: {
  passwordStrength: number;
  recentFailedLogins: number;
  accountAge: number;
  toolUsage: number;
}): number => {
  const weights = {
    passwordStrength: 0.4,
    failedLogins: 0.2,
    accountAge: 0.2,
    toolUsage: 0.2,
  };

  const failedLoginScore = Math.max(0, 100 - (factors.recentFailedLogins * 20));
  const accountAgeScore = Math.min(100, (factors.accountAge / 30) * 100);
  const toolUsageScore = Math.min(100, factors.toolUsage * 10);

  const score =
    factors.passwordStrength * weights.passwordStrength +
    failedLoginScore * weights.failedLogins +
    accountAgeScore * weights.accountAge +
    toolUsageScore * weights.toolUsage;

  return Math.round(Math.min(100, Math.max(0, score)));
};
