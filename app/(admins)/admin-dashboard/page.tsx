"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

/* ---------- API endpoints ---------- */
const VENDORS_URL = "/api/auth/admin/vendors/get-vendors";
const USERS_URL = "/api/auth/admin/users";
const AUDIT_LOGS_URL = "/api/auth/admin/admin-audit-logs";
// ASSUMPTION: change this to your real "list admins" GET route
const ADMIN_LIST_URL = "/api/auth/admin/approve";

/* ---------- placeholder data (replace with API data later) ---------- */
const stats = [
    {
        label: "Total vendors",
        value: "120",
        note: "+6 this week",
        tone: "bg-indigo-50 text-indigo-600 ring-indigo-100",
        icon: (
            <>
                <path d="M3 9 5 4h14l2 5" />
                <path d="M4 9v11h16V9" />
                <path d="M9 20v-6h6v6" />
            </>
        ),
    },
    {
        label: "Total customers",
        value: "2,431",
        note: "+112 this week",
        tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
        icon: (
            <>
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
                <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
                <path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
            </>
        ),
    },
    {
        label: "Pending approvals",
        value: "9",
        note: "Needs review",
        tone: "bg-amber-50 text-amber-600 ring-amber-100",
        icon: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
            </>
        ),
    },
    {
        label: "Active admins",
        value: "14",
        note: "2 suspended",
        tone: "bg-slate-100 text-slate-700 ring-slate-200",
        icon: (
            <>
                <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
            </>
        ),
    },
];

type Activity = {
    title: string;
    detail: string;
    time: string;
    status: "approved" | "pending" | "rejected" | "suspended";
};

/* shape of one row returned by the audit logs API */
type AuditLog = {
    action: string;
    targetType: string;
    targetId: string;
    adminId: string;
    resean?: string | null; // spelled this way in your API
    createdAt: string;
};

const statusStyles: Record<Activity["status"], { badge: string; dot: string }> = {
    pending: {
        badge: "bg-amber-50 text-amber-700 ring-amber-200",
        dot: "bg-amber-500",
    },
    approved: {
        badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        dot: "bg-emerald-500",
    },
    rejected: {
        badge: "bg-rose-50 text-rose-700 ring-rose-200",
        dot: "bg-rose-500",
    },
    suspended: {
        badge: "bg-orange-50 text-orange-700 ring-orange-200",
        dot: "bg-orange-500",
    },
};

const quickLinks = [
    {
        label: "Review admin requests",
        text: "Approve or reject new admins",
        href: "/admin-dashboard/approve",
        superAdminOnly: true,
    },
    {
        label: "Manage vendors",
        text: "Check vendor accounts and status",
        href: "/admin-dashboard/vendors",
    },
    {
        label: "Manage customers",
        text: "View and block customer accounts",
        href: "/admin-dashboard/users",
    },
];

const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

type VendorRow = { status?: string; isActive?: boolean };
type AdminRow = { status?: string; isActive?: boolean };

/* ---------- helpers for Recent activity ---------- */

// "vendor_approved" / "admin-suspend" -> "Vendor approved" / "Admin suspend"
function humanize(value: string): string {
    const text = (value ?? "").replace(/[_-]+/g, " ").trim().toLowerCase();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Action";
}

// map any action string to one of the 4 badge styles
function actionToStatus(action: string): Activity["status"] {
    const a = (action ?? "").toLowerCase();
    if (a.includes("reject") || a.includes("delete") || a.includes("remove")) return "rejected";
    if (a.includes("suspend") || a.includes("block")) return "suspended";
    if (a.includes("pending") || a.includes("signup") || a.includes("register")) return "pending";
    return "approved"; // approve, reactivate, unblock, update, etc.
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (Number.isNaN(diff)) return "";
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Just now";
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
    const day = Math.floor(hr / 24);
    if (day === 1) return "Yesterday";
    if (day < 7) return `${day} days ago`;
    return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
    });
}

function toActivity(log: AuditLog): Activity {
    const target = humanize(log.targetType);
    const reason = log.resean?.trim();
    return {
        title: humanize(log.action),
        detail: reason ? `${target} · ${reason}` : target,
        time: timeAgo(log.createdAt),
        status: actionToStatus(log.action),
    };
}

