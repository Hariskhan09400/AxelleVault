import { useState, useRef } from "react";

const API_URL = "http://localhost:3001";

const SCAN_TYPES = [
  { id: "quick", label: "Quick", desc: "Top 100 ports" },
  { id: "custom", label: "Custom", desc: "Define port range" },
  { id: "service", label: "Service", desc: "Version detection" },
  { id: "os", label: "OS Detect", desc: "Requires root/sudo" },
];

const STATE_COLORS = {
  open: "#00ff9f",
  closed: "#ff4d6d",
  filtered: "#ffd60a",
};

export default function PortScanner() {
  const [target, setTarget] = useState("localhost");
  const [ports, setPorts] = useState("1-1024");
  const [scanType, setScanType] = useState("quick");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const logsRef = useRef(null);

  const scan = async () => {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, ports, scanType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCount = result?.parsed?.ports?.filter((p) => p.state === "open").length || 0;

  return (
    <div style={styles.root}>
      {/* Scanline overlay */}
      <div style={styles.scanlines} />

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>◈</span>
          <span style={styles.logoText}>NMAP<span style={styles.logoAccent}>UI</span></span>
        </div>
        <div style={styles.badge}>LOCAL ONLY · LEARNING MODE</div>
      </div>

      {/* Main Card */}
      <div style={styles.card}>
        {/* Target Input */}
        <div style={styles.section}>
          <label style={styles.label}>TARGET HOST</label>
          <div style={styles.inputRow}>
            <span style={styles.prompt}>$</span>
            <input
              style={styles.input}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="localhost / 192.168.1.1"
              spellCheck={false}
            />
          </div>
          <p style={styles.hint}>⚠ Only localhost and private IP ranges allowed</p>
        </div>

        {/* Scan Type */}
        <div style={styles.section}>
          <label style={styles.label}>SCAN TYPE</label>
          <div style={styles.scanTypes}>
            {SCAN_TYPES.map((s) => (
              <button
                key={s.id}
                style={{
                  ...styles.scanTypeBtn,
                  ...(scanType === s.id ? styles.scanTypeBtnActive : {}),
                }}
                onClick={() => setScanType(s.id)}
              >
                <span style={styles.scanTypeName}>{s.label}</span>
                <span style={styles.scanTypeDesc}>{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Ports */}
        {scanType === "custom" && (
          <div style={styles.section}>
            <label style={styles.label}>PORT RANGE</label>
            <div style={styles.inputRow}>
              <span style={styles.prompt}>-p</span>
              <input
                style={styles.input}
                value={ports}
                onChange={(e) => setPorts(e.target.value)}
                placeholder="1-1024 or 80,443,8080"
              />
            </div>
          </div>
        )}

        {/* Scan Button */}
        <button
          style={{
            ...styles.scanBtn,
            ...(loading ? styles.scanBtnLoading : {}),
          }}
          onClick={scan}
          disabled={loading || !target}
        >
          {loading ? (
            <span style={styles.scanBtnText}>
              <span style={styles.spinner}>◌</span> SCANNING...
            </span>
          ) : (
            <span style={styles.scanBtnText}>▶ RUN SCAN</span>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBox}>
          <span style={{ color: "#ff4d6d" }}>✗ ERROR:</span> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={styles.results}>
          {/* Meta info */}
          <div style={styles.metaRow}>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>HOST</span>
              <span style={styles.metaValue}>{result.parsed.meta.host || target}</span>
            </div>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>OPEN PORTS</span>
              <span style={{ ...styles.metaValue, color: "#00ff9f" }}>{openCount}</span>
            </div>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>SCANNED AT</span>
              <span style={styles.metaValue}>
                {new Date(result.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {result.parsed.meta.mac && (
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>MAC</span>
                <span style={styles.metaValue}>{result.parsed.meta.mac.replace("MAC Address: ", "")}</span>
              </div>
            )}
          </div>

          {/* Command used */}
          <div style={styles.commandBox}>
            <span style={{ color: "#666" }}>ran:</span>{" "}
            <span style={{ color: "#00ff9f" }}>{result.command}</span>
          </div>

          {/* Ports Table */}
          {result.parsed.ports.length > 0 ? (
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <span style={styles.col1}>PORT</span>
                <span style={styles.col2}>PROTO</span>
                <span style={styles.col3}>STATE</span>
                <span style={styles.col4}>SERVICE</span>
              </div>
              {result.parsed.ports.map((p, i) => (
                <div key={i} style={styles.tableRow}>
                  <span style={{ ...styles.col1, color: "#e2e8f0" }}>{p.port}</span>
                  <span style={{ ...styles.col2, color: "#94a3b8" }}>{p.protocol}</span>
                  <span style={{ ...styles.col3, color: STATE_COLORS[p.state] || "#94a3b8" }}>
                    {p.state}
                  </span>
                  <span style={{ ...styles.col4, color: "#cbd5e1" }}>{p.service}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.noPorts}>No open ports found in range</div>
          )}

          {/* Raw Output Toggle */}
          <button style={styles.rawToggle} onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? "▲ Hide" : "▼ Show"} raw nmap output
          </button>
          {showRaw && <pre style={styles.rawOutput}>{result.raw}</pre>}
        </div>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        For learning purposes only · Only scan systems you own or have permission to scan
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#050a0f",
    color: "#e2e8f0",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    padding: "24px",
    position: "relative",
    maxWidth: "900px",
    margin: "0 auto",
  },
  scanlines: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,159,0.015) 2px, rgba(0,255,159,0.015) 4px)",
    pointerEvents: "none",
    zIndex: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "32px",
    position: "relative",
    zIndex: 1,
  },
  logo: { display: "flex", alignItems: "center", gap: "10px" },
  logoIcon: { color: "#00ff9f", fontSize: "24px" },
  logoText: { fontSize: "22px", fontWeight: "700", letterSpacing: "4px", color: "#fff" },
  logoAccent: { color: "#00ff9f" },
  badge: {
    fontSize: "10px",
    letterSpacing: "2px",
    color: "#00ff9f",
    border: "1px solid #00ff9f33",
    padding: "4px 10px",
    borderRadius: "2px",
    background: "#00ff9f0a",
  },
  card: {
    background: "#0a1420",
    border: "1px solid #00ff9f22",
    borderRadius: "6px",
    padding: "28px",
    marginBottom: "20px",
    position: "relative",
    zIndex: 1,
  },
  section: { marginBottom: "24px" },
  label: {
    display: "block",
    fontSize: "10px",
    letterSpacing: "3px",
    color: "#00ff9f",
    marginBottom: "10px",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "#050a0f",
    border: "1px solid #00ff9f33",
    borderRadius: "4px",
    padding: "10px 14px",
  },
  prompt: { color: "#00ff9f", fontSize: "14px", userSelect: "none" },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#e2e8f0",
    fontFamily: "inherit",
    fontSize: "14px",
  },
  hint: { fontSize: "11px", color: "#475569", marginTop: "6px" },
  scanTypes: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" },
  scanTypeBtn: {
    background: "#050a0f",
    border: "1px solid #1e293b",
    borderRadius: "4px",
    padding: "10px 8px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    transition: "all 0.15s",
  },
  scanTypeBtnActive: {
    border: "1px solid #00ff9f",
    background: "#00ff9f0d",
  },
  scanTypeName: { color: "#e2e8f0", fontSize: "13px", fontFamily: "inherit" },
  scanTypeDesc: { color: "#475569", fontSize: "10px", fontFamily: "inherit" },
  scanBtn: {
    width: "100%",
    padding: "14px",
    background: "#00ff9f",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  scanBtnLoading: { background: "#004d2e", cursor: "wait" },
  scanBtnText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: "700",
    fontSize: "14px",
    letterSpacing: "2px",
    color: "#050a0f",
  },
  spinner: {
    display: "inline-block",
    animation: "spin 1s linear infinite",
    color: "#00ff9f",
  },
  errorBox: {
    background: "#1a0810",
    border: "1px solid #ff4d6d44",
    borderRadius: "4px",
    padding: "14px",
    fontSize: "13px",
    marginBottom: "16px",
    position: "relative",
    zIndex: 1,
  },
  results: {
    background: "#0a1420",
    border: "1px solid #00ff9f22",
    borderRadius: "6px",
    padding: "24px",
    position: "relative",
    zIndex: 1,
  },
  metaRow: {
    display: "flex",
    gap: "32px",
    flexWrap: "wrap",
    marginBottom: "20px",
    paddingBottom: "20px",
    borderBottom: "1px solid #1e293b",
  },
  metaItem: { display: "flex", flexDirection: "column", gap: "4px" },
  metaLabel: { fontSize: "9px", letterSpacing: "2px", color: "#475569" },
  metaValue: { fontSize: "14px", color: "#e2e8f0" },
  commandBox: {
    background: "#050a0f",
    border: "1px solid #1e293b",
    borderRadius: "3px",
    padding: "8px 12px",
    fontSize: "12px",
    marginBottom: "20px",
  },
  table: { borderRadius: "4px", overflow: "hidden" },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "80px 80px 100px 1fr",
    padding: "8px 12px",
    background: "#050a0f",
    fontSize: "10px",
    letterSpacing: "2px",
    color: "#475569",
    borderBottom: "1px solid #1e293b",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "80px 80px 100px 1fr",
    padding: "10px 12px",
    fontSize: "13px",
    borderBottom: "1px solid #0f1e2e",
    transition: "background 0.1s",
  },
  col1: {}, col2: {}, col3: {}, col4: {},
  noPorts: { color: "#475569", textAlign: "center", padding: "32px", fontSize: "13px" },
  rawToggle: {
    marginTop: "16px",
    background: "transparent",
    border: "none",
    color: "#475569",
    fontFamily: "inherit",
    fontSize: "12px",
    cursor: "pointer",
    padding: "0",
  },
  rawOutput: {
    marginTop: "12px",
    background: "#050a0f",
    border: "1px solid #1e293b",
    borderRadius: "4px",
    padding: "16px",
    fontSize: "11px",
    color: "#64748b",
    whiteSpace: "pre-wrap",
    overflowX: "auto",
    maxHeight: "300px",
    overflowY: "auto",
  },
  footer: {
    textAlign: "center",
    fontSize: "10px",
    color: "#1e293b",
    marginTop: "32px",
    letterSpacing: "1px",
    position: "relative",
    zIndex: 1,
  },
};