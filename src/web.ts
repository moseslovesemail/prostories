import http from "node:http";
import { discoverCandidates, type DiscoveryResult } from "./discover.js";

const PORT = Number(process.env.PORT || 3000);
const CACHE_MS = Number(process.env.PLAYGROUND_CACHE_MS || 10 * 60 * 1000);
const LIMIT = Number(process.env.PLAYGROUND_LIMIT || 40);

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

const page = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pro Stories Aotearoa — Story Desk</title>
<style>
:root{--ink:#0b0b0b;--muted:#707070;--line:#e7e7e7;--soft:#f7f7f5;--green:#0b5d3b}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font-family:Arial,Helvetica,sans-serif}
.shell{max-width:1180px;margin:0 auto;padding:34px 28px 80px}
.top{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:28px;border-bottom:1px solid var(--line)}
.brand{font-size:14px;letter-spacing:.14em;font-weight:700;line-height:1.4}
.kicker{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
h1{font-size:clamp(34px,6vw,72px);line-height:.95;letter-spacing:-.055em;margin:38px 0 16px;max-width:860px}
.intro{max-width:720px;color:#333;font-size:18px;line-height:1.55;margin:0 0 28px}
button,.btn{appearance:none;border:1px solid var(--ink);background:#fff;color:var(--ink);font:inherit;font-size:13px;padding:11px 15px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px}
button.primary{background:var(--ink);color:#fff}
button:disabled{opacity:.45;cursor:wait}
.controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:28px 0}
input,select,textarea{border:1px solid #d7d7d7;background:#fff;color:var(--ink);font:inherit;padding:10px 12px}
input{min-width:250px;flex:1}
select{min-width:170px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin:25px 0 34px}
.stat{background:#fff;padding:18px}
.stat b{font-size:28px;letter-spacing:-.04em;display:block}
.stat span{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.status{font-size:13px;color:var(--muted);margin-left:auto}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.card{border:1px solid var(--line);padding:22px;display:flex;flex-direction:column;min-height:330px}
.card.kept{outline:2px solid var(--ink)}
.card.passed{opacity:.42}
.meta{display:flex;gap:7px;flex-wrap:wrap;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.score{font-weight:700;color:var(--ink)}
.risk.low{color:var(--green)}
.card h2{font-size:25px;line-height:1.08;letter-spacing:-.035em;margin:16px 0 12px}
.summary{font-size:14px;line-height:1.55;color:#373737;margin-bottom:18px}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin:auto 0 18px}
.tag{background:var(--soft);font-size:11px;padding:5px 7px}
.actions{display:flex;gap:7px;flex-wrap:wrap;padding-top:16px;border-top:1px solid var(--line)}
.actions button,.actions .btn{font-size:12px;padding:8px 10px}
.notes{display:none;padding-top:14px}
.notes.open{display:block}
.notes label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:10px 0 5px;color:var(--muted)}
.notes textarea{width:100%;min-height:76px;resize:vertical}
.empty{border-top:1px solid var(--line);padding:38px 0;color:var(--muted)}
.errorbox{margin:18px 0;padding:14px;border:1px solid var(--line);background:var(--soft);font-size:12px;color:#444}
.footer{margin-top:52px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
@media(max-width:760px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}.top{display:block}.status{width:100%;margin:0}.shell{padding:24px 18px 60px}}
</style>
</head>
<body>
<main class="shell">
  <div class="top">
    <div>
      <div class="kicker">Editorial playground</div>
      <div class="brand">PRO STORIES<br>AOTEAROA</div>
    </div>
    <div style="max-width:330px;font-size:13px;line-height:1.5;color:#555">
      Facts first. Sources visible. Humans have the personality.
    </div>
  </div>

  <h1>The interesting parts of what's happening, without all the yelling.</h1>
  <p class="intro">Run the live PSA discovery engine, browse what it finds, and test the editorial workflow. Keep, pass and add your own takes. Nothing here publishes anywhere.</p>

  <div class="controls">
    <button id="run" class="primary">RUN LIVE DISCOVERY</button>
    <input id="search" placeholder="Search stories, sources or topics">
    <select id="topic"><option value="">All topics</option></select>
    <select id="decision">
      <option value="">All decisions</option>
      <option value="keep">Kept</option>
      <option value="pass">Passed</option>
      <option value="undecided">Undecided</option>
    </select>
    <div id="status" class="status">Ready</div>
  </div>

  <div class="stats">
    <div class="stat"><b id="sDiscovered">—</b><span>Discovered</span></div>
    <div class="stat"><b id="sUnique">—</b><span>Unique</span></div>
    <div class="stat"><b id="sSelected">—</b><span>Shown</span></div>
    <div class="stat"><b id="sErrors">—</b><span>Source errors</span></div>
  </div>

  <div id="errors"></div>
  <section id="grid" class="grid"></section>
  <div id="empty" class="empty">Run live discovery to load PSA candidates.</div>

  <div class="footer">Playground state is stored only in this browser. It does not publish, alter sources, or send content to WordPress.</div>
</main>
<script>
const state = { items: [], result: null };
const saved = JSON.parse(localStorage.getItem("psa-editorial") || "{}");

const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","'":"&#039;"}[c]));
const keyFor = item => item.url;
const editorial = item => saved[keyFor(item)] || { decision:"", moses:"", sarah:"" };

function persist(item, patch){
  saved[keyFor(item)] = {...editorial(item), ...patch};
  localStorage.setItem("psa-editorial", JSON.stringify(saved));
  render();
}

function populateTopics(){
  const select = document.getElementById("topic");
  const current = select.value;
  const topics = [...new Set(state.items.flatMap(i => i.topics || []))].sort();
  select.innerHTML = '<option value="">All topics</option>' + topics.map(t => '<option>'+esc(t)+'</option>').join("");
  select.value = current;
}

function render(){
  const q = document.getElementById("search").value.trim().toLowerCase();
  const topic = document.getElementById("topic").value;
  const decision = document.getElementById("decision").value;
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");

  const filtered = state.items.filter(item => {
    const e = editorial(item);
    const hay = [item.title,item.sourceName,item.summary,...(item.topics||[])].join(" ").toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (topic && !(item.topics||[]).includes(topic)) return false;
    if (decision === "undecided" && e.decision) return false;
    if ((decision === "keep" || decision === "pass") && e.decision !== decision) return false;
    return true;
  });

  empty.style.display = filtered.length ? "none" : "block";
  if (!filtered.length) {
    if (state.items.length) empty.textContent = "No stories match those filters.";
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = filtered.map((item, idx) => {
    const e = editorial(item);
    const riskClass = item.scores.community_risk <= 25 ? "low" : "";
    const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}) : "";
    return `
    <article class="card ${e.decision === "keep" ? "kept" : ""} ${e.decision === "pass" ? "passed" : ""}" data-url="${esc(item.url)}">
      <div class="meta">
        <span class="score">PSA ${item.scores.total}</span>
        <span class="risk ${riskClass}">Risk ${item.scores.community_risk}</span>
        <span>${esc(item.sourceName)}</span>
        ${date ? '<span>'+esc(date)+'</span>' : ''}
      </div>
      <h2>${esc(item.title)}</h2>
      <div class="summary">${esc(item.summary || "No source summary available. Open the original for context.")}</div>
      <div class="tags">${(item.topics||[]).map(t => '<span class="tag">'+esc(t)+'</span>').join("")}</div>
      <div class="actions">
        <a class="btn" href="${esc(item.url)}" target="_blank" rel="noopener">OPEN SOURCE ↗</a>
        <button data-action="keep" data-idx="${idx}">${e.decision === "keep" ? "✓ KEPT" : "KEEP"}</button>
        <button data-action="pass" data-idx="${idx}">${e.decision === "pass" ? "✓ PASSED" : "PASS"}</button>
        <button data-action="notes" data-idx="${idx}">ADD TAKE</button>
      </div>
      <div class="notes ${(e.moses || e.sarah) ? "open" : ""}" id="notes-${idx}">
        <label>Moses' take</label>
        <textarea data-note="moses" data-idx="${idx}" placeholder="Optional human voice...">${esc(e.moses)}</textarea>
        <label>Sarah's take</label>
        <textarea data-note="sarah" data-idx="${idx}" placeholder="Optional human voice...">${esc(e.sarah)}</textarea>
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll("button[data-action]").forEach(btn => {
    btn.onclick = () => {
      const item = filtered[Number(btn.dataset.idx)];
      const action = btn.dataset.action;
      if (action === "keep") persist(item,{decision: editorial(item).decision === "keep" ? "" : "keep"});
      if (action === "pass") persist(item,{decision: editorial(item).decision === "pass" ? "" : "pass"});
      if (action === "notes") {
        btn.closest(".card").querySelector(".notes").classList.toggle("open");
      }
    };
  });

  grid.querySelectorAll("textarea[data-note]").forEach(area => {
    area.oninput = () => {
      const item = filtered[Number(area.dataset.idx)];
      saved[keyFor(item)] = {...editorial(item), [area.dataset.note]: area.value};
      localStorage.setItem("psa-editorial", JSON.stringify(saved));
    };
  });
}

async function run(force=true){
  const button = document.getElementById("run");
  const status = document.getElementById("status");
  button.disabled = true;
  button.textContent = "DISCOVERING…";
  status.textContent = "Checking PSA sources…";
  try{
    const response = await fetch("/api/discover" + (force ? "?refresh=1" : ""));
    const result = await response.json();
    if(!response.ok) throw new Error(result.error || "Discovery failed");
    state.result = result;
    state.items = result.candidates || [];
    document.getElementById("sDiscovered").textContent = result.discovered;
    document.getElementById("sUnique").textContent = result.unique;
    document.getElementById("sSelected").textContent = result.selected;
    document.getElementById("sErrors").textContent = result.errors.length;
    status.textContent = "Updated " + new Date(result.generatedAt).toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"});
    const errors = document.getElementById("errors");
    errors.innerHTML = result.errors.length
      ? '<div class="errorbox"><strong>'+result.errors.length+' sources need tuning:</strong> '+result.errors.map(e=>esc(e.source)).join(", ")+'</div>'
      : "";
    populateTopics();
    render();
  }catch(error){
    status.textContent = "Could not run discovery";
    document.getElementById("errors").innerHTML = '<div class="errorbox">'+esc(error.message)+'</div>';
  }finally{
    button.disabled = false;
    button.textContent = "RUN LIVE DISCOVERY";
  }
}

document.getElementById("run").onclick = () => run(true);
document.getElementById("search").oninput = render;
document.getElementById("topic").onchange = render;
document.getElementById("decision").onchange = render;
run(false);
</script>
</body>
</html>`;

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
