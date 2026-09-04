/** Eventos compartidos client/server (sin I/O TikTok). */

export const COD_PIXEL_EVENT_DEFS = [
  { name: "ViewContent", eventType: "ON_WEB_DETAIL", statisticType: "EVERY_TIME" },
  { name: "AddToCart", eventType: "ON_WEB_CART", statisticType: "EVERY_TIME" },
  { name: "InitiateCheckout", eventType: "ON_WEB_ORDER", statisticType: "EVERY_TIME" },
  { name: "CompletePayment", eventType: "SHOPPING", statisticType: "EVERY_TIME" },
  {
    name: "CompleteRegistration",
    eventType: "ON_WEB_REGISTER",
    statisticType: "ONCE",
  },
  { name: "SubmitForm", eventType: "FORM", statisticType: "EVERY_TIME" },
  { name: "Contact", eventType: "CONTACT", statisticType: "EVERY_TIME" },
  { name: "ClickButton", eventType: "BUTTON", statisticType: "EVERY_TIME" },
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
