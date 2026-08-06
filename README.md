# AI Ticketing System

An embeddable feedback/ticketing widget for logged-in users of an existing product. It auto-captures who the user is and which page they're on, uses an AI model to suggest a category (High/Medium/Low/Suggestion/Request) for a free-text issue description, and lets the user accept or override that suggestion before submitting. Tickets are persisted via a REST API into Postgres, tagged by page and category, so the product's surfaces can be compared by issue volume and severity.

See [docs/architecture.md](docs/architecture.md) for the full architecture and design rationale.

## Setup

Setup instructions coming soon.
