# RentalRadar.ai Web

Next.js 15 App Router frontend for RentalRadar.ai.

## Run

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

## Auth

RentalRadar uses Clerk for account creation, sign-in, and dashboard session protection.

Set these in `.env.local` for local auth testing and in Railway for production:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

Without Clerk keys, `/sign-in` and `/sign-up` render a setup notice and `/dashboard` remains accessible for local development. With Clerk keys present, `/dashboard` requires a signed-in user.

### Google Sign-In

The `/sign-in` and `/sign-up` pages use Clerk's hosted auth components. To show the Google button:

1. Open the Clerk Dashboard for the RentalRadar application.
2. Go to Configure > SSO connections or Social connections.
3. Enable Google.
4. Add the production callback URL Clerk shows you to the Google Cloud OAuth client.
5. Make sure the Railway environment has the Clerk publishable and secret keys above, then redeploy.

Once Google is enabled in Clerk, the existing sign-in and sign-up pages automatically show "Continue with Google" alongside email login.

The dashboard reads from `NEXT_PUBLIC_API_BASE_URL` and sends the temporary development auth headers expected by the FastAPI backend.

## Surfaces

- property address search with map integration
- live market-rate chart across Airbnb, VRBO, Booking.com, and direct PMS data
- pricing recommendations with channel push action
- PMS connection form
- per-property subscription panel

Server Actions live in `src/app/actions.ts`. Server-rendered data loading lives in `src/lib/api.ts`.
