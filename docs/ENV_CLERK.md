# Clerk Auth (login Holistic — mismo patrón que ImpoERP / oddo)
# Dashboard → https://dashboard.clerk.com → API Keys
# En Domains: localhost + adsholistic.com (satellite)

AUTH_CLERK_LOGIN=true
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/auth/clerk/complete
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/auth/clerk/complete

# Producción (satellite adsholistic.com) — obligatorio en Vercel:
NEXT_PUBLIC_CLERK_IS_SATELLITE=true
NEXT_PUBLIC_CLERK_DOMAIN=www.adsholistic.com

# DNS Vercel: CNAME clerk → frontend-api.clerk.services
# Sin satélite verificado, /login usa OTP Hecom (no pantalla en blanco).
