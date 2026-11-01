
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "../verify-token";
import { adminAuditLogs } from "@/app/api/lib/schema/admin-audit-logs";
import { db } from "@/app/api/lib/db";


export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAdminToken(request);
        if (!auth.success) return auth.response;

        if (!["admin", "super_admin"].includes(auth.payload.role)) {
            return NextResponse.json(
                { success: false, message: "You do not have permission to view products" },
                { status: 403 }
            );
        }

        const getAdminAuditLogs = await db
            .select({
                userId: adminAuditLogs.id,
                adminId: adminAuditLogs.adminId,
                action: adminAuditLogs.action,
                targetType: adminAuditLogs.targetType,
                targetId: adminAuditLogs.targetId,
                resean: adminAuditLogs.reason,
                createdAt: adminAuditLogs.createdAt
            })
            .from(adminAuditLogs);
        
        return NextResponse.json({
            success: true,
            message: "get all audit from user",
            getAuditLogs: getAdminAuditLogs
        }, { status: 200 });

    } catch (error) {
        console.error("ADMIN_AUDIT_LOGS_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch products" },
            { status: 500 }
        );
    }
}