export type Track = "Professional" | "Labor" | "Wildcard" | "Games / 3D";

export type Candidate = {
  track: Track;
  title: string;
  company?: string;
  location?: string;
  remote?: boolean;
  salary_text?: string;
  url: string;
  source?: string;
  snippet?: string;
  posted_at?: string;
  score?: number;
  _httpStatus?: number;
  _expired?: boolean;
  _availability?: {state:string;reason:string;checked_at:string;source_url:string;http_status:number};
};
