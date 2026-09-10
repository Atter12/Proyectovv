import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  localeCookieName,
  resolveAppLocale,
  type AppLocale,
} from "./config";

async function loadMessages(locale: AppLocale) {
  switch (locale) {
    case "en":
      return (await import("../messages/en.json")).default;
    case "pt-BR":
      return (await import("../messages/pt-BR.json")).default;
    case "es":
    default:
      return (await import("../messages/es.json")).default;
  }
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveAppLocale(store.get(localeCookieName)?.value);

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
