# Backend plan

How we build the backend, one module at a time, learning as we go. Tick a module off when it's done.

- **Phase 1:** the backend for the grooming app we have today. Admin side first, then the customer side. **It goes live as soon as it's complete** (see "Going live" below; the outside approvals take longer than the code, so start them now).
- **Phase 2** (about two months later, not now): new modules, a **store** and **doctor appointments**. Phase 1 is shaped so they plug in without rework.

---

## 1. The big picture

Today both apps answer themselves with demo data in the browser (`core/mocks`). The backend replaces that with one real server everyone shares.

```
Customer app ─┐                       ┌─► Database (PostgreSQL): customers, pets, bookings, payments…
              ├─► API server (FastAPI) ┼─► File storage: banner and gallery photos
Admin app ────┘    "the backend"       ├─► SMS/WhatsApp provider: login codes, messages     (later)
                                       └─► Payment gateway (Razorpay): advance, links, refunds (later)
```

- **API server:** waits for requests like "give me today's bookings" or "confirm PP-1049", checks the rules (slots, prices, who's allowed) and answers in JSON. The apps already send exactly these requests; the mocks catch them today.
- **Database:** where data lives permanently, in tables (like spreadsheets with strict columns).
- **File storage:** photos are too big for the database; they live in a store and the database keeps their links.
- **Outside services:** for sending OTP codes and taking real payments. These come last.

## 2. What we need (server requirements)

| Need | Recommendation | Cost to start | When |
|---|---|---|---|
| Python 3.12+ on the Mac | python.org installer (the Mac has 3.9, too old) | Free | Module 0 |
| A database on the Mac for learning | **Postgres.app** (one download, press Initialize) | Free | Module 0 |
| A tool to look inside the database | **TablePlus** or **DBeaver** | Free | Module 0 |
| The database online | **Supabase**: PostgreSQL + photo storage in one account, Mumbai/Singapore region | Free plan | First deploy |
| Running the API online | **Render**: deploys from GitHub, like Netlify | Free plan | First deploy |
| OTP codes for customer login | MSG91 or similar (SMS in India needs DLT registration) | Per message | Module 9 |
| Payment gateway | **Razorpay**: UPI, payment links, refunds | % per payment | Module 12 |

Free plans are fine for building and testing. Render's free API sleeps when unused (the first request after a while takes 30–60 s), and Supabase pauses idle free projects. When real customers use it, expect roughly $7/month (Render) + $25/month (Supabase); confirm prices when signing up. **Nothing to buy to start:** we build every module on the Mac first and deploy once at the end (decided 18 Nov 2026).

## 3. Tools inside the backend

- **FastAPI:** turns Python functions into API endpoints.
- **SQLAlchemy:** describes tables as Python classes instead of raw SQL.
- **Alembic:** a versioned history of table changes ("migrations"), so the Mac and the online database always match.
- **Pydantic:** the exact shape of each request and response; turns `price_paise` into the apps' `pricePaise`.
- **pytest:** automatic tests for the rules, like the 59 the admin mocks already have.

Every request goes **route → service → database**: the route receives it, the service applies the rules, the database stores the result.

## 4. Built for growth (store and doctor appointments later)

**Shared, built once and used by every module** (`app/shared/`):
- **Customer accounts and pets:** one login and one pet profile for grooming, store and vet.
- **Staff, login and roles:** roles live in one permissions list, so "Doctor" or "Store manager" is a small addition.
- **Payments and refunds:** a payment records what it's for (booking, order, vet visit, plan), not only grooming. Razorpay, the Payments page and refunds work once for everything.
- **Notifications and message templates,** grouped by module.
- **Settings:** business-wide (name, address, payments) and per module (grooming hours; later delivery and clinic hours).
- **Photo storage:** banners and gallery now; product photos and medical documents later.
- **One database** for everything, so a customer's bookings, orders and vet visits sit together.

**Per module:**
- `app/grooming/`: services, stations, slots, bookings, plans (now).
- `app/shop/`: products, stock, cart, orders, delivery (Phase 2).
- `app/vet/`: doctors, consultations, medical records (Phase 2).

**Slots are written for anything bookable.** Opening hours, breaks, closures, buffer, the slot board and "no double booking" work on resources: stations for grooming now, doctors for the vet module later.

**Code layout:** one folder per topic inside a module, always `models.py`, `schemas.py`, `service.py`, `routes.py` (see `README.md`). A module may use `shared/` and `core/`, never another module. API addresses follow the split: `/api/admin/bookings` now, later `/api/admin/shop/orders` and `/api/admin/vet/appointments`.

## 5. How each module goes (the learning loop)

1. **Explain** the idea in plain words (e.g. "what is a login token").
2. **Design together:** the tables and endpoints, taken from what the admin already calls (`admin/src/app/core/constants/api-endpoints.ts`) and the rules in the root `CLAUDE.md`.
3. **Build:** model → schema → service → route → tests, explaining each file.
4. **Switch that one area** of the admin from mocks to the real API; everything else stays on mocks. (Needs one small change first: a list of "live" areas in the admin's environment file.)
5. **Check in the browser,** then review and commit.

## 6. Modules

### Phase 1: admin side
- [x] **0. Foundations:** what an API is, requests/responses, status codes, tables, migrations. The project connects to Postgres; error format; camelCase.
- [x] **1. Authentication & team:** password hashing, login tokens (JWT), roles and 403. Real sign-in, Super Admin / Admin / Staff, Team & roles.
- [x] **2. Settings & message templates:** basic create/read/update/delete and validation.
- [x] **3. Catalog:** services, stations, membership plans, offers (ordering, archiving, unique codes).
- [x] **4. Customers & pets:** relations (one customer, many pets), pagination, search.
- [x] **5. Bookings & slots** (the heart): slots, slot board, calendar, block time, New booking, reschedule, cancel, complete / no-show; stopping two people from taking the same slot (the database's `no_double_booking` rule). Bills with offers. Backend and tests only: see the note below.
- [x] **6. Money:** payment records on bookings (advance, links, shop payments, checkout, refunds, payment status), Payments, Today dashboard. Backend and tests only, like Module 5; Today's membership numbers come with Module 7 and its content reminders with Module 8.
- [x] **7. Subscriptions:** memberships, plan sessions and member discounts on bills, plan changes and renewal links.
  Then the admin switched **Bookings, Availability › Day, the calendar, Payments, Subscriptions, Today and search** to the backend together (with a demo bookings seed), and customer numbers, pet visits and a holiday's "bookings to move" are worked out from bookings.
  Still to come: joining a plan (customers, in the app: Module 11), and paying plan links for real plus the daily job that ends unpaid memberships (Module 12).
  *Why together:* a booking's bill depends on the customer's membership, and paying or cancelling changes both, so switching one of them alone would show wrong bills.
- [x] **8. Content & photos:** banners, gallery, pages & FAQs, photo uploads (a folder on the Mac for now). With this the whole admin runs on the backend.

### Phase 1: customer side (reuses most of the admin work)
- [ ] **9. Customer login:** phone + OTP code, registration.
- [ ] **10. Public data:** services, plans, open slots, shop info, content.
- [ ] **11. Customer bookings, pets, membership:** book, cancel, My bookings, the plan card.
- [ ] **12. Payment gateway (Razorpay):** real advance payments, payment links, refunds, webhooks (Razorpay telling us a payment went through). Until then, payment links stay demo links.
- [ ] **13. WhatsApp sending** (after launch is fine): messages go out automatically instead of through "Open WhatsApp".

### Phase 2 (about two months later)
- [ ] **Store:** products, stock, cart, orders, delivery.
- [ ] **Doctor appointments:** doctors, consultations, medical records; reuses the slot rules.

## 7. Going live

**Start now, in parallel with the code** (approvals take days to weeks):
- [ ] **Razorpay account** + KYC (PAN, business bank account, business details): about 2–7 days. Needed for the app's ₹100 advance (Module 12).
- [ ] **Login codes:** either SMS through a provider like MSG91, which needs **DLT registration** (business entity, sender name, approved message wording, about 1–2 weeks), or codes on WhatsApp through a provider (Meta business verification, some days). Needed for customer login (Module 9).
- [ ] **Domain name** (optional but nicer): e.g. `poshpaws.in` for the app, `admin.poshpaws.in`, `api.poshpaws.in`.

**Needed on launch day:** Modules 0–12, all built and checked on the Mac, then the deploy. Module 13 (automatic WhatsApp) can follow; staff keep using "Open WhatsApp" until then. If time is short, content (Module 8) can also follow, since the customer app's pages work without it.

**The deploy** (once, after the modules; about a day, plus time to fix what only shows up online):
- [ ] **Supabase** (database and photos): an account (sign in with GitHub), a project in the **Singapore** region with a strong database password you keep safe. The app connects through the **Session pooler** address (Render can't reach the direct address). A public **Storage bucket** for photos; `store()` in `app/shared/uploads/service.py` changes to put photos there (it speaks the S3 protocol, so AWS S3 or Cloudflare R2 would work the same way).
- [ ] **Render** (API): an account (sign in with GitHub) with access to the `posh-paws` repo, a web service from `backend/`, Singapore region (next to the database). Its environment variables: `DATABASE_URL` (pasted by you from Supabase; nobody else needs to see it), `SECRET_KEY` (a long random value), `CORS_ORIGINS` (the admin's and customer app's Netlify addresses). Migrations run when the service starts.
- [ ] **The first Super Admin** account created with a small command (your real email and a password you choose); everyone else is added from Team & roles.
- [ ] **Both apps** rebuilt with the real `apiUrl` and uploaded to Netlify.

**At launch, switch hosting to paid plans:** free plans sleep and have no backups, which isn't acceptable with real customers. Roughly $7/month (Render) + $25/month (Supabase, includes daily backups). Then:
- [ ] Both apps: `useMocks: false` and the real `apiUrl`; rebuild and upload to Netlify.
- [ ] Real staff accounts created; the demo sign-in buttons gone.
- [ ] Razorpay switched from test mode to live mode.
- [ ] Settings checked: hours, breaks, closures, advance amount, UPI ID and QR, message templates.

## 8. Before Module 0

Done on 16 Nov 2026: Python 3.13 and PostgreSQL 17 (Homebrew, running as a service), TablePlus; databases `posh_paws` and `posh_paws_test`.

## 9. Decisions

- Decided: backend organised by module (`core/`, `shared/`, `grooming/`, later `shop/` and `vet/`).
- Decided (18 Nov 2026): finish all Phase 1 modules locally, then deploy once.
- Recommended, confirm at the deploy: Render (API) + Supabase (database and photos), both in Singapore.
- Open, decide when we get there: OTP provider (Module 9), payment gateway (Module 12), WhatsApp sending (Module 13).
