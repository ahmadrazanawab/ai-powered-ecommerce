"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ---------- placeholder data (replace with API data later) ---------- */
const stats = [
    {
        label: "Total vendors",
        value: "128",
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

const activity: Activity[] = [
    {
        title: "New admin signup",
        detail: "nawabalam@gmail.com is waiting for approval",
        time: "5 min ago",
        status: "pending",
    },
    {
        title: "Vendor approved",
        detail: "Fresh Mart was approved by a super admin",
        time: "1 hour ago",
        status: "approved",
    },
    {
        title: "Vendor rejected",
        detail: "Incomplete business documents",
        time: "3 hours ago",
        status: "rejected",
    },
    {
        title: "Admin suspended",
        detail: "Suspended for policy violation",
        time: "Yesterday",
        status: "suspended",
    },
    {
        title: "Customer blocked",
        detail: "Multiple failed payment attempts",
        time: "Yesterday",
        status: "suspended",
    },
];

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

export default function AdminDashboardPage() {
    const [role, setRole] = useState("");

    useEffect(() => {
        setRole(localStorage.getItem("admin_role") ?? "");
    }, []);

    const isSuperAdmin = role === "super_admin";
    const links = quickLinks.filter((l) => !l.superAdminOnly || isSuperAdmin);

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
                            {s.value}
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