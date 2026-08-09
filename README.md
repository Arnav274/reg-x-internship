# AI Ticketing System

An embeddable feedback/ticketing widget for logged-in users of an existing product. It auto-captures who the user is and which page they're on, uses an AI model to suggest a category (High/Medium/Low/Suggestion/Request) for a free-text issue description, and lets the user accept or override that suggestion before submitting. Tickets are persisted via a REST API into Postgres, tagged by page and category, so the product's surfaces can be compared by issue volume and severity.

See [docs/architecture.md](docs/architecture.md) for the full architecture and design rationale.

## Setup

Requires Docker (with Compose v2) and Node.js 24 for the widget's dev server.

```sh
cp .env.example .env      # required: Compose reads .env and will not start without it
docker compose up --build
```

That brings up Postgres and the backend on `http://localhost:3000` (`GET /health` to confirm).
The database schema is applied automatically the first time the `db` volume is created.

The widget is not containerised, so run its dev server separately:

```sh
cd frontend-widget
npm install
npm run dev
```

### AI classification

`.env.example` ships `AI_PROVIDER_API_KEY` as a placeholder. Left as-is, everything runs
normally but category suggestions always fail and the widget falls back to manual selection.
That fallback is intended behaviour, not a failure state. AI mode is designed to degrade
quietly rather than block ticket submission.

For live suggestions, replace the placeholder with a real
[Groq](https://console.groq.com) API key.
