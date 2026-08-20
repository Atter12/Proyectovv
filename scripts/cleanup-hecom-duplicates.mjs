#!/usr/bin/env node
/**
 * Soft-retire Hecom CRM duplicates (same email, empty accounts).
 * Does NOT delete rows. Clears emails/phones so OTP no lista duplicados.
 *
 *   node --env-file=.env.local scripts/cleanup-hecom-duplicates.mjs --dry-run
 *   node --env-file=.env.local scripts/cleanup-hecom-duplicates.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";

/** Canonical keepers + empty email-dupes to retire */
const MERGES = [
  {
    keepId: "88efb2d6-d9d1-4ee8-9dcc-012f23b2eea9",
    keepName: "Jhosdan Rodriguez",
    retire: [
      {
        id: "16ead27b-0b77-4ae8-8070-a00ba0382fa0",
        name: "Jhosdan Rodrigez",
      },
      {
        id: "06b2b71e-3563-41d7-993e-d2ce00176a85",
        name: "Jhosdan Rodrigez Calderon",
      },
    ],
    reason: "mismo email Newstylerelax@gmail.com; typo Rodrigez; cuentas en canónico",
  },
  {
    keepId: "9f81dd8b-b7b4-4fb6-bbc8-b3dfe72b5570",
    keepName: "Renzo Puerta",
    retire: [
      {
        id: "42733f99-47ff-48b2-87c4-5c93330695c2",
        name: "Víctor Renzo Puerta",
      },
    ],
    reason: "mismo email vpuertahuaman@gmail.com; cuentas TikTok en Renzo Puerta",
  },
];

/** Documented NOT merged (different people or dual ops) */
const SKIP_DOC = [
  "Christian Ocampo ≠ Christian Ricaldi (emails/tel distintos)",
  "Cesar Bazan ≠ Cesar Pachas (emails distintos)",
  "Fabian Hoyos + Fabian Hoyos Ecuador: mismo email pero cuentas TikTok distintas (PE/EC) — se mantienen ambos",
];

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  const hecom = createClient(
    process.env.HECOM_SUPABASE_URL,
    process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY,
  );

  console.log("mode=", dryRun ? "DRY_RUN" : "APPLY");
  console.log("skip_doc=", SKIP_DOC);

  const stamp = new Date().toISOString().slice(0, 10);
  let retired = 0;

  for (const merge of MERGES) {
    const { data: keep } = await hecom
      .from("clientes")
      .select("id,name,emails,tiktok_advertiser_name")
      .eq("id", merge.keepId)
      .maybeSingle();
    if (!keep) {
      console.error("KEEP_MISSING", merge.keepId);
      process.exit(1);
    }

    const { count: keepAcc } = await hecom
      .from("cliente_tiktok_cuentas")
      .select("*", { count: "exact", head: true })
      .eq("client_id", merge.keepId);

    console.log("---");
    console.log("KEEP", keep.name, "acc=", keepAcc);

    for (const dup of merge.retire) {
      const { data: row } = await hecom
        .from("clientes")
        .select("id,name,emails,phones,notes,tiktok_advertiser_id")
        .eq("id", dup.id)
        .maybeSingle();
      if (!row) {
        console.log("SKIP missing", dup.id);
        continue;
      }

      const { count: dupAcc } = await hecom
        .from("cliente_tiktok_cuentas")
        .select("*", { count: "exact", head: true })
        .eq("client_id", dup.id);
      const { count: cobros } = await hecom
        .from("cobros")
        .select("*", { count: "exact", head: true })
        .eq("client_id", dup.id);
      const { count: gastos } = await hecom
        .from("gastos")
        .select("*", { count: "exact", head: true })
        .eq("client_id", dup.id);

      if ((dupAcc ?? 0) > 0 || (cobros ?? 0) > 0 || (gastos ?? 0) > 0) {
        console.log(
          "ABORT_HAS_DATA",
          row.name,
          { dupAcc, cobros, gastos },
        );
        process.exit(1);
      }

      const already =
        String(row.name).includes("[DUPLICADO]") ||
        String(row.notes ?? "").includes("DUPLICATE_OF:");

      const newName = already
        ? row.name
        : `${row.name} [DUPLICADO]`;
      const noteLine = `[DUPLICATE_OF:${merge.keepId} ${merge.keepName}] retired ${stamp}. ${merge.reason}`;
      const newNotes = already
        ? row.notes
        : [row.notes, noteLine].filter(Boolean).join("\n");

      console.log("RETIRE", row.name, "→", newName);
      console.log("  emails_cleared=", (row.emails || []).join(",") || "-");

      if (dryRun) continue;

      const { error } = await hecom
        .from("clientes")
        .update({
          name: newName,
          notes: newNotes,
          emails: [],
          phones: [],
          tiktok_advertiser_id: null,
          tiktok_advertiser_name: null,
          tiktok_sync_enabled: false,
        })
        .eq("id", dup.id);

      if (error) {
        console.error("UPDATE_FAIL", dup.id, error.message);
        process.exit(1);
      }
      retired += 1;
    }

    // Ensure keeper note
    if (!dryRun) {
      const keepNote = `[CANONICAL] duplicates retired ${stamp}`;
      const { data: keepFull } = await hecom
        .from("clientes")
        .select("notes")
        .eq("id", merge.keepId)
        .maybeSingle();
      if (keepFull && !String(keepFull.notes ?? "").includes("[CANONICAL]")) {
        await hecom
          .from("clientes")
          .update({
            notes: [keepFull.notes, keepNote].filter(Boolean).join("\n"),
          })
          .eq("id", merge.keepId);
      }
    }
  }

  if (dryRun) {
    console.log("DRY_RUN_OK — rerun with --apply");
    return;
  }

  // Verify emails no longer duplicate for these groups
  const checkEmails = [
    "newstylerelax@gmail.com",
    "vpuertahuaman@gmail.com",
  ];
  for (const email of checkEmails) {
    const { data } = await hecom
      .from("clientes")
      .select("id,name,emails")
      .contains("emails", [email]);
    // also try lowercase variants via scan
    const { data: all } = await hecom
      .from("clientes")
      .select("id,name,emails")
      .limit(500);
    const hits = (all || []).filter((c) =>
      (c.emails || []).some(
        (e) => String(e).trim().toLowerCase() === email,
      ),
    );
    console.log(
      "email_now",
      email,
      "→",
      hits.map((h) => h.name).join(" | ") || "(none)",
    );
  }

  console.log("RETIRED=", retired);
  console.log("APPLY_OK");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
