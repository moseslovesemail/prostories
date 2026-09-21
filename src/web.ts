import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { discoverCandidates, type DiscoveryResult } from "./discover.js";

const PORT = Number(process.env.PORT || 3000);
const CACHE_MS = Number(process.env.PLAYGROUND_CACHE_MS || 10 * 60 * 1000);
const LIMIT = Number(process.env.PLAYGROUND_LIMIT || 40);
const page = fs.readFileSync(path.resolve(process.cwd(), "public/index.html"), "utf8");

let cache: { at: number; result: DiscoveryResult } | null = null;
let running: Promise<DiscoveryResult> | null = null;

function json(res: http.ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function getDiscovery(force = false): Promise<DiscoveryResult> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.result;
  if (running) return running;

  running = discoverCandidates({
    minScore: Number(process.env.PLAYGROUND_MIN_SCORE || 50),
    maxRisk: Number(process.env.PLAYGROUND_MAX_RISK || 70),
    limit: LIMIT,
  })
    .then((result) => {
      cache = { at: Date.now(), result };
      return result;
    })
    .finally(() => {
      running = null;
    });

  return running;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/discover") {
    try {
      const result = await getDiscovery(url.searchParams.get("refresh") === "1");
      json(res, 200, result);
    } catch (error) {
      json(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (url.pathname === "/") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(page);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`PSA playground listening on port ${PORT}`);
});
