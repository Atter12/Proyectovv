import type { SupportConfig } from "@/features/support/types/support.types";
import type { DashboardPersona } from "@/types/dashboard-persona";

function isStaffPersona(persona: DashboardPersona): boolean {
  return persona === "gerente" || persona === "super_admin";
}

function articleVisibleForPersona(
  audience: SupportConfig["articles"][number]["audience"],
  persona: DashboardPersona,
): boolean {
  const scope = audience ?? "all";
  if (scope === "all") return true;
  return isStaffPersona(persona) ? scope === "gerente" : scope === "cliente";
}

/** FAQ filtrada por persona (cliente vs gerente/super admin). */
export function supportFaqForPersona(
  config: SupportConfig,
  persona: DashboardPersona,
): SupportConfig {
  const articles = config.articles.filter((article) =>
    articleVisibleForPersona(article.audience, persona),
  );
  const articleIds = new Set(articles.map((article) => article.id));

  const categories = config.categories
    .map((category) => ({
      ...category,
      articleIds: category.articleIds.filter((id) => articleIds.has(id)),
    }))
    .filter((category) => category.articleIds.length > 0);

  return {
    ...config,
    articles,
    categories,
  };
}
