import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireCustomer } from "@/app/api/lib/customer-auth";
import { db } from "@/app/api/lib/db";
import { sellerInvoices, invoiceGenerationJobs } from "@/app/api/lib/schema/invoice-schema";
import { orders } from "@/app/api/lib/schema/checkout-schema";

type RouteContext = { params: Promise<{ orderId: string }> };
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext) {
    const auth = await requireCustomer();
    if (auth.customerId === null) return auth.response;

    const { orderId } = await context.params;
    if (!uuidPattern.test(orderId)) {
        return NextResponse.json(
            { success: false, message: "Invalid order ID" },
            { status: 400 }
        );
    }

    try {
        const [order] = await db
            .select({ id: orders.id, status: orders.status })
            .from(orders)
            .where(and(eq(orders.id, orderId), eq(orders.userId, auth.customerId)))
            .limit(1);

        if (!order) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }

        if (order.status !== "delivered") {
            return NextResponse.json({
                success: true,
                data: { state: "locked", invoices: [] },
            });
        }

        const [job] = await db
            .select({ status: invoiceGenerationJobs.status })
            .from(invoiceGenerationJobs)
            .where(eq(invoiceGenerationJobs.orderId, order.id))
            .limit(1);
        const invoices = await db
            .select({
                id: sellerInvoices.id,
                invoiceNumber: sellerInvoices.invoiceNumber,
                invoiceType: sellerInvoices.invoiceType,
                status: sellerInvoices.status,
                sellerSnapshot: sellerInvoices.sellerSnapshot,
            })
            .from(sellerInvoices)
            .where(eq(sellerInvoices.orderId, order.id));

        const data = invoices.map((invoice) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            sellerName:
                invoice.sellerSnapshot?.invoiceDisplayName ?? "Seller invoice",
            invoiceType: invoice.invoiceType,
            status:
                invoice.status === "ready"
                    ? "ready"
                    : invoice.status === "failed"
                      ? "failed"
                      : invoice.status === "blocked"
                        ? "unavailable"
                        : "generating",
        }));

        const state =
            data.some((invoice) => invoice.status === "generating") ||
            (!data.length && ["pending", "processing"].includes(job?.status ?? ""))
                ? "generating"
                : data.length
                  ? "ready"
                  : job?.status === "failed"
                    ? "failed"
                    : "unavailable";

        return NextResponse.json({
            success: true,
            data: { state, invoices: data },
        });
    } catch (error) {
        console.error("GET_ORDER_INVOICES_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Could not load invoices" },
            { status: 500 }
        );
    }
}
