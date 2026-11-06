# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in the Posh Paws monorepo.

## Layout

One git repo, three independent apps. Each app has its own dependencies, lock file and tooling; nothing is shared through a package. Run every command from inside the app's folder.

| Folder | What | Stack | Local URL | App guide |
|---|---|---|---|---|
| `customer/` | Customer website + booking flow | Angular 21 | http://localhost:4200 | `customer/CLAUDE.md` |
| `admin/` | Staff dashboard | Angular 21, same structure as customer | http://localhost:4300 | `admin/CLAUDE.md` |
| `backend/` | REST API for both front-ends | Python FastAPI | http://localhost:8000/api | `backend/README.md` |

`netlify.toml` (root) deploys `customer/`.

## Principles

- **Keep it simple.** Few files, standard folders, no extra abstraction layers. Ask before adding a new pattern or layer.
- **Front-ends talk to the backend only over HTTP.** API URLs come from each Angular app's `src/environments/`. No front-end imports code from another app.
- **The backend owns the data and business rules** (prices, slot availability, booking rules). Front-ends display and submit.

## API contract (all apps follow it)

- JSON over REST, under `/api`. Routes are plural nouns: `/api/pets`, `/api/bookings/{id}`. Staff-only routes live under `/api/admin/...` and require a staff token (role checked server-side).
- **JSON field names are camelCase** (`pricePaise`, `durationMinutes`), so Angular models match the API one-to-one. The backend converts from its snake_case Python names.
- **Money is integer paise** (`120000` = ₹1,200). Dates are `YYYY-MM-DD`, times `HH:mm`, timestamps ISO 8601.
- **Errors use FastAPI's shape**: `{"detail": "Human-readable message"}` with the right HTTP status (400 bad input, 401 not logged in, 403 not allowed, 404 not found, 409 conflict such as a slot already taken, 422 validation). Angular's error interceptor shows `detail` to the user.
- When a model or route changes, update the backend schema and the Angular model in the same change.

## Booking & payment rules (both apps follow them; the backend owns them)

Agreed with the business on 2 Nov 2026. The server computes every number below; the apps only show them.

- **Two ways to book.** In the customer app the customer picks an open slot and pays an **advance** online, which confirms the booking. When a customer phones, staff book in the admin and the booking is **confirmed with no advance** (staff may still send a payment link if they want one). There is no third way: no callback requests or enquiry forms.
- **The bill** (same in both apps): service price → at most one discount → total. Discounts don't stack; the best one wins:
  - **Plan session:** a member with sessions left on a service their plan covers pays ₹0 and uses one session (reserved when the booking is confirmed, given back if it's cancelled, kept on a no-show).
  - **Member discount:** the plan's discount % on any other service.
  - **Offer:** a live offer (code or automatic) that applies to the service, used only if it beats the member discount. Its use is counted when the booking is confirmed and given back on cancel.
- **Advance** (app bookings): Settings › Payments hold amount (₹100), never more than the total, none when the total is ₹0. It counts toward the bill. Cancelled at least `freeCancellationHours` (24) before the slot: refunded automatically. Later, or a no-show: kept.
- **Balance** = total − paid. Paid at the shop by the shop's UPI QR, cash or card (staff record it, with the amount and method), or online by a payment link. Both apps show the bill, every payment and the balance.
- **Finishing a visit:** staff decide; nothing completes by itself, and a full payment alone doesn't mean the pet came (plan sessions and prepaid bookings are "paid" before the visit). Once the appointment has started, staff check the pet out: **Take payment & complete** (the balance by shop QR, cash or card, and *completed* in one step) or **Mark completed** when nothing is due, or **No-show** if the pet didn't come (advance and plan session kept, nothing more owed). Before the start time both are refused. An appointment that's over but not closed shows on Today ("Did Bruno come in?") until someone answers.
- **Payment status** comes from the money: `unpaid`, `link_sent`, `failed`, `part_paid`, `paid` (also when the total is ₹0), `refunded`.
- **Plan changes** (admin): an upgrade starts now; the customer pays the price difference for this period, gets the new plan's sessions minus those already used, and keeps the renewal date. A downgrade starts at the next renewal.
- **Slots:** a booking always holds one station for the service's length plus the cleaning buffer, whoever books it. Start times come every slot step inside the opening hours, minus breaks. Staff change them on Availability; the strongest wins: a **holiday** (closed all day, or closing early; also silences weekly extra times), then that **day's** changes, then the **weekly** pattern (a start time closed or added every week on a weekday), then the opening hours. Closing a time stops new bookings starting then (bookings already made stay); an extra time (after hours or in a break) still respects bookings, blocked time, buffer and notice. Per-station block time also applies. Both apps only ever offer the times the server lists.
