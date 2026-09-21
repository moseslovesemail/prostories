import crypto from "node:crypto";

export function stripHtml(input = ""): string {
  return input
    .replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
    .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\\s+/g, " ")
    .trim();
}

export function truncate(input: string, max = 700): string {
  const clean = input.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
}

export function canonicalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["fbclid", "gclid"].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    const result = url.toString();
    return result.endsWith("/") ? result.slice(0, -1) : result;
  } catch {
    return input.trim();
  }
}

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9āēīōū\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashUrl(input: string): string {
  return crypto.createHash("sha256").update(canonicalizeUrl(input)).digest("hex");
}

export function containsTerm(text: string, term: string): boolean {
  return normalizeText(text).includes(normalizeText(term));
}
