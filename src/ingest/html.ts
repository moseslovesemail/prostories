import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types.js";
import { canonicalizeUrl, stripHtml, truncate } from "../utils.js";

const BLOCKED_LABELS = new Set([
  "read more",
  "learn more",
  "view all",
  "more",
  "home",
  "news",
  "contact",
  "about",
  "subscribe",
  "menu",
]);

export async function ingestHtml(source: SourceConfig): Promise<RawItem[]> {
  const response = await fetch(source.ingest.url, {
    headers: {
      "User-Agent": process.env.USER_AGENT || "ProStoriesAotearoa/0.1",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`${source.name}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const sourceHost = new URL(source.ingest.url).host;
  const seen = new Set<string>();
  const items: RawItem[] = [];

  const anchors = $(
    "article h1 a[href], article h2 a[href], article h3 a[href], main h1 a[href], main h2 a[href], main h3 a[href], article a[href]"
  ).toArray();

  for (const element of anchors) {
    if (items.length >= 60) break;

    const anchor = $(element);
    const title = stripHtml(anchor.text());
    const normalizedLabel = title.toLowerCase().trim();

    if (title.length < 18 || BLOCKED_LABELS.has(normalizedLabel)) continue;

    const href = anchor.attr("href");
    if (!href) continue;

    let url: URL;
    try {
      url = new URL(href, source.ingest.url);
    } catch {
      continue;
    }

    if (!["http:", "https:"].includes(url.protocol)) continue;
    if (url.host !== sourceHost) continue;

    const canonical = canonicalizeUrl(url.toString());
    if (canonical === canonicalizeUrl(source.ingest.url) || seen.has(canonical)) continue;
    seen.add(canonical);

    const container = anchor.closest("article").length
      ? anchor.closest("article")
      : anchor.parent().parent();

    const time = container.find("time").first();
    const publishedAt = time.attr("datetime") || stripHtml(time.text()) || undefined;
    const summary = truncate(stripHtml(container.text().replace(title, "")), 700);

    items.push({
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.source_type,
      country: source.country,
      trust: source.trust,
      sourceWeight: source.weight,
      defaultTopics: source.topics,
      title,
      url: canonical,
      summary,
      publishedAt,
    });
  }

  return items;
}
