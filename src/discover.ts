import { loadConfig } from "./config.js";
import { ingestHtml } from "./ingest/html.js";
import { ingestRss } from "./ingest/rss.js";
import { scoreItem } from "./scoring.js";
import { classifyTopics } from "./topics.js";
import type { Candidate, RawItem, SourceConfig } from "./types.js";
import { canonicalizeUrl, normalizeText } from "./utils.js";

async function ingestSource(source: SourceConfig): Promise<RawItem[]> {
  return source.ingest.method === "rss" ? ingestRss(source) : ingestHtml(source);
}

function dedupe(items: RawItem[]): RawItem[] {
  const urls = new Set<string>();
  const titles = new Set<string>();
  const result: RawItem[] = [];

  for (const item of items) {
    const urlKey = canonicalizeUrl(item.url);
    const titleKey = normalizeText(item.title);

    if (urls.has(urlKey) || (titleKey.length > 20 && titles.has(titleKey))) continue;

    urls.add(urlKey);
    titles.add(titleKey);
    result.push(item);
  }

  return result;
}

export interface DiscoveryResult {
  candidates: Candidate[];
  discovered: number;
  unique: number;
  selected: number;
  sourcesAttempted: number;
  errors: Array<{ source: string; error: string }>;
  generatedAt: string;
}

export async function discoverCandidates(options?: {
  minScore?: number;
  maxRisk?: number;
  limit?: number;
}): Promise<DiscoveryResult> {
  const { sources, editorial, scoring } = loadConfig();
  const allItems: RawItem[] = [];
  const errors: Array<{ source: string; error: string }> = [];

  for (let i = 0; i < sources.length; i += 4) {
    const batch = sources.slice(i, i + 4);
    const results = await Promise.all(
      batch.map(async (source) => {
        try {
          const items = await ingestSource(source);
          console.log(`${source.name}: discovered ${items.length}`);
          return items;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ source: source.name, error: message });
          console.error(`${source.name}: ${message}`);
          return [];
        }
      })
    );
    allItems.push(...results.flat());
  }

  const unique = dedupe(allItems);
  const candidates: Candidate[] = unique.map((item) => {
    const topics = classifyTopics(item, editorial);
    const scores = scoreItem(item, topics, editorial, scoring);

    return {
      ...item,
      topics,
      scores,
      primarySourceUrl: item.url,
      originalReportingUrl: item.url,
      keyFacts: [],
    };
  });

  const minScore =
    options?.minScore ??
    Number(process.env.MIN_PSA_SCORE || scoring.thresholds.minimum_candidate_score);
  const maxRisk =
    options?.maxRisk ??
    Number(process.env.MAX_COMMUNITY_RISK || scoring.thresholds.maximum_community_risk);
  const limit = options?.limit ?? Number(process.env.MAX_CANDIDATES || 25);

  const selected = candidates
    .filter(
      (candidate) =>
        !candidate.scores.excluded &&
        candidate.scores.total >= minScore &&
        candidate.scores.community_risk < maxRisk
    )
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, limit);

  return {
    candidates: selected,
    discovered: allItems.length,
    unique: unique.length,
    selected: selected.length,
    sourcesAttempted: sources.length,
    errors,
    generatedAt: new Date().toISOString(),
  };
}
