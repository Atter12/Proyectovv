/** Sesión de panel: la cookie vive ~400 días (tope de los navegadores). */
export const supabaseAuthCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 400,
  secure: process.env.NODE_ENV === "production",
};
