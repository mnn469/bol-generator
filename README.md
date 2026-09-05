# BOL Generator

A multi-company web app for generating sequential, numbered Bill of
Lading / shipping tally PDFs. A user fills in the shipment details (shipper,
destination, line items, carrier, etc.), and the app assigns the next number
and stamps everything onto every copy of the company's PDF template (e.g.
SHIPPER COPY / RECEIVER COPY / RECORDS COPY). Each company gets its own
users, BOL prefix, numbering sequence, and PDF template — including its own
set of form fields and where each one is drawn.

## Stack

- **Next.js 16** (App Router, Route Handlers, Server Actions)
- **PostgreSQL** + **Prisma 7** (driver adapter: `@prisma/adapter-pg`)
- **Auth.js v5** (Credentials provider, JWT sessions)
- **pdf-lib** for overlaying BOL numbers onto an existing PDF template
- **Tailwind CSS v4**

## How the numbering stays safe

Every BOL number is assigned by a single atomic SQL statement inside a
transaction:

```sql
UPDATE "BolSequence"
SET "nextNumber" = "nextNumber" + 1
WHERE "companyId" = $1
RETURNING "nextNumber" - 1 AS assigned
```

Postgres holds a row lock on that company's sequence row for the duration
of the transaction, so two simultaneous "Generate" clicks for the same
company are serialized — they can never receive the same number. See
`src/lib/bol/generateBolNumber.ts`. This was verified by firing 10
concurrent generate requests at the dev server and confirming zero
duplicate numbers in the database.

The `BolRecord` is created **before** the PDF is generated. If PDF
generation fails, the number is still reserved (`pdfStatus: FAILED`) and
is never reused — it just needs a working template/regeneration, not a new
number.

## Getting started (local dev)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **PostgreSQL** — point `DATABASE_URL` in `.env` at a Postgres database.
   For local dev with Homebrew:
   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   createuser -s bol_admin
   createdb -U bol_admin bol_generator_dev
   ```
   `.env` already has a working local connection string and a dev-only
   `AUTH_SECRET` — **replace both before deploying anywhere real**.

3. **Run migrations and seed a demo company**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
   This creates one company (Southside Processing Inc., prefix `SPI`) with
   its BOL template pre-calibrated against `storage/templates/southside-shipping-tally.pdf`,
   and one admin login:
   - `admin@example.com` / `ChangeMe123!` — **change this password immediately**
     (there's no self-service password reset yet — an admin can only add new
     users; to rotate this one, update `passwordHash` directly or add a
     dedicated user and remove this one from Admin → Users).

4. **Run the app**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000, sign in, click **Generate BOL**, fill in the
   shipment form, and submit — the number is assigned only at that point,
   and the resulting PDF has one page per copy label (3 for the seeded demo
   company), each stamped with the same data.

## Adding a new company

There's no "create company" UI yet (see Roadmap) — use the script instead:

```bash
npm run create-company -- \
  --name "Acme Trading Ltd." \
  --code ACME \
  --admin-name "Jane Doe" \
  --admin-email jane@acme.com
