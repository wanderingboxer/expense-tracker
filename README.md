This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database migrations

Schema changes are managed with Prisma Migrate (`prisma/migrations/`).
`npm run build` runs `prisma migrate deploy` automatically before building.

**One-time step for the existing production database:** it was originally set
up via a manual SQL endpoint (since removed) rather than a migration, so its
schema already matches `prisma/schema.prisma` but Prisma doesn't know that.
Before the first deploy with this migration history, mark the baseline
migration as already applied (run once, against production):

```bash
DATABASE_URL="<production-database-url>" npx prisma migrate resolve --applied 20260926093545_init
```

After that, `prisma migrate deploy` (via `npm run build`, or `npm run db:migrate`
directly) applies new migrations normally. For a fresh database that has never
had this schema, skip the `resolve` step — `migrate deploy` will apply the
baseline migration itself.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
