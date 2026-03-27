import { useState } from "react";
import { triggerAnalysis } from "../api";

interface Props {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

export default function TriggerForm({ onCreated, onCancel }: Props) {
  const [alarmTime, setAlarmTime] = useState("");
  const [sourceType, setSourceType] = useState<"alb" | "cloudfront">("alb");
  const [bucket, setBucket] = useState("");
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alarmTime) {
      setError("Alarm time is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await triggerAnalysis({
        alarm_time: new Date(alarmTime).toISOString(),
        source_type: sourceType,
        s3_bucket: bucket || undefined,
        s3_prefix: prefix || undefined,
      });
      onCreated(result.id);
    } catch {
      setError("Failed to trigger analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 20,
        marginBottom: 20,
        background: "#f9f9f9",
      }}
    >
      <h3 style={{ marginTop: 0 }}>New Analysis</h3>
      <form onSubmit={handleSubmit}>
        {/* Source Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Log Source *
          </label>
          <div style={{ display: "flex", gap: 0 }}>
            {(["alb", "cloudfront"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSourceType(type)}
                style={{
                  padding: "7px 20px",
                  border: "1px solid #ccc",
                  borderRadius: type === "alb" ? "4px 0 0 4px" : "0 4px 4px 0",
                  background: sourceType === type ? "#0066cc" : "#fff",
                  color: sourceType === type ? "white" : "#333",
                  cursor: "pointer",
                  fontWeight: sourceType === type ? 600 : 400,
                  fontSize: 13,
                }}
              >
                {type === "alb" ? "ALB" : "CloudFront"}
              </button>
            ))}
          </div>
        </div>

        {/* Alarm Time */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
            Alarm Time (KST) *
          </label>
          <input
            type="datetime-local"
            value={alarmTime}
            onChange={(e) => setAlarmTime(e.target.value)}
            style={{ padding: "6px 10px", width: 280 }}
          />
        </div>

        {/* Optional overrides */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4, color: "#666" }}>
            S3 Bucket (optional)
          </label>
          <input
            type="text"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="my-log-bucket"
            style={{ padding: "6px 10px", width: 280 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, color: "#666" }}>
            S3 Prefix (optional, uses .env default)
          </label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder={
              sourceType === "cloudfront"
                ? "cloudfront-logs/"
                : "AWSLogs/..."
            }
            style={{ padding: "6px 10px", width: 280 }}
          />
        </div>

        {error && <p style={{ color: "red", margin: "8px 0" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "8px 20px",
              background: "#0066cc",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Analyzing..." : "Start Analysis"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 20px",
              background: "#ccc",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
