// src/components/PhishingDetector.tsx
import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";

// ====================
// 1. Types & Result
// ====================

export type PhishingResult = {
  classification: "Safe" | "Suspicious" | "Dangerous";
  score: number; // 0–100
  findings: string[];
  details: {
    hasHTTPS: boolean;
    domain: string;
    queryLength: number;
    suspiciousKeywords: string[];
    suspiciousTLDs: string[];
    suspiciousStructural: string[];
  };
};

// ====================
// 2. analyzePhishingURL (advanced)
// ====================

const containsPhishWords = (url: string): string[] => {
  const suspicious = [] as string[];

  const words = [
    "login",
    "signin",
    "bank",
    "paypal",
    "ebay",
    "recovery",
    "verify",
    "update",
    "secure",
    "support",
    "account",
    "money",
    "password",
    "money",
    "offer",
    "prize",
  ];
  const tlds = ["de", "ru", "cn", "xyz", "ga", "ml", "tk", "cc", "gq", "cf", "tk"];
  const suspiciousChars = ["@", "%", "(", ")"];

  const lower = url.toLowerCase();
  const domainMatch = lower.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/)?.[1] || "";

  if (words.some((w) => lower.includes(w))) {
    suspicious.push(
      `Contains common phishing keyword in URL (${words.filter((w) => lower.includes(w)).join(", ")})`
    );
  }

  if (tlds.some((t) => domainMatch.endsWith("." + t))) {
    suspicious.push(
      `Uses commonly abused TLD (${tlds.find((t) => domainMatch.endsWith("." + t))})`
    );
  }

  if (domainMatch.split(".").length > 3 && domainMatch.length < 30) {
    suspicious.push("Unusual many dots in short hostname (possible domain spoofing)");
  }

  if (suspiciousChars.some((c) => lower.includes(c))) {
    suspicious.push(`Suspicious special characters in URL (${suspiciousChars.filter((c) => lower.includes(c)).join(", ")})`);
  }

  return suspicious;
};

const isSimilarToKnownBrand = (url: string): string[] => {
  const findings = [] as string[];
  const lower = url.toLowerCase();
  const brands = [
    "google",
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "x.com",
    "microsoft",
    "office365",
    "apple",
    "amazon",
    "paypal",
    "stripe",
    "netflix",
    "spotify",
    "discord",
  ];

  for (const brand of brands) {
    if (lower.includes(brand) && !lower.includes(`.${brand}.com`)) {
      findings.push(`Suspicious subdomain or path referencing ${brand}`);
    }
  }
  return findings;
};

const extractDetails = (url: string): PhishingResult["details"] => {
  const lower = url.toLowerCase();
  const domainMatch = lower.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/)?.[1] || "";
  const queryIndex = url.indexOf("?");

  const hasHTTPS =
    url.startsWith("https://") ||
    (url.startsWith("http://") && !url.startsWith("https://")) ||
    !url.includes("://");

  const queryLength =
    queryIndex !== -1 ? url.slice(queryIndex).length : 0;

  const suspiciousKeywords = [
    "login",
    "signin",
    "bank",
    "paypal",
    "ebay",
    "recovery",
    "verify",
    "update",
    "secure",
    "support",
    "account",
    "password",
  ].filter((w) => lower.includes(w));

  const tlds = ["de", "ru", "cn", "xyz", "ga", "ml", "tk", "cc", "gq", "cf", "tk"];
  const suspiciousTLDs = tlds.filter((t) => domainMatch.endsWith("." + t));

  const suspiciousStructural: string[] = [];

  if (lower.includes("@") && !lower.includes("://")) {
    suspiciousStructural.push("Suspicious @ in URL (possible credential‑theft trick)");
  }

  if (url.length > 100) {
    suspiciousStructural.push("URL is unusually long (often used to hide malicious destination)");
  }

  const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipRegex.test(domainMatch)) {
    suspiciousStructural.push("Domain is actually an IP address (common in phishing)");
  }

  return {
    hasHTTPS: lower.startsWith("https://"),
    domain: domainMatch,
    queryLength,
    suspiciousKeywords,
    suspiciousTLDs,
    suspiciousStructural,
  };
};

