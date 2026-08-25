# Clerk Auth (login Holistic — mismo patrón que ImpoERP / oddo)
# Dashboard → https://dashboard.clerk.com → API Keys
# En Domains: localhost + dominio de producción Holistic
AUTH_CLERK_LOGIN=true
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/auth/clerk/complete
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/auth/clerk/complete
