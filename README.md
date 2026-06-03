# InsiderCluster

Free SEC Form 4 cluster-buy detector. Code-P open-market purchases only. 3+ insiders inside a rolling 14-day window. Ranked by combined dollar value.

## Stack
Next.js 15 + Tailwind dark + Neon Postgres + Vercel daily cron.

## Routes
- `/` - cluster view, last 30 days
- `/about` - methodology and limits
- `/api/clusters` - JSON
- `/api/cron?pages=N` - daily refresh (default 3 pages, max 20)
- `/api/health` - dataset counts

## Env
- `DATABASE_URL` - Neon pooled URL

## Why code P only
Form 4 records every change in insider holdings. Most codes (M option exercise, A grant, G gift, S 10b5-1, F tax withholding) are not signal. Code P is the one where the insider used personal money on the open market. That is what academic research treats as informative. Everything else is filtered out.

Not investment advice.
