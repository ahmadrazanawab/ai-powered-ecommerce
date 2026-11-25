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

## Payments

Copy `.env.example` to `.env` and configure `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` on the server. Use Razorpay
Test Mode keys while developing; never prefix the secret or webhook secret with
`NEXT_PUBLIC_`.

Configure the Razorpay webhook URL as `/api/webhooks/razorpay` and subscribe to
`payment.captured` and `payment.failed`. Apply schema changes with
`npx drizzle-kit migrate`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Vendor business and tax information

Apply pending database migrations, including the business profile and seller
invoice migrations, with:

```bash
npx drizzle-kit migrate
```

Vendor GST documents are stored as private Cloudinary `raw` assets; the existing
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
server variables are required. No document URL is stored or returned to the
vendor. An authenticated admin can request a five-minute signed review link.

Vendor APIs are available under `/api/auth/vendor/business-profile` and
`/api/auth/vendor/business-profile/document`. Admin review APIs are under
`/api/auth/admin/vendor-business-profiles`. Business profile verification is a
manual admin process, separate from vendor account approval. GST/PAN format
checks do not represent external tax verification.

Admins maintain HSN/GST rates for listings at
`/admin-dashboard/invoice-tax-settings`; these rates are snapshotted for future
orders only. Invoice PDFs are stored as private Cloudinary `raw` assets and
served through an authenticated customer download endpoint. Delivery queues
generation; failed jobs can be retried through
`POST /api/cron/generate-invoices` using `Authorization: Bearer $CRON_SECRET`.
Schedule that endpoint at least once per minute and configure `CRON_SECRET` on both the
application and scheduler. The existing Cloudinary server variables above are
also required.

The customer invoice endpoints are `/api/orders/[orderId]/invoices` and
`/api/orders/[orderId]/invoices/[invoiceId]/download`. Seller profiles must be
manually verified before invoices are issued. Issued invoices are immutable.
The existing refund API records order-level amounts without returned-item or
seller allocations, so it does not automatically create tax credit notes;
refund adjustments must be handled through the applicable accounting process.

Run the focused validation tests with:

```bash
node --experimental-strip-types --test tests/vendor-business-profile.test.ts
node --experimental-strip-types --test tests/invoice-money.test.ts
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
