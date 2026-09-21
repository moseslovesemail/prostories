import Parser from "rss-parser";
import type { RawItem, SourceConfig } from "../types.js";
import { canonicalizeUrl, stripHtml, truncate } from "../utils.js";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": process.env.USER_AGENT || "ProStoriesAotearoa/0.1",
  },
});

export async function ingestRss(source: SourceConfig): Promise<RawItem[]> {
  const feed = await parser.parseURL(source.ingest.url);

  return (feed.items || [])
    .filter((item) => item.title && item.link)
    .slice(0, 60)
    .map((item) => ({
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.source_type,
      country: source.country,
      trust: source.trust,
      sourceWeight: source.weight,
      defaultTopics: source.topics,
      title: stripHtml(item.title || ""),
      url: canonicalizeUrl(item.link || ""),
      summary: truncate(
        stripHtml(
          (item.contentSnippet as string | undefined) ||
            (item.content as string | undefined) ||
            (item.summary as string | undefined) ||
            ""
        )
      ),
      publishedAt:
        (item.isoDate as string | undefined) ||
        (item.pubDate as string | undefined) ||
        undefined,
    }));
}