```

(`--prefix`, `--start`, `--padding` are optional — see `--help`-style output
by running it with no args.) This creates the `Company`, its `BolSequence`,
and an admin `User` (printing a temporary password if the email is new — the
person should change it on first login, the same as the seeded demo admin).
It can't upload a PDF template for you (that needs an actual file); once the
new admin logs in, they upload their template and set up its fields from
**Admin → BOL template**, same as described below.

A user can belong to multiple companies; they'll see a company picker after
login if so — this is also how you'd add a second company to a deployment
you already run, rather than giving it a separate deployment (see below).

## Deploying for someone else (a different company, a different country)

The app is already built to be run by someone other than you — every
company's users, sequence, and template are isolated from every other
company's (enforced at the database-query level, not just the UI). Two ways
to hand it to someone:

**Option A — they get their own separate deployment (most likely what you
want for a friend running an unrelated company).** They run their own copy
of this app, their own database, their own hosting bill, with zero
dependency on your infrastructure. Steps:

1. **Get them the code.** Push this repo to a **private** GitHub repo and
   add them as a collaborator (or just zip the folder — but GitHub makes
   future updates way easier). Don't commit `.env` — it's already gitignored.

2. **Pick a host.** This app needs somewhere to run Node.js continuously
   *and* somewhere with a real disk, because generated PDFs and uploaded
   templates are written to `storage/` on the local filesystem —
   **serverless/edge platforms like plain Vercel won't work** without first
   moving that to object storage (S3-compatible), which this version
   doesn't do. [Render](https://render.com), [Railway](https://railway.app),
   and [Fly.io](https://fly.io) all support a persistent disk plus a managed
   Postgres, and are the easiest path right now. Render is probably the
   simplest for someone without much DevOps background: one "Web Service"
   for the app, one "Postgres" instance, one persistent disk mounted at the
   app's working directory (or at least at `storage/`).

3. **Set environment variables** on the host:
   - `DATABASE_URL` — from the host's managed Postgres.
   - `AUTH_SECRET` — a **new, unique** value, not the one in this repo's
     `.env` (that one is dev-only and must never reach production). Generate
     one with `npx auth secret` or `openssl rand -base64 32`.
   - `AUTH_TRUST_HOST=true`.

4. **Build/release commands.** `npm install` (which now also runs
   `prisma generate` via `postinstall`), then `npm run build`. Before the
   app first starts (most hosts have a "pre-deploy" or "release" command;
   otherwise run it manually once via the host's shell), run
   `npm run db:deploy` (`prisma migrate deploy` — the production-safe
   equivalent of `db:migrate`, it doesn't prompt or generate new migrations,
   just applies the ones already committed in `prisma/migrations/`).

5. **Create their company and first admin** — run
   `npm run create-company -- ...` (see above) against the production
   database once it's reachable. Don't run `npm run db:seed` against their
   database — that creates the demo Southside company, which they don't
   want.

6. **Hand over the URL and the printed temporary password.** They should
   change that password immediately, then from **Admin → BOL template**
   upload their own company's blank BOL/tally PDF and set up its field
   layout (see "Calibrating a BOL template" and "The data-entry form" below
   — the same grid-overlay technique works for any template, not just the
   one this demo ships with).

**Option B — they become a second company on infrastructure you keep
running.** Simpler if you don't mind staying the one paying for/maintaining
hosting: just run `npm run create-company` against your existing production
database and give them the login. Their data is fully isolated from any
other company's, but they're depending on you to keep the app up. This is
usually the wrong choice for "a friend's unrelated company in another
country" and the right choice for, e.g., a second branch of the same
business.

## Calibrating a BOL template

Template layout (where the number is drawn, and whether to white-out a
pre-printed number already on the page) lives on the `BolTemplate` row and
is editable from **Admin → BOL template**. Coordinates are in PDF points,
origin at the bottom-left of the page.

Workflow: edit the numbers, save, then click **Generate test PDF** (top of
that section) — it renders the template with a placeholder number without
touching the real BOL sequence, so you can iterate freely.

For a *printed* reference point (an existing pre-printed number, a label
you're aligning next to), `pdftotext -bbox template.pdf` (part of `poppler`)
prints the bounding box of every text run on the page; convert its top-down
`y` to pdf-lib's bottom-up `y` with `pdfPageHeight - y`.

For a *blank* line or box with no text of its own (which is most fields —
`pdftotext` has nothing to find there), eyeballing a rendered preview isn't
reliable enough — a field can look plausible at low resolution and still be
15-20pt off from the real line. Instead, overlay a labeled coordinate grid
on the actual template and read the line/box position directly:

```js
// draw onto the template with pdf-lib, e.g. every 10pt, labeled every 50pt
page.drawLine({ start: { x, y: 0 }, end: { x, y: height }, ... })
page.drawText(String(x), { x, y: height - 10, size: 5, ... })
```

then render at high DPI and crop to the region you care about:

```bash
pdftoppm -png -r 400 gridded.pdf out
magick out-1.png -crop WxH+X+Y region.png   # X/Y/W/H in pixels = pt * (dpi/72)
```

Read the crop to see exactly which gridline a ruled line falls on, then set
the field's coordinate to that value (plus a few points of left/top padding
so the text doesn't sit flush against the line). This is how every field on
the seeded Southside template was calibrated — see the comments in
`prisma/seed.ts`.

## The data-entry form and how it's drawn onto the PDF

What the user fills in before generating, and exactly where each answer
lands on the page, is entirely data-driven — `BolTemplate.fields`, a JSON
array of field definitions (schema in `src/lib/pdf/fieldTypes.ts`). Three
kinds:

- `text` — one line of free text at `{ x, y }`.
- `checkbox` — draws an "X" at `{ x, y }` when checked (for things like the
  FREEZER/COOLER/OTHER boxes).
- `table` — repeating rows (e.g. line items). `startY` positions the first
  row's baseline, `rowHeight` is subtracted per subsequent row (moving down
  the bottom-left-origin page means *decreasing* y), and each column has its
  own `x`/`width`.

`/generate` reads a company's `fields` and renders a form from it
(`src/components/BolForm.tsx`) — text inputs, checkboxes, and an
add/remove-row table editor for table fields. On submit, the answers are
validated against a zod schema built from those same field defs
(`buildFormDataSchema`) *before* a BOL number is ever assigned — bad input
is rejected without burning a number. The validated data is stored as
`BolRecord.formData` and passed to `createBolPdf`, which draws it onto every
copy page alongside the BOL number.

The `/generate` form also has a **Text size** and **Text color** dropdown
(options in `TEXT_FONT_SIZE_OPTIONS`/`TEXT_COLOR_OPTIONS`, `fieldTypes.ts`),
which the person filling in the BOL chooses per submission — it applies
uniformly to everything they typed (not the BOL number or copy label, which
stay fixed per the template). The choice is validated (`textStyleSchema`),
stored on `BolRecord.textFontSize`/`textColor`, and passed to `createBolPdf`,
where it overrides each field's own default `fontSize`/black color for that
one BOL. Leaving it unset (or omitting `style` entirely) falls back to each
field's configured default.

To change a company's fields, edit the "Form fields (JSON)" box in
**Admin → BOL template** and use **Generate test PDF** to check the result —
it fills every field with a placeholder (its own label, uppercased) so you
can see every field's position at once, which is more useful for layout
calibration than realistic-looking data. The Southside demo company's field
layout (`prisma/seed.ts`) was calibrated against `BOL_SAMPLE.pdf` using
`pdftotext -bbox` to find each label's position and computing values from
there — the same technique described above for the number itself.

## Roles

- **Admin** — generate/void BOLs, manage sequence/template/users for their
  company(ies).
- **User** — generate BOLs, view history.
- **Viewer** — view history and download PDFs only.

Roles are checked fresh from the database on every request (not cached in
the session), so a role change or removal takes effect immediately.

## Project structure

```
prisma/schema.prisma          Company, User, CompanyUser, BolSequence,
                               BolTemplate, BolRecord, AuditLog
prisma/seed.ts                Demo company + admin user + field layout
src/lib/bol/generateBolNumber.ts   Atomic number assignment + PDF trigger
src/lib/pdf/fieldTypes.ts          Field-def types/zod schemas (drives form + PDF overlay)
src/lib/pdf/createBolPdf.ts        pdf-lib overlay logic (number, copy label, form fields)
src/lib/auth/                      Session + active-company + role helpers
src/components/BolForm.tsx         Dynamic data-entry form built from a template's fields
src/app/(app)/                     Dashboard, Generate, History, Admin (behind auth)
src/app/api/companies/[companyId]/bols/...   Generate / void / download PDF
storage/templates/                 Source blank PDF templates (kept in git)
storage/generated/                 Output PDFs, one folder per company (gitignored)
```

## Roadmap / intentionally out of scope for v1

No customer/shipper database (the shipper/destination fields are free text,
not looked up), no carrier integrations, no emailing PDFs, no e-signatures,
no self-service "create company" UI, and no visual (click-to-place) field
editor — coordinates are set as numbers/JSON and checked via the test-PDF
preview. The schema (per-company sequence, template, fields, users) is
already shaped to support all of that without a rewrite when it's time to
add it.
