#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

COMPANY_COUNT=$(node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query('SELECT COUNT(*)::int AS n FROM \"Company\"'))
  .then((r) => { console.log(r.rows[0].n); return c.end(); })
  .catch((e) => { console.error(e); process.exit(1); });
")

if [ "$COMPANY_COUNT" = "0" ]; then
  echo "No companies yet — seeding the demo company..."
  npx tsx prisma/seed.ts
else
  echo "Companies already exist ($COMPANY_COUNT) — skipping seed."
fi

exec "$@"
