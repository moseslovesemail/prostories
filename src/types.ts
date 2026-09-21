export type IngestMethod = "rss" | "html";

export interface SourceConfig {
  id: string;
  name: string;
  country: string;
  source_type: string;
  editorial_mode: "auto" | "filtered" | "discovery" | "manual";
  enabled: boolean;
  trust: number;
  weight: number;
  topics: string[];
  ingest: {
    method: IngestMethod;
    url: string;
  };
}

export interface RawItem {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  country: string;
  trust: number;
  sourceWeight: number;
  defaultTopics: string[];
  title: string;
  url: string;
  summary: string;
  publishedAt?: string;
}

export interface ScoreBreakdown {
  source_confidence: number;
  editorial_fit: number;
  hope_connection: number;
  interestingness: number;
  aotearoa_relevance: number;
  social_potential: number;
  originality: number;
  recency: number;
  community_risk: number;
  total: number;
  excluded: boolean;
  exclusion_reason?: string;
}

export interface Candidate extends RawItem {
  topics: string[];
  scores: ScoreBreakdown;
  primarySourceUrl: string;
  originalReportingUrl: string;
  keyFacts: Array<{ text: string; source_url: string }>;
}
