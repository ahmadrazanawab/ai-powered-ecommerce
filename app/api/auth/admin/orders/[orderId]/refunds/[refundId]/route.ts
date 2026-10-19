import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { orders } from "@/app/api/lib/schema/checkout-schema";
import { orderRefunds } from "@/app/api/lib/schema/refund-schema";
import { verifyAdminToken } from "@/app/api/auth/admin/verify-token";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ orderId: string; refundId: string }>;
  }
) {
  try {
    const auth = await verifyAdminToken(request);
    if (!auth.success) return auth.response;

    if (!["admin", "super_admin"].includes(auth.payload.role)) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const { orderId, refundId } = await params;
    const body = await request.json();

    if (!["processed", "failed"].includes(body.status)) {
      return NextResponse.json(
        { success: false, message: "Status must be processed or failed" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update")
        .limit(1);

      if (!order) return { error: "ORDER_NOT_FOUND" as const };

      const [refund] = await tx
        .select()
        .from(orderRefunds)
        .where(
          and(
            eq(orderRefunds.id, refundId),
            eq(orderRefunds.orderId, orderId)
          )
        )
        .for("update")
        .limit(1);

      if (!refund) return { error: "REFUND_NOT_FOUND" as const };

      if (refund.status !== "pending") {
        return { error: "NOT_PENDING" as const };
      }

      const [updatedRefund] = await tx
        .update(orderRefunds)
        .set({
          status: body.status,
          processedAt: body.status === "processed" ? new Date() : null,
          processedBy: auth.payload.adminId,
        })
        .where(eq(orderRefunds.id, refund.id))
        .returning();

      if (body.status === "processed") {
        const [totals] = await tx
          .select({
            total: sql<string>`COALESCE(SUM(${orderRefunds.amount}), 0)`,
          })
          .from(orderRefunds)
          .where(
            and(
              eq(orderRefunds.orderId, orderId),
              eq(orderRefunds.status, "processed")
            )
          );

        if (
          Math.round(Number(totals?.total ?? 0) * 100) >=
          Math.round(Number(order.subtotal) * 100)
        ) {
          await tx
            .update(orders)
            .set({
              paymentStatus: "refunded",
              updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId));
        }
      }

      return { refund: updatedRefund };
    });

    if ("error" in result) {
      const errors: Record<string, string> = {
        ORDER_NOT_FOUND: "Order not found",
        REFUND_NOT_FOUND: "Refund not found",
        NOT_PENDING: "Only pending refunds can be updated",
      };

      return NextResponse.json(
        { success: false, message: errors[result.error!] },
        { status: result.error?.endsWith("NOT_FOUND") ? 404 : 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.refund,
    });
  } catch (error) {
    console.error("UPDATE_REFUND_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Failed to update refund" },
      { status: 500 }
    );
  }
}