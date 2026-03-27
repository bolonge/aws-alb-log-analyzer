import type { AnalysisDetail, AnalysisListResponse } from "./types";

const BASE = "";

export async function fetchAnalyses(
  page = 1,
  pageSize = 20
): Promise<AnalysisListResponse> {
  const res = await fetch(
    `${BASE}/api/analyses?page=${page}&page_size=${pageSize}`
  );
  if (!res.ok) throw new Error("Failed to fetch analyses");
  return res.json();
}

export async function fetchAnalysis(id: string): Promise<AnalysisDetail> {
  const res = await fetch(`${BASE}/api/analyses/${id}`);
  if (!res.ok) throw new Error("Failed to fetch analysis");
  return res.json();
}

export async function triggerAnalysis(data: {
  alarm_time: string;
  source_type: string;
  s3_bucket?: string;
  s3_prefix?: string;
}): Promise<{ id: string; status: string }> {
  const res = await fetch(`${BASE}/api/analyses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to trigger analysis");
  return res.json();
}

export async function deleteAnalysis(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/analyses/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete analysis");
}
