import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";
import { adminAuditLogs } from "@/app/api/lib/schema/admin-audit-logs";
import { requireAdmin } from "@/app/api/auth/admin/lib/require-admin";

// Next.js 15: params is a Promise. On Next 14 use { params }: { params: { id: string } }
type Ctx = { params: Promise<{ userId: string }> };

const idSchema = z.string().uuid();

const patchSchema = z
    .object({
        action: z.enum(["block", "unblock"]),
        reason: z.string().trim().max(300).optional(),
    })
    .refine((d) => d.action !== "block" || (d.reason && d.reason.length >= 3), {
        message: "A reason is required to block a customer",
        path: ["reason"],
    });

const bad = (message: string, status = 400) =>
    NextResponse.json({ success: false, message }, { status });

// PATCH /api/auth/admin/users/:id   { action: "block" | "unblock", reason? }
// admin + super_admin
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const auth = await requireAdmin(request);
        if (!auth.ok) return auth.response;

        const idResult = idSchema.safeParse((await params).userId);
        if (!idResult.success) return bad("Invalid customer id");
        const id = idResult.data;

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return bad("Invalid JSON body");
        }
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid request data");

        const { action, reason } = parsed.data;
        const blocking = action === "block";

        const [updated] = await db
            .update(users)
            .set({
                isBlocked: blocking,
                blockedReason: blocking ? reason ?? null : null,
                blockedAt: blocking ? new Date() : null,
                blockedBy: blocking ? auth.admin.id : null,
                updatedAt: new Date(),
            })
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .returning({ id: users.id, isBlocked: users.isBlocked });

        if (!updated) return bad("Customer not found", 404);

        await db.insert(adminAuditLogs).values({
            adminId: auth.admin.id,
            action: blocking ? "user.block" : "user.unblock",
            targetType: "user",
            targetId: id,
            reason: blocking ? reason ?? null : null,
        });

        return NextResponse.json({
            success: true,
            message: blocking ? "Customer blocked" : "Customer unblocked",
            user: updated,
        });
    } catch (error) {
        console.error("ADMIN_PATCH_USER_ERROR:", error);
        return bad("Internal server error", 500);
    }
}

// DELETE /api/auth/admin/users/:id   (soft delete) - super_admin ONLY
export async function DELETE(request: NextRequest, { params }: Ctx) {
    try {
        const auth = await requireAdmin(request, ["super_admin"]);
        if (!auth.ok) return auth.response;

        const idResult = idSchema.safeParse((await params).userId);
        if (!idResult.success) return bad("Invalid customer id");
        const id = idResult.data;

        const [deleted] = await db
            .update(users)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .returning({ id: users.id });

        if (!deleted) return bad("Customer not found", 404);

        await db.insert(adminAuditLogs).values({
            adminId: auth.admin.id,
            action: "user.delete",
            targetType: "user",
            targetId: id,
        });

        return NextResponse.json({ success: true, message: "Customer deleted" });
    } catch (error) {
        console.error("ADMIN_DELETE_USER_ERROR:", error);
        return bad("Internal server error", 500);
    }
}