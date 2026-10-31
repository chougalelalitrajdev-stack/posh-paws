# Posh Paws: admin

Staff dashboard: requests, bookings, customers, pets, catalog, content, payments and settings.
Built from the "Posh Paws Admin" design.

```bash
npm install          # once (uses the same versions as customer/)
npm start            # http://localhost:4300
npm run build        # → dist/admin/browser
npm test             # Vitest unit tests
npm run lint:styles  # style guard rails
```

Until the backend exists, `src/app/core/mocks` answers every API call. Demo accounts (password `pawsword`):
`owner@poshpaws.in` (Super Admin), `meera@poshpaws.in` (Admin), `amit@poshpaws.in` (Staff).

Conventions and folder layout: see `CLAUDE.md`.