export const analyzePhishingURL = (rawUrl: string): PhishingResult => {
  const url = rawUrl.trim();
  if (!url) {
    return {
      classification: "Safe",
      score: 0,
      findings: ["No URL provided"],
      details: {
        hasHTTPS: false,
        domain: "",
        queryLength: 0,
        suspiciousKeywords: [],
        suspiciousTLDs: [],
        suspiciousStructural: [],
      },
    };
  }

  const findings: string[] = [];
  const details = extractDetails(url);

  if (!url.includes("://")) {
    findings.push("URL does not have explicit protocol (could be malicious or malformed)");
  }

  const suspiciousFromWords = containsPhishWords(url);
  findings.push(...suspiciousFromWords);

  const similarBrands = isSimilarToKnownBrand(url);
  findings.push(...similarBrands);

  const phishingFromStructural = details.suspiciousStructural;
  findings.push(...phishingFromStructural);

  let score = 0;
  if (details.suspiciousKeywords.length > 0) score += 20;
  if (details.suspiciousTLDs.length > 0) score += 20;
  if (details.queryLength > 80) score += 20;
  if (phishingFromStructural.length > 0) score += 30;
  if (similarBrands.length > 0) score += 30;

  score = Math.min(score, 100);

  const classification: PhishingResult["classification"] =
    score === 0
      ? "Safe"
      : score < 40
      ? "Safe"
      : score < 70
      ? "Suspicious"
      : "Dangerous";

  return {
    classification,
    score,
    findings: findings.length === 0 ? ["No obvious phishing indicators found"] : findings,
    details,
  };
};

// ====================
// 3. PhishingDetector Component
// ====================

export const PhishingDetector = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ReturnType<typeof analyzePhishingURL> | null>(null);
  const [isScanning, setIsScanning] = useState(false); // loading state

  const handleAnalyze = async () => {
    if (!url || isScanning) return;

    setIsScanning(true);
    try {
      const analysis = analyzePhishingURL(url);
      setResult(analysis);

      if (user) {
        await supabase.from("security_logs").insert({
          user_id: user.id,
          event_type: "phishing_scan",
          event_data: {
            classification: analysis.classification,
            score: analysis.score,
            domain: analysis.details.domain,
            suspicious_keywords: analysis.details.suspiciousKeywords,
            suspicious_tlds: analysis.details.suspiciousTLDs,
          },
          risk_level:
            analysis.classification === "Dangerous"
              ? "high"
              : analysis.classification === "Suspicious"
              ? "medium"
              : "low",
        });
      }
    } catch (error) {
      console.error("Phishing scan log failed:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAnalyze();
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Shield className="w-6 h-6 text-cyan-400 mr-3" />
        <h3 className="text-xl font-semibold text-white">
          Phishing Detection Engine
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Enter URL to Analyze
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            placeholder="https://example.com"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!url || isScanning}
          className="w-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold py-3 rounded-lg hover:from-cyan-600 hover:to-green-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30"
        >
          {isScanning ? "Analyzing..." : "Analyze URL"}
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div
              className={`border rounded-lg p-4 ${
                result.classification === "Safe"
                  ? "bg-green-500/10 border-green-500/50"
                  : result.classification === "Suspicious"
                  ? "bg-yellow-500/10 border-yellow-500/50"
                  : "bg-red-500/10 border-red-500/50"
              }`}
            >
              <div className="flex items-center mb-3">
                {result.classification === "Safe" ? (
                  <CheckCircle className="w-8 h-8 text-green-400 mr-3" />
                ) : result.classification === "Suspicious" ? (
                  <AlertTriangle className="w-8 h-8 text-yellow-400 mr-3" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-400 mr-3" />
                )}
                <div>
                  <h4
                    className={`font-semibold text-lg ${
                      result.classification === "Safe"
                        ? "text-green-400"
                        : result.classification === "Suspicious"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {result.classification}
                  </h4>
                  <p className="text-sm text-gray-400">
                    Risk Score: {result.score}/100
                  </p>
                </div>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    result.classification === "Safe"
                      ? "bg-green-500"
                      : result.classification === "Suspicious"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${result.score}%` }}
                ></div>
              </div>

              <div
                className={`rounded-lg p-3 ${
                  result.classification === "Safe"
                    ? "bg-green-900/30"
                    : result.classification === "Suspicious"
                    ? "bg-yellow-900/30"
                    : "bg-red-900/30"
                }`}
              >
                <h5 className="text-sm font-medium text-gray-300 mb-2">
                  Findings
                </h5>
                <ul className="text-sm space-y-1">
                  {result.findings.map((finding, index) => (
                    <li
                      key={index}
                      className={`${
                        result.classification === "Safe"
                          ? "text-green-200"
                          : result.classification === "Suspicious"
                          ? "text-yellow-200"
                          : "text-red-200"
                      }`}
                    >
                      • {finding}
                    </li>
                  ))}
                </ul>
              </div>

              {result.classification !== "Safe" && (
                <div className="mt-3 p-3 bg-gray-900/50 rounded-lg">
                  <p className="text-xs text-gray-400">
                    ⚠️ Exercise caution when accessing this URL. Verify the
                    source and avoid entering sensitive information.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!result && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Enter a URL to analyze for potential phishing threats
          </div>
        )}
      </div>
    </div>
  );
};