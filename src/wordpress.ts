import type { Candidate } from "./types.js";

function envBool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export async function sendCandidate(candidate: Candidate): Promise<void> {
  const dryRun = envBool("DRY_RUN", true);
  const base = (process.env.WORDPRESS_BASE_URL || "").replace(/\/$/, "");
  const username = process.env.WORDPRESS_USERNAME || "";
  const password = process.env.WORDPRESS_APPLICATION_PASSWORD || "";

  if (dryRun || !base) {
    console.log(
      JSON.stringify(
        {
          dry_run: true,
          title: candidate.title,
          url: candidate.url,
          topics: candidate.topics,
          scores: candidate.scores,
        },
        null,
        2
      )
    );
    return;
  }

  if (!username || !password) {
    throw new Error(
      "WORDPRESS_USERNAME and WORDPRESS_APPLICATION_PASSWORD are required when DRY_RUN=false"
    );
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch(`${base}/wp-json/psa/v1/candidates`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "User-Agent": process.env.USER_AGENT || "ProStoriesAotearoa/0.1",
    },
    body: JSON.stringify({
      title: candidate.title,
      original_url: candidate.url,
      original_reporting_url: candidate.originalReportingUrl,
      primary_source_url: candidate.primarySourceUrl,
      source_name: candidate.sourceName,
      source_registry_id: candidate.sourceId,
      source_type: candidate.sourceType,
      source_country: candidate.country,
      published_at: candidate.publishedAt || "",
      summary: candidate.summary,
      topics: candidate.topics,
      scores: candidate.scores,
      key_facts: candidate.keyFacts,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WordPress ${response.status}: ${body.slice(0, 500)}`);
  }

  const result = (await response.json()) as { duplicate?: boolean; id?: number };
  console.log(
    `WordPress candidate: ${candidate.title} (id=${result.id ?? "?"}, duplicate=${
      result.duplicate ? "yes" : "no"
    })`
  );
}
