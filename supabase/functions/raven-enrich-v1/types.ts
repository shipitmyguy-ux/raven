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
};
