/** Eventos compartidos client/server (sin I/O TikTok). */

/**
 * Los 14 eventos estándar de TikTok. Tipos verificados contra pixel/list de
 * píxeles reales (19/10/2026): InitiateCheckout es INITIATE_ORDER y
 * PlaceAnOrder es ON_WEB_ORDER (antes InitiateCheckout usaba ON_WEB_ORDER).
 */
export const COD_PIXEL_EVENT_DEFS = [
  { name: "ViewContent", eventType: "ON_WEB_DETAIL", statisticType: "EVERY_TIME" },
  { name: "ClickButton", eventType: "BUTTON", statisticType: "EVERY_TIME" },
  { name: "Search", eventType: "ON_WEB_SEARCH", statisticType: "EVERY_TIME" },
  { name: "AddToWishlist", eventType: "ON_WEB_ADD_TO_WISHLIST", statisticType: "EVERY_TIME" },
  { name: "AddToCart", eventType: "ON_WEB_CART", statisticType: "EVERY_TIME" },
  { name: "InitiateCheckout", eventType: "INITIATE_ORDER", statisticType: "EVERY_TIME" },
  { name: "AddPaymentInfo", eventType: "ADD_BILLING", statisticType: "EVERY_TIME" },
  { name: "PlaceAnOrder", eventType: "ON_WEB_ORDER", statisticType: "EVERY_TIME" },
  { name: "CompletePayment", eventType: "SHOPPING", statisticType: "EVERY_TIME" },
  { name: "Subscribe", eventType: "ON_WEB_SUBSCRIBE", statisticType: "EVERY_TIME" },
  // TikTok API no acepta CONTACT; CONSULT es el equivalente en Measurement.
  { name: "Contact", eventType: "CONSULT", statisticType: "EVERY_TIME" },
  { name: "SubmitForm", eventType: "FORM", statisticType: "EVERY_TIME" },
  { name: "Download", eventType: "DOWNLOAD_START", statisticType: "EVERY_TIME" },
  {
    name: "CompleteRegistration",
    eventType: "ON_WEB_REGISTER",
    statisticType: "ONCE",
  },
] as const;

export const TIKTOK_BROWSER_TEST_EVENTS = [
  "ViewContent",
  "ClickButton",
  "Search",
  "AddToWishlist",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "PlaceAnOrder",
  "CompletePayment",
  "Subscribe",
  "Contact",
  "SubmitForm",
  "Download",
  "CompleteRegistration",
] as const;
