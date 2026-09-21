import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { SourceConfig } from "./types.js";

function readYaml<T>(relativePath: string): T {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return YAML.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

export interface EditorialConfig {
  exclude_terms: string[];
  high_risk_terms: string[];
  constructive_terms: string[];
  topic_keywords: Record<string, string[]>;
}

export interface ScoringConfig {
  weights: Record<string, number>;
  thresholds: {
    minimum_candidate_score: number;
    priority_score: number;
    strong_score: number;
    maximum_community_risk: number;
  };
  community_risk: {
    base: number;
    high_risk_term_penalty: number;
    hard_exclusion_score: number;
    max: number;
  };
  rules: {
    primary_source_bonus: number;
    nz_source_bonus: number;
    constructive_term_bonus: number;
    multiple_topic_bonus: number;
    missing_summary_penalty: number;
    stale_after_days: number;
  };
}

export function loadConfig() {
  const sourceDoc = readYaml<{ sources: SourceConfig[] }>("config/sources.yml");
  const editorial = readYaml<EditorialConfig>("config/editorial.yml");
  const scoring = readYaml<ScoringConfig>("config/scoring.yml");

  return {
    sources: sourceDoc.sources.filter((source) => source.enabled),
    editorial,
    scoring,
  };
}
