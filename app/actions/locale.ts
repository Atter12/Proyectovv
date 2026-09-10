"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  isAppLocale,
  localeCookieName,
  type AppLocale,
} from "@/i18n/config";

export async function setLocaleAction(locale: AppLocale) {
  if (!isAppLocale(locale)) return { ok: false as const };

  const store = await cookies();
  store.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}
