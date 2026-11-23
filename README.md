# Deployed URL : https://replate-client.onrender.com/login

# RePlate

Connects surplus food from corporate cafeterias, caterers and hostel messes to nearby shelters, community kitchens and volunteers, **before it spoils**. Built for *Codebenders ACE Builders' Hackathon 2026, Problem Statement 2*.

**Stack:** React + Vite · Material UI · Tailwind CSS · React Icons (Lucide) · Node.js (Express) · PostgreSQL · Prisma · Nodemailer

> ⚠️ All data is synthetic. Organisations, people, phone numbers and addresses are fictional. The platform connects people and **does not certify food safety**, and it makes **no tax or legal promises**.

---

## Quick start

Prerequisites: Node 18+ and PostgreSQL running locally.

The project has two independent packages, `server/` (API) and `client/` (web app). There is no root `package.json`, so run each command inside its own folder.

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Configure the API
cp server/.env.example server/.env
#    then edit server/.env → set YOUR_PASSWORD in DATABASE_URL
cp client/.env.example client/.env
#    VITE_IS_DEMO=true shows demo accounts on the login page; set false to hide them

# 3. Create tables + load demo data (the database is created automatically)
cd server
npm run db:push
npm run db:seed

# 4. Run the API and the web app in two terminals
cd server && npm run dev     # http://localhost:4000
cd client && npm run dev     # http://localhost:5173
```

Re-run `npm run db:seed` (in `server/`) at any time to reset the demo. The "live" listings are created relative to the current time, so reseed before a demo.

### Demo accounts (password `Password@123`)

| Role | Email | Who |
|---|---|---|
| Donor | `donor@demo.rescue` | Kitchen Manager, Lakeview Tech Park Cafeteria (3 staff in org) |
| Donor | `supervisor.lakeview@demo.rescue` | Shift Supervisor, same org |
| Receiver | `receiver@demo.rescue` | Coordinator, Hope Night Shelter |
| Volunteer | `volunteer@demo.rescue` | Volunteer on a bike |

The login page lists demo users for each role; click one to sign in.

---

## Roles (only these 3 are stored)

`Role` enum in Prisma: `DONOR | RECEIVER | VOLUNTEER`.

| Role | Account shape | Can do |
|---|---|---|
| **Donor** | Organisation account with **several staff users** (kitchen manager, shift supervisor…) | Post surplus in under 60s, repeat the last post, track live status, hold the pickup code, see surplus insights, download impact CSV |
| **Receiver** | Organisation account with a **coordinator** + **capacity & needs profile** | Ranked food feed with "why matched", claim (volunteer delivery or self-pickup), hold delivery code, check quality on arrival, pause intake |
| **Volunteer** | Individual account | Task feed ranked by distance/time/vehicle, accept or drop tasks, verify pickup and delivery codes, see hours and deliveries |

---

## Feature map → problem statement

| Requirement | Where |
|---|---|
| Donor flow < 1 minute | `/donor/post`: 3 steps, chips not typing, "Repeat last", live timer, auto kg→meals |
| Smart matching | [server/src/lib/matching.js](server/src/lib/matching.js): hard filters (diet, intake hours, capacity, time feasibility, fridge) + weighted score (proximity 25%, time to spare 20%, quantity fit 15%, need 20%, reliability 10%, diet 10%) with readable reasons |
| Live pickup status | `POSTED → CLAIMED → ASSIGNED → COLLECTED → DELIVERED` (+ `REJECTED / EXPIRED / CANCELLED`), 4-digit OTP handovers, status timeline, simulated route map, 10s polling |
| Impact | `/impact`: meals, kg, CO₂e, disposal ₹, rescue rate, funnel. Every number has a "How is this calculated?" tooltip (values from the `ImpactAssumption` model) |
| Handling & safety info | [server/src/lib/safety.js](server/src/lib/safety.js): consume-by from category × storage × prep time, handling card, allergen banner, donor declaration, receiver quality check, disclaimer everywhere |
| Collected before it spoils | Watchdog job ([server/src/jobs/watchdog.js](server/src/jobs/watchdog.js)): cascade alerts at 5/10 min, auto-reassign volunteers who stall for 25 min, auto-expire at consume-by. Posting is blocked if < 45 min remain |
| Why caterers come back weekly | `/donor/analytics`: over-production insights by weekday with ₹/month estimates, disposal savings |
| Privacy guardrails | Locations fuzzed to ~1 km until claimed, phone numbers masked, OTPs shown only to the right party, synthetic data only |

## Volunteer delivery payments

- When posting, the donor sets a **delivery fee**. It's suggested from the distance to likely receivers (₹30 + ₹8/km, +₹20 for loads over 20 kg) and can be edited between ₹0 and ₹500.
- The volunteer **earns the fee when the delivery code is verified**. They're still paid if the receiver later rejects the food. Self pickup is never charged.
- Volunteers see their balance, history and payouts under **Earnings**, and withdraw to a UPI ID once they have at least ₹100.
- Payouts are settled offline. `PAYOUT_AUTO_SETTLE=true` (server `.env`) marks them paid immediately for demos. With `false` they stay *Processing* until you run `cd server && npm run payouts:settle`.

## Email (Nodemailer)

Set `MAIL_MODE` in `server/.env`:

- `log` (default): no network. Emails are stored in `EmailLog` and shown in the app's **Email outbox**.
- `gmail`: real delivery through Gmail with an **App Password**.
- `smtp`: any SMTP server via the `SMTP_*` settings.
- `ethereal`: free test inbox; each email gets a preview link.

### Sending real email with a Gmail App Password

1. Turn on **2-Step Verification** for the Google account you will send from.
2. Create an app password at <https://myaccount.google.com/apppasswords>. Google shows a 16-character code.
3. In `server/.env`:
   ```env
   MAIL_MODE=gmail
   GMAIL_USER=you@gmail.com
   GMAIL_APP_PASSWORD=abcd efgh ijkl mnop   # spaces are fine, they are stripped
   MAIL_REDIRECT_TO=you@gmail.com           # optional: where demo-account (@demo.rescue) emails go
   ```
4. Restart the API. It logs `[mail] gmail transport ready` on startup, or the reason it isn't.
5. Send a test: `cd server && npm run mail:test -- you@example.com`

Demo accounts use made-up addresses (`@demo.rescue`). In `gmail`/`smtp` mode their emails go to `MAIL_REDIRECT_TO` (subject tagged `[for <demo address>]`), or are skipped if it's blank. Real users always get their own email. Emails are sent in the background over a small connection pool, and temporary Gmail errors (`421`) are retried automatically. A `535 Username and Password not accepted` error means a normal password was used, or the app password was revoked.

You can also use Gmail through `MAIL_MODE=smtp` with `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=you@gmail.com` and `SMTP_PASS=<app password>`.

**Who gets emailed:** every step emails each party involved: post (donor), match (receivers), claim (donor with the pickup code; receiver with the delivery code), volunteer needed and assigned (volunteers, donor, receiver), dropped or reassigned, collected, delivered (all three; the volunteer's earnings), food check result (donor and volunteer), cancelled, expired, payouts and sign-up.

Emails are sent when: a listing is matched to you, your listing is claimed, a volunteer is assigned, a pickup needs a volunteer, food is delivered (with an impact summary), and on registration.

## Project structure

```
rescue-the-surplus/
├─ server/
│  ├─ prisma/schema.prisma   # data model (3 roles)
│  ├─ prisma/seed.js         # synthetic demo data (~150 listings over 8 weeks)
│  └─ src/
│     ├─ routes/             # auth, listings (lifecycle), donor, receiver, volunteer, impact, misc
│     ├─ lib/                # matching, safety, impact, mailer, serialize (privacy), lifecycle
│     └─ jobs/watchdog.js    # expiry, cascade, reassignment
└─ client/
   └─ src/
      ├─ pages/{donor,receiver,volunteer}/
      ├─ pages/ListingDetail.jsx, ImpactPage.jsx, Outbox.jsx, Login.jsx, Register.jsx
      └─ components/         # Layout, ListingBits, Actions, Impact charts, RouteMap
```

## Suggested 3-minute demo

1. **Donor** → *Post surplus* → tap *Repeat last* → declare → post (watch the timer) → see top matches.
2. **Receiver** → feed shows the new listing with its match score and reasons → *Claim (volunteer delivers)*.
3. **Volunteer** → *Accept pickup* → enter the donor's pickup code (on the donor dashboard) → enter the receiver's delivery code (on *My claims*).
4. **Receiver** → *Check & confirm food* → accept.
5. **Donor** → impact updates. Open *Email outbox* to see the Nodemailer emails.
