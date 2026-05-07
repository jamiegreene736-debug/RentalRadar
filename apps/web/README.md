# RentalRadar.ai Web

Next.js 15 App Router frontend for RentalRadar.ai.

## Run

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

The dashboard reads from `NEXT_PUBLIC_API_BASE_URL` and sends the temporary development auth headers expected by the FastAPI backend.

## Surfaces

- property address search with map integration
- live market-rate chart across Airbnb, VRBO, Booking.com, and direct PMS data
- pricing recommendations with channel push action
- PMS connection form
- per-property subscription panel

Server Actions live in `src/app/actions.ts`. Server-rendered data loading lives in `src/lib/api.ts`.
