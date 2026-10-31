# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in the Posh Paws monorepo.

## Layout

One git repo, three independent apps. Each app has its own dependencies, lock file and tooling; nothing is shared through a package. Run every command from inside the app's folder.

| Folder | What | Stack | Local URL | App guide |
|---|---|---|---|---|
| `customer/` | Customer website + booking flow | Angular 21 | http://localhost:4200 | `customer/CLAUDE.md` |
| `admin/` | Staff dashboard (not started) | Angular, same structure as customer | http://localhost:4300 | `admin/README.md` |
| `backend/` | REST API for both front-ends | Python FastAPI | http://localhost:8000/api | `backend/README.md` |

`netlify.toml` (root) deploys `customer/`.

## Principles

- **Keep it simple.** Few files, standard folders, no extra abstraction layers. Ask before adding a new pattern or layer.
- **Front-ends talk to the backend only over HTTP.** API URLs come from each Angular app's `src/environments/`. No front-end imports code from another app.
- **The backend owns the data and business rules** (prices, slot availability, booking rules). Front-ends display and submit.

## API contract (all apps follow it)

- JSON over REST, under `/api`. Routes are plural nouns: `/api/pets`, `/api/bookings/{id}`.
- **JSON field names are camelCase** (`pricePaise`, `durationMinutes`), so Angular models match the API one-to-one. The backend converts from its snake_case Python names.
- **Money is integer paise** (`120000` = ₹1,200). Dates are `YYYY-MM-DD`, times `HH:mm`, timestamps ISO 8601.
- **Errors use FastAPI's shape**: `{"detail": "Human-readable message"}` with the right HTTP status (400 bad input, 401 not logged in, 403 not allowed, 404 not found, 409 conflict such as a slot already taken, 422 validation). Angular's error interceptor shows `detail` to the user.
- When a model or route changes, update the backend schema and the Angular model in the same change.
