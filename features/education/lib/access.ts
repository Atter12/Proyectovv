/** Vista previa de Educación. Solo estas cuentas ven el módulo. */
const EDUCATION_VIEWER_EMAILS = ["sandrowonmer@gmail.com"] as const;

export function canViewEducation(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  return (EDUCATION_VIEWER_EMAILS as readonly string[]).includes(normalized);
}
