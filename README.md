# CC Livestock

Cattle fattening ERP: stock intake, batches, weight/ADG tracking, health, feed inventory, sales and finance, analytics, and role-based farm access. Built with Next.js (App Router), PostgreSQL, and a standalone Express API.

## Getting started

```bash
cp .env.example .env     # set DB_* and JWT_SECRET
npm install
npm run dev              # web app on http://localhost:3000
npm run server           # Express API (run alongside for the daily feed job)
```

Default database name is `cc_livestock`. See `CLAUDE.md` for architecture and commands, and `.env.example` for configuration.
