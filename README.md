# Pro Stories Aotearoa

PSA is a human-moderated, source-led publishing system for constructive stories from Aotearoa and the world.

## Editorial principle

**Facts first. Sources visible. Humans have the personality.**

The engine discovers candidate stories, removes obvious conflict/outrage material, classifies and scores what remains, and sends candidates into WordPress. Nothing is published automatically.

## V1 flow

```
approved sources
  -> RSS / HTML discovery
  -> normalize + dedupe
  -> exclusion rules
  -> topic classification
  -> PSA fit + community-risk scores
  -> WordPress PSA Story Desk
  -> Moses / Sarah edit and add a take
  -> human approval
  -> published article with original-source backlinks
```

## Repo layout

- `config/sources.yml` — source registry
- `config/editorial.yml` — topics and hard exclusions
- `config/scoring.yml` — deterministic V1 scoring model
- `src/` — ingestion and scoring engine
- `wordpress-plugin/` — PSA Story Desk plugin
- `.env.example` — Railway/WordPress configuration

## Local run

```bash
npm install
cp .env.example .env
npm run ingest
```

## Railway

Use the repo as a Railway service and schedule:

```
npm run ingest
```

The process is designed to run as a cron job and exit.

## Guardrail

The engine may create **editorial candidates only**. It does not publish public stories or social posts without a human editorial action.
