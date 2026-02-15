# ProduceThing

AI-powered layer-by-layer music composition. Describe a vibe, generate stems, add/remove/regenerate individual layers — all through natural language.

Built at TreeHacks 2026.

## Setup

```bash
cd app
cp .env.example .env.local
npm install
npm run dev
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `SUNO_API_KEY` | Yes | Suno API bearer token for music generation + stem separation |
| `OPENAI_API_KEY` | Yes | OpenAI key for the AI chat assistant (gpt-4o-mini) |

### Requirements

- Node.js 18+
- npm

## Stack

Next.js 16 / React 19 / Tailwind CSS / Vercel AI SDK / waveform-playlist / Suno API
