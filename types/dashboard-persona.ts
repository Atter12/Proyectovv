/**
 * Personas de negocio del dashboard (no confundir con app_role de org).
 * Ver docs/MAPA_DISENO_ROLES.md
 */
export type DashboardPersona = "cliente" | "gerente" | "super_admin";

export function dashboardPersonaLabel(persona: DashboardPersona): string {
  switch (persona) {
    case "super_admin":
      return "Super admin";
    case "gerente":
      return "Gerente";
    default:
      return "Cliente";
  }
}
