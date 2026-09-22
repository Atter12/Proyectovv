/**
 * Smoke test del asesor Profit con un cliente real (default: Jesus Fuentes).
 *
 * Usage:
 *   node --use-system-ca --import ./scripts/shim-server-only.cjs --import tsx --env-file=.env.local scripts/test-profit-advisor.ts
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const nameArg = process.argv.find((a) => a.startsWith("--name="));
  const nameQuery = (
    nameArg ? nameArg.slice("--name=".length) : "Jesus Fuentes"
  )
    .trim()
    .toLowerCase();

  const hecomUrl =
    process.env.HECOM_SUPABASE_URL?.trim() ||
    process.env.PUBLIC_SUPABASE_URL?.trim() ||
    "https://fsnolvozwcnbyuradiru.supabase.co";
  const hecomKey =
    process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  const openAiKey = process.env.OPENAI_API_KEY || "";

  if (!hecomKey) {
    console.error("Falta HECOM_SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!openAiKey) {
    console.error("Falta OPENAI_API_KEY");
    process.exit(1);
  }

  const hecom = createClient(hecomUrl, hecomKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const firstToken = nameQuery.split(/\s+/)[0] || "jesus";
  const { data: clientes, error: listError } = await hecom
    .from("clientes")
    .select("id, name")
    .ilike("name", `%${firstToken}%`)
    .limit(40);

  if (listError) {
    console.error("Error listando clientes Hecom:", listError.message);
    process.exit(1);
  }

  const match =
    (clientes ?? []).find((c) =>
      String(c.name ?? "")
        .toLowerCase()
        .includes(nameQuery),
    ) ??
    (clientes ?? []).find((c) =>
      /jesus\s*fuentes/i.test(String(c.name ?? "")),
    );

  if (!match) {
    console.error(
      "No encontré cliente. Candidatos:",
      (clientes ?? []).map((c) => c.name),
    );
    process.exit(1);
  }

  console.log("Cliente:", match.name, `(${match.id})`);

  const { askProfitAdvisor } = await import(
    "../lib/realprofit/profit-advisor.server"
  );

  const questions = [
    "¿Cómo va este cliente en resumen?",
    "¿Cómo van los cobros Holistic?",
    "¿Conviene darle más crédito ahora?",
  ];

  let history: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const [i, message] of questions.entries()) {
    console.log(`\n—— Q${i + 1}: ${message}`);
    const t0 = Date.now();
    try {
      const result = await askProfitAdvisor({
        hecomClienteId: match.id as string,
        clienteName: match.name as string,
        message,
        history,
      });
      console.log(`(${Date.now() - t0}ms · rango ${result.from}→${result.to})`);
      console.log(result.reply);
      history = [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: result.reply },
      ].slice(-8);
    } catch (error) {
      console.error(
        "FALLÓ:",
        error instanceof Error ? error.stack || error.message : error,
      );
      process.exit(1);
    }
  }

  console.log("\nOK · asesor respondió las 3 preguntas.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
