import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchAnalysis } from "../api";
import type { AnalysisDetail } from "../types";

const statusColors: Record<string, string> = {
  pending: "#f0ad4e",
  running: "#5bc0de",
  completed: "#5cb85c",
  failed: "#d9534f",
};

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AnalysisDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const result = await fetchAnalysis(id);
        if (cancelled) return;
        setData(result);

        if (result.status === "pending" || result.status === "running") {
          timer = setTimeout(load, 3000);
        }
      } catch {
        if (!cancelled) setError("Failed to load analysis");
      }
    };

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!data)
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{
          width: "100%",
          maxWidth: 400,
          height: 6,
          background: "#eee",
          borderRadius: 3,
          overflow: "hidden",
          margin: "0 auto",
        }}>
          <div style={{
            width: "30%",
            height: "100%",
            background: "#0066cc",
            borderRadius: 3,
            animation: "progressSlide 1.2s ease-in-out infinite",
          }} />
        </div>
        <style>{`@keyframes progressSlide { 0% { margin-left: 0% } 50% { margin-left: 70% } 100% { margin-left: 0% } }`}</style>
        <p style={{ color: "#888", marginTop: 12 }}>Loading...</p>
      </div>
    );

  return (
    <div>
      <Link to="/" style={{ color: "#0066cc", fontSize: 14 }}>
        &larr; Back to list
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "16px 0",
        }}
      >
        <h2 style={{ margin: 0 }}>
          Analysis: {new Date(data.alarm_time).toLocaleString()}
        </h2>
        <span style={{
          padding: "3px 10px",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          background: data.source_type === "cloudfront" ? "#6f42c1" : "#0066cc",
          color: "white",
        }}>
          {data.source_type === "cloudfront" ? "CloudFront" : "ALB"}
        </span>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 4,
            fontSize: 13,
            color: "white",
            background: statusColors[data.status] || "#999",
          }}
        >
          {data.status}
        </span>
      </div>

      {data.error_message && (
        <div
          style={{
            background: "#fdecea",
            border: "1px solid #d9534f",
            borderRadius: 4,
            padding: 12,
            marginBottom: 16,
            color: "#d9534f",
          }}
        >
          {data.error_message}
        </div>
      )}

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Card label="Time Window" value={`${fmt(data.window_start)} ~ ${fmt(data.window_end)}`} />
        <Card label="Total Requests" value={data.total_requests.toLocaleString()} />
        <Card
          label="4xx Errors"
          value={data.total_4xx.toLocaleString()}
          color="#d9534f"
        />
        <Card
          label="4xx Rate"
          value={
            data.total_requests > 0
              ? ((data.total_4xx / data.total_requests) * 100).toFixed(1) + "%"
              : "-"
          }
        />
      </div>

      {/* Status Code Summary */}
      {Object.keys(data.status_code_summary).length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3>Status Code Summary</h3>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(data.status_code_summary)
              .sort(([, a], [, b]) => b - a)
              .map(([code, count]) => (
                <div
                  key={code}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{count.toLocaleString()}</div>
                  <div style={{ color: "#666", fontSize: 13 }}>HTTP {code}</div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Top Error Paths */}
      {data.path_stats.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3>Top Error Paths</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
                <th style={th}>#</th>
                <th style={th}>Method</th>
                <th style={th}>Path</th>
                <th style={th}>Count</th>
                <th style={th}>%</th>
                <th style={th}>Status Codes</th>
              </tr>
            </thead>
            <tbody>
              {data.path_stats.map((ps, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>
                    <code>{ps.method}</code>
                  </td>
                  <td style={{ ...td, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis" }}>
                    <code>{ps.request_path}</code>
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{ps.count.toLocaleString()}</td>
                  <td style={td}>
                    {data.total_4xx > 0
                      ? ((ps.count / data.total_4xx) * 100).toFixed(1) + "%"
                      : "-"}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "#666" }}>
                    {Object.entries(ps.status_codes)
                      .map(([c, n]) => `${c}:${n}`)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Top Client IPs */}
      {data.client_stats.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3>Top Client IPs</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
                <th style={th}>#</th>
                <th style={th}>Client IP</th>
                <th style={th}>Count</th>
                <th style={th}>%</th>
                <th style={th}>Top Paths</th>
                <th style={th}>Status Codes</th>
              </tr>
            </thead>
            <tbody>
              {data.client_stats.map((cs, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>
                    <code>{cs.client_ip}</code>
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{cs.count.toLocaleString()}</td>
                  <td style={td}>
                    {data.total_4xx > 0
                      ? ((cs.count / data.total_4xx) * 100).toFixed(1) + "%"
                      : "-"}
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>
                    {cs.top_paths
                      .slice(0, 3)
                      .map((p) => `${p.path}(${p.count})`)
                      .join(", ")}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "#666" }}>
                    {Object.entries(cs.status_codes)
                      .map(([c, n]) => `${c}:${n}`)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(data.status === "pending" || data.status === "running") && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{
            width: "100%",
            height: 6,
            background: "#eee",
            borderRadius: 3,
            overflow: "hidden",
          }}>
            <div style={{
              width: "30%",
              height: "100%",
              background: "#5bc0de",
              borderRadius: 3,
              animation: "progressSlide 1.2s ease-in-out infinite",
            }} />
          </div>
          <style>{`@keyframes progressSlide { 0% { margin-left: 0% } 50% { margin-left: 70% } 100% { margin-left: 0% } }`}</style>
          <p style={{ color: "#333", marginTop: 12, fontSize: 15, fontWeight: 500 }}>
            {data.progress_message || "준비 중..."}
          </p>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "12px 16px",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "#333" }}>{value}</div>
    </div>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}

const th: React.CSSProperties = { padding: "8px 12px" };
const td: React.CSSProperties = { padding: "8px 12px" };
