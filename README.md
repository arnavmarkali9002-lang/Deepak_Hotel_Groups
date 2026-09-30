# Sai View Hotels — booking site + admin dashboard (now connected)

A real backend now sits between the two pages: bookings made on the customer
site show up live in the admin dashboard, and pricing/hotel edits made in the
admin dashboard are reflected on the customer site. No fake or sample data
ships in this build — the booking list starts genuinely empty.

## Run it

Requires Node.js (no npm install needed — zero dependencies).

```
node server.js
```

Then open:
- **Customer site:** http://localhost:3000/
- **Admin dashboard:** http://localhost:3000/admin

Default admin login: **deepakhotelgroup** / **deepakhotelgroup@123**.

## How it's wired together

- `server.js` — a plain Node `http` server. No Express, no npm packages.
- `data/db.json` — created automatically on first run and used as the
  database (hotels, rooms/pricing, food menu, bookings, admin credentials).
  It's the single source of truth for both pages.
- `public/index.html` — the customer site. On load it fetches hotels, rooms
  and the menu from `/api/*`. Submitting the booking wizard sends a real
  `POST /api/bookings`; the server re-validates everything (phone format,
  room exists, no double-booking that room/date) and **recomputes the price
  itself** from the real menu/room rates rather than trusting whatever the
  browser sends — so a tampered request can't get a discount.
- `public/admin.html` — the dashboard. Login goes through `POST
  /api/admin/login`, which sets an HttpOnly session cookie; every other
  admin action (viewing bookings, changing a booking's status, editing
  pricing, editing hotel contact info) requires that cookie. The dashboard
  polls for new bookings every 20 seconds while open, so a booking made on
  the customer site shows up without a manual refresh.

## What to change before this goes live for real guests

1. **Admin credentials.** Configured with username `deepakhotelgroup` and password `deepakhotelgroup@123`. Edit `server.js` if you wish to change these credentials in the future.
2. **Put it behind HTTPS.** Session cookies are marked `HttpOnly` but not
   `Secure`; add a reverse proxy (nginx/Caddy) or a platform that terminates
   TLS, then set `Secure` on the cookie in `server.js`.
3. **ID photos.** Aadhar photos are stored as base64 inside `data/db.json`
   for simplicity. For real guest data, store them outside the JSON file
   (e.g. on disk or in object storage, encrypted, access-controlled per the
   Aadhar Act / DPDP Act) and keep only a reference in the database.
4. **Back up `data/db.json` regularly** — it's the only copy of your
   booking data. For anything beyond a single small property, moving to a
   real database (SQLite/Postgres) is worth it, but the JSON file will hold
   up fine for low-to-moderate volume.
5. **Payments and SMS/WhatsApp confirmation** are still not wired up —
   bookings are created as `pending` and the guest sees an on-screen
   booking ID; your team calls to confirm, same as before.

## API reference (for anyone extending this)

| Method | Path                          | Auth   | Purpose |
|---|---|---|---|
| GET  | `/api/hotels`                 | public | List hotels |
| PATCH| `/api/hotels/:id`             | admin  | Edit locality/phone |
| GET  | `/api/rooms`                  | public | List rooms + pricing |
| PATCH| `/api/rooms/:id`               | admin  | Edit one room's pricing |
| PATCH| `/api/rooms/bulk-pricing`      | admin  | Edit many rooms at once |
| GET  | `/api/menu`                    | public | Food menu (available dishes only, grouped by category) |
| GET  | `/api/menu/all`                | admin  | Every dish, including hidden ones |
| POST | `/api/menu`                    | admin  | Add a dish (name, category, price, photo) |
| PATCH| `/api/menu/:id`                | admin  | Edit name / category / price / photo / availability |
| DELETE| `/api/menu/:id`               | admin  | Remove a dish |
| GET  | `/api/availability?date=`      | public | Room IDs already booked for a date |
| POST | `/api/bookings`                | public | Create a booking |
| GET  | `/api/bookings`                | admin  | List all bookings |
| GET  | `/api/bookings/:id`            | admin  | One booking |
| PATCH| `/api/bookings/:id/status`     | admin  | pending → confirmed → checkedin → checkedout, or cancelled |
| POST | `/api/admin/login`             | —      | Sets session cookie |
| POST | `/api/admin/logout`            | —      | Clears session cookie |
| GET  | `/api/admin/me`                | admin  | Check current session |

## Food menu

The menu starts empty. Log in to the admin panel → **Food Orders → Menu & Prices** to add dishes, set prices, upload photos, hide/show or delete them. Changes appear on the customer site immediately (the booking wizard reloads the menu each time step 5 opens). An older `db.json` that contained the sample menu is migrated automatically on first start: the sample dishes are dropped and existing bookings are untouched.

## 🌐 Hosting & Deployment

All required configuration files (`package.json`, `render.yaml`, `Dockerfile`, `.dockerignore`, `.gitignore`, `.env.example`, `Procfile`, `vercel.json`) are provided. Refer to [DEPLOYMENT.md](DEPLOYMENT.md) for 1-click deployment guides on Render, Railway, Vercel, or Docker VPS.

