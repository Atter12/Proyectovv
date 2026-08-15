const fs = require("fs");
const { Client } = require("pg");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const sql = fs.readFileSync(
  "supabase/migrations/015_support_ticket_status_resolved.sql",
  "utf8",
);

async function main() {
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    const r = await client.query(`
      select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'support_ticket_status'
      order by e.enumsortorder
    `);
    console.log("ENUM_OK", r.rows.map((x) => x.enumlabel).join(","));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("MIG_FAIL", e.message);
  process.exit(1);
});
