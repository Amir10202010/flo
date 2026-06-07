# Roadmap

Phase 1: Foundation — DONE
- Prisma schema, auth, basic pages, dashboard layout

Phase 2: Gmail Integration — DONE
- OAuth2 connect flow (/api/auth/gmail → callback)
- Token storage in Integration table (with refresh)
- Gmail thread sync service (50 threads, last 20 msgs each)
- /api/integrations (GET list, DELETE disconnect)
- /api/integrations/gmail/sync (POST trigger)
- Integrations page: connect / sync now / disconnect
- Inbox: real conversations from DB, split-view with message thread

Phase 3: AI Intelligence — TODO
Phase 3: AI Intelligence — TODO
Phase 4: Telegram Integration — TODO
Phase 5: Polish & Production — TODO
