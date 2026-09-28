const NAS_CHECKOUT = "https://nas.com/es-mx/checkout-global";

export function nasMembershipCheckoutUrl(returnUrl: string): string {
  const url = new URL(NAS_CHECKOUT);
  url.searchParams.set("communityId", "6763d072e130a67693ce7cba");
  url.searchParams.set("communityCode", "HOLISTIS_ECOM_CLUB");
  url.searchParams.set("requestor", "signupRequestor");
  url.searchParams.set("tierId", "69097e76034f2e22f1ad6033");
  url.searchParams.set("linkClicked", returnUrl);
  return url.toString();
}
