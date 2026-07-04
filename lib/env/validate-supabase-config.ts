export function getSupabaseConfigError(
  url: string,
  anonKey: string,
): string | null {
  const trimmedUrl = url.trim();
  const trimmedKey = anonKey.trim();

  if (!trimmedUrl) {
    return "NEXT_PUBLIC_SUPABASE_URL no está configurada. Añádela en Vercel → Environment Variables y vuelve a desplegar.";
  }

  if (!trimmedKey) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada. Añádela en Vercel → Environment Variables y vuelve a desplegar.";
  }

  try {
    const parsed = new URL(trimmedUrl);
    if (parsed.protocol !== "https:") {
      return "NEXT_PUBLIC_SUPABASE_URL debe usar https:// (ej. https://tu-proyecto.supabase.co).";
    }
    if (!parsed.hostname.endsWith(".supabase.co")) {
      return "NEXT_PUBLIC_SUPABASE_URL debe ser la URL de API del proyecto (https://xxxx.supabase.co), no la URL del dashboard ni la de la base de datos.";
    }
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL no es válida. Copia la Project URL desde Supabase → Settings → API.";
  }

  return null;
}
