import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireCustomer } from "@/app/api/lib/customer-auth";
import { db } from "@/app/api/lib/db";
import { getPrivateInvoiceDownloadUrl } from "@/app/api/lib/invoices/private-storage";
import { sellerInvoices } from "@/app/api/lib/schema/invoice-schema";
import { orders } from "@/app/api/lib/schema/checkout-schema";

type RouteContext = {
    params: Promise<{ orderId: string; invoiceId: string }>;
};
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, context: RouteContext) {
    const auth = await requireCustomer();
    if (auth.customerId === null) return auth.response;

    const { orderId, invoiceId } = await context.params;
    if (!uuidPattern.test(orderId) || !uuidPattern.test(invoiceId)) {
        return NextResponse.json(
            { success: false, message: "Invalid invoice request" },
            { status: 400 }
        );
    }

    try {
        const [invoice] = await db
            .select({
                id: sellerInvoices.id,
                invoiceNumber: sellerInvoices.invoiceNumber,
                storageKey: sellerInvoices.pdfStorageKey,
            })
            .from(sellerInvoices)
            .innerJoin(orders, eq(orders.id, sellerInvoices.orderId))
            .where(
                and(
                    eq(sellerInvoices.id, invoiceId),
                    eq(sellerInvoices.orderId, orderId),
                    eq(orders.userId, auth.customerId),
                    eq(orders.status, "delivered"),
                    eq(sellerInvoices.status, "ready")
                )
            )
            .limit(1);

        if (!invoice || !invoice.storageKey || !invoice.invoiceNumber) {
            return NextResponse.json(
                { success: false, message: "Invoice not found or unavailable" },
                { status: 404 }
            );
        }

        const privateUrl = getPrivateInvoiceDownloadUrl(invoice.storageKey);
        const upstream = await fetch(privateUrl, { cache: "no-store" });
        if (!upstream.ok) {
            console.error(
                "PRIVATE_INVOICE_DOWNLOAD_ERROR:",
                upstream.status,
                invoice.id
            );
            return NextResponse.json(
                { success: false, message: "Invoice download is temporarily unavailable" },
                { status: 502 }
            );
        }

        const pdf = await upstream.arrayBuffer();
        const filename = `${invoice.invoiceNumber.replace(/[^A-Z0-9_-]/gi, "_")}.pdf`;
        return new NextResponse(pdf, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        console.error("DOWNLOAD_ORDER_INVOICE_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Could not download invoice" },
            { status: 500 }
        );
    }
}
