import { NextRequest, NextResponse } from "next/server";

import { processInvoiceGenerationQueue } from "@/app/api/lib/invoices/generation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const expected = process.env.CRON_SECRET;
    if (
        !expected ||
        request.headers.get("authorization") !== `Bearer ${expected}`
    ) {
        return NextResponse.json({ success: false }, { status: 401 });
    }

    try {
        const processed = await processInvoiceGenerationQueue();
        return NextResponse.json({ success: true, processed });
    } catch (error) {
        console.error("GENERATE_INVOICES_CRON_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Invoice queue processing failed" },
            { status: 500 }
        );
    }
}
