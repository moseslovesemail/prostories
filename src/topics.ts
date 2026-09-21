import type { RawItem } from "./types.js";
import type { EditorialConfig } from "./config.js";
import { containsTerm } from "./utils.js";

export function classifyTopics(
  item: RawItem,
  editorial: EditorialConfig
): string[] {
  const text = `${item.title} ${item.summary}`;
  const topics = new Set(item.defaultTopics);

  for (const [topic, keywords] of Object.entries(editorial.topic_keywords)) {
    if (keywords.some((keyword) => containsTerm(text, keyword))) {
      topics.add(topic);
    }
  }

  return [...topics].sort();
}
