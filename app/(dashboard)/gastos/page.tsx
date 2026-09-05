import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { requirePermission } from "@/lib/auth/guards.server";

/** Gastos quedó absorbido por Profit (análisis + consumo). */
export default async function GastosPage() {
  await requirePermission("payments:read");
  redirect(routes.profit);
}