export default function AdminDashboardPage() {
    const [role, setRole] = useState("");
    const [totalVendors, setTotalVendors] = useState(0);

    const isSuperAdmin = role === "super_admin";

    /* ---------- Vendors (total + pending) ---------- */
    const { data } = useQuery({
        queryKey: ["TotalVendor"],
        queryFn: async () => {
            const res = await api.get(VENDORS_URL);
            return res.data;
        }
    });

    /* ---------- Customers (total) ---------- */
    const { data: usersData } = useQuery({
        queryKey: ["TotalCustomers"],
        queryFn: async () => {
            const res = await api.get(USERS_URL, {
                params: { page: 1, limit: 1 },
            });
            return res.data;
        },
    });

    /* ---------- Admins (pending + active) - super admin only ---------- */
    const { data: adminsData } = useQuery({
        queryKey: ["DashboardAdmins"],
        queryFn: async () => {
            const res = await api.get(ADMIN_LIST_URL);
            return res.data;
        },
        enabled: isSuperAdmin,
    });

    /* ---------- Recent activity (audit logs) ---------- */
    const {
        data: auditData,
        isPending: activityLoading,
        isError: activityError,
    } = useQuery({
        queryKey: ["DashboardRecentActivity"],
        queryFn: async () => {
            const res = await api.get(AUDIT_LOGS_URL);
            return res.data;
        },
    });

    useEffect(() => {
        if (data?.vendorDetails) {
            setTotalVendors(data.vendorDetails.length);
        }
    }, [data]);


    useEffect(() => {
        setRole(localStorage.getItem("admin_role") ?? "");
    }, []);

    const links = quickLinks.filter((l) => !l.superAdminOnly || isSuperAdmin);

    /* ---------- Derived stat values ---------- */
    const vendorList: VendorRow[] = data?.vendorDetails ?? [];
    const adminList: AdminRow[] =
        adminsData?.admins ?? adminsData?.adminDetails ?? [];

    const totalCustomers: number = usersData?.stats?.total ?? 0;

    const pendingVendors = vendorList.filter(
        (v) => v.status === "pending"
    ).length;

    const pendingAdmins = adminList.filter(
        (a) => a.status === "pending"
    ).length;

    const activeAdmins = adminList.filter(
        (a) => a.status === "approved" && a.isActive
    ).length;

    const statValues: Record<string, string | number> = {
        "Total vendors": totalVendors,
        "Total customers": totalCustomers.toLocaleString("en-IN"),
        "Pending approvals": pendingVendors + (isSuperAdmin ? pendingAdmins : 0),
        "Active admins": isSuperAdmin ? activeAdmins : "—",
    };

    /* ---------- Derived recent activity (latest 5, newest first) ---------- */
    const auditLogs: AuditLog[] = Array.isArray(auditData?.getAuditLogs)
        ? auditData.getAuditLogs
        : [];

    const activity: Activity[] = [...auditLogs]
        .sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
        )
        .slice(0, 5)
        .map(toActivity);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* Welcome banner */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white sm:p-10">
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                        backgroundSize: "44px 44px",
                    }}
                />
                <div className="relative max-w-xl">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
                        Welcome back
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                        Here is what is happening across your vendors,
                        customers and admin team today.
                    </p>
                    {isSuperAdmin && (
                        <Link
                            href="/admin-dashboard/approve"
                            className="btn mt-6 h-11 rounded-xl border-0 bg-white px-5 font-medium text-slate-900 hover:bg-slate-100"
                        >
                            Review pending admins
                        </Link>
                    )}
                    <Link
                        href="/admin-dashboard/vendors"
                        className="md:mx-2 btn mt-6 h-11 rounded-xl border-0 bg-white px-5 font-medium text-slate-900 hover:bg-slate-100"
                    >
                        Review pending vendors
                    </Link>
                </div>
            </section>

            {/* Stat cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((s) => (
                    <div key={s.label} className={`${cardCls} p-5`}>
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-500">
                                {s.label}
                            </p>
                            <span
                                className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${s.tone}`}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                >
                                    {s.icon}
                                </svg>
                            </span>
                        </div>
                        <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                            {statValues[s.label] ?? s.value}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">{s.note}</p>
                    </div>
                ))}
            </section>

            {/* Activity + quick links */}
            <section className="grid gap-6 lg:grid-cols-3">
                {/* Recent activity */}
                <div className={`${cardCls} p-5 sm:p-6 lg:col-span-2`}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">
                            Recent activity
                        </h2>
                        {isSuperAdmin && (
                            <Link
                                href="/admin-dashboard/audit-logs"
                                className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                            >
                                View all
                            </Link>
                        )}
                    </div>

                    {activityLoading ? (
                        <p className="mt-4 text-sm text-slate-500">
                            Loading activity...
                        </p>
                    ) : activityError ? (
                        <p className="mt-4 text-sm text-slate-500">
                            Could not load recent activity.
                        </p>
                    ) : activity.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-500">
                            No recent activity yet.
                        </p>
                    ) : (
                        <ul className="mt-4 divide-y divide-slate-100">
                            {activity.map((item, i) => {
                                const style = statusStyles[item.status];
                                return (
                                    <li
                                        key={i}
                                        className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-900">
                                                {item.title}
                                            </p>
                                            <p className="mt-0.5 break-words text-sm text-slate-500">
                                                {item.detail}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 sm:shrink-0">
                                            <span
                                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${style.badge}`}
                                            >
                                                <span
                                                    className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                                                />
                                                {item.status}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {item.time}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Quick links */}
                <div className={`${cardCls} p-5 sm:p-6`}>
                    <h2 className="text-lg font-semibold text-slate-900">
                        Quick actions
                    </h2>
                    <div className="mt-4 space-y-3">
                        {links.map((l) => (
                            <Link
                                key={l.href}
                                href={l.href}
                                className="block rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70 transition-colors hover:bg-white hover:ring-slate-300"
                            >
                                <p className="text-sm font-medium text-slate-900">
                                    {l.label}
                                </p>
                                <p className="mt-0.5 text-sm text-slate-500">
                                    {l.text}
                                </p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
