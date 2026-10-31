# Posh Paws: admin

Staff dashboard: bookings calendar, customers, pets, services and prices, memberships.

**Not started yet.** When we begin, create it here as its own Angular app with its own dependencies:

```bash
# from the repo root
npx @angular/cli@21 new admin --directory admin --style scss --routing --ssr false
# then serve it on its own port so it can run next to the customer app
npm start -- --port 4300
```

It will follow the same folder structure and conventions as `customer/` (see `customer/CLAUDE.md`), and call the same backend at `http://localhost:8000/api`.
