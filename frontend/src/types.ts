export interface AnalysisSummary {
  id: string;
  alarm_time: string;
  total_requests: number;
  total_4xx: number;
  source_type: string;
  status: string;
  progress_message: string | null;
  created_at: string;
}

export interface PathStat {
  request_path: string;
  method: string;
  count: number;
  status_codes: Record<string, number>;
}

export interface ClientStat {
  client_ip: string;
  count: number;
  top_paths: { path: string; count: number }[];
  status_codes: Record<string, number>;
}

export interface AnalysisDetail extends AnalysisSummary {
  window_start: string;
  window_end: string;
  s3_bucket: string;
  s3_prefix: string;
  status_code_summary: Record<string, number>;
  completed_at: string | null;
  error_message: string | null;
  path_stats: PathStat[];
  client_stats: ClientStat[];
}

export interface AnalysisListResponse {
  items: AnalysisSummary[];
  total: number;
  page: number;
  page_size: number;
}
