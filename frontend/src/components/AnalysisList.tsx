import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAnalyses, deleteAnalysis } from "../api";
import type { AnalysisSummary } from "../types";
import TriggerForm from "./TriggerForm";

const statusColors: Record<string, string> = {
  pending: "#f0ad4e",
  running: "#5bc0de",
  completed: "#5cb85c",
  failed: "#d9534f",
};

export default function AnalysisList() {
  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async (p: number) => {
    setLoading(true);
    try {
      const data = await fetchAnalyses(p);
      setItems(data.items);
      setTotal(data.total);
      setPage(p);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Analysis History</h2>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "8px 20px",
            background: "#0066cc",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          + New Analysis
        </button>
      </div>

      {showForm && (
        <TriggerForm
          onCreated={(id) => {
            setShowForm(false);
            navigate(`/analyses/${id}`);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <div style={{
            width: "100%",
            height: 4,
            background: "#eee",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            <div style={{
              width: "30%",
              height: "100%",
              background: "#0066cc",
              borderRadius: 2,
              animation: "progressSlide 1.2s ease-in-out infinite",
            }} />
          </div>
          <style>{`@keyframes progressSlide { 0% { margin-left: 0% } 50% { margin-left: 70% } 100% { margin-left: 0% } }`}</style>
          <p style={{ color: "#888", marginTop: 12 }}>Loading...</p>
        </div>
      ) : items.length === 0 ? (
        <p style={{ color: "#888", textAlign: "center", padding: 40 }}>
          No analyses yet. Click "+ New Analysis" to start.
        </p>
      ) : (
        <>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Alarm Time</th>
                <th style={{ padding: "8px 12px" }}>Source</th>
                <th style={{ padding: "8px 12px" }}>Total Requests</th>
                <th style={{ padding: "8px 12px" }}>4xx Count</th>
                <th style={{ padding: "8px 12px" }}>4xx Rate</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
                <th style={{ padding: "8px 12px" }}>Created</th>
                <th style={{ padding: "8px 12px", width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: "1px solid #eee" }}
                >
                  <td style={{ padding: "8px 12px" }}>
                    <Link to={`/analyses/${item.id}`}>
                      {new Date(item.alarm_time).toLocaleString()}
                    </Link>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: item.source_type === "cloudfront" ? "#6f42c1" : "#0066cc",
                      color: "white",
                    }}>
                      {item.source_type === "cloudfront" ? "CF" : "ALB"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {item.total_requests.toLocaleString()}
                  </td>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#d9534f" }}>
                    {item.total_4xx.toLocaleString()}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {item.total_requests > 0
                      ? ((item.total_4xx / item.total_requests) * 100).toFixed(1) + "%"
                      : "-"}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "white",
                        background: statusColors[item.status] || "#999",
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "#666" }}>
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("삭제하시겠습니까?")) return;
                        try {
                          await deleteAnalysis(item.id);
                          load(page);
                        } catch {
                          alert("삭제에 실패했습니다.");
                        }
                      }}
                      style={{
                        padding: "2px 8px",
                        background: "none",
                        border: "1px solid #d9534f",
                        borderRadius: 4,
                        color: "#d9534f",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1}
                style={{ padding: "4px 12px" }}
              >
                Prev
              </button>
              <span style={{ lineHeight: "28px" }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= totalPages}
                style={{ padding: "4px 12px" }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
