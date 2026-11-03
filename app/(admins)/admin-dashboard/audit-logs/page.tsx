// FILE: the same place as your current audit-logs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/app/lib/axios";
import {
    GemIcon,
    Pagination,
    Svg,
    cardCls,
    fieldCls,
    goldBtn,
} from "@/app/components/Shop-ui";
import AuditLogRow, { actionLabel, type AuditLogI } from "./components/Audit-log-row";

const PER_PAGE = 10;
const DAY = 24 * 60 * 60 * 1000;

type RangeValue = "all" | "today" | "7d" | "30d";

const RANGES: { value: RangeValue; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
];

interface FiltersForm {
    search: string;
    action: string;
    targetType: string;
    sort: "newest" | "oldest";
    range: RangeValue;
}

const DEFAULT_FILTERS: FiltersForm = {
    search: "",
    action: "",
    targetType: "",
    sort: "newest",
    range: "all",
};

interface HttpErrorLike {
    response?: { data?: { message?: string } };
}

function rangeStart(range: RangeValue): number | null {
    if (range === "all") return null;
    if (range === "today") {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }
    return Date.now() - (range === "7d" ? 7 : 30) * DAY;
}

function SelectField({
    id,
    label,
    children,
    ...props
}: {
    id: string;
    label: string;
    children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className="relative">
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <select
                id={id}
                className={`${fieldCls} cursor-pointer appearance-none px-4 pr-11`}
                {...props}
            >
                {children}
            </select>
            <Svg
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                strokeWidth={2}
            >
                <path d="m6 9 6 6 6-6" />
            </Svg>
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
    return (
        <div className={`${cardCls} flex items-center gap-4 p-4 sm:p-5`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>
                <span className="text-base font-semibold">{value}</span>
            </span>
            <p className="text-sm font-medium text-slate-600">{label}</p>
        </div>
    );
}

export default function AdminAuditLogsPage() {
    // null = not checked yet, so we don't fire a request before reading the token
    const [hasToken, setHasToken] = useState<boolean | null>(null);
    const [page, setPage] = useState(1);

    useEffect(() => {
        setHasToken(Boolean(localStorage.getItem("admin_token")));
    }, []);

    const { register, watch, setValue, reset } = useForm<FiltersForm>({
        defaultValues: DEFAULT_FILTERS,
    });

    const search = watch("search");
    const action = watch("action");
    const targetType = watch("targetType");
    const sort = watch("sort");
    const range = watch("range");

    // back to page 1 whenever a filter changes
    useEffect(() => {
        const sub = watch(() => setPage(1));
        return () => sub.unsubscribe();
    }, [watch]);

    /* ---------- data ---------- */
    const { data, isPending, isError, error, isFetching, refetch } = useQuery({
        queryKey: ["getAdminAuditLogs"],
        queryFn: async () => (await api.get("/api/auth/admin/admin-audit-logs")).data,
        enabled: hasToken === true,
    });

    const logs: AuditLogI[] = useMemo(
        () => (Array.isArray(data?.getAuditLogs) ? data.getAuditLogs : []),
        [data]
    );

    // options for the dropdowns come from the data itself
    const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);
    const targetTypes = useMemo(() => Array.from(new Set(logs.map((l) => l.targetType))).sort(), [logs]);

    /* ---------- filtering, sorting, paging (client side) ---------- */
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const from = rangeStart(range);

        const list = logs.filter((l) => {
            if (action && l.action !== action) return false;
            if (targetType && l.targetType !== targetType) return false;
            if (from !== null && new Date(l.createdAt).getTime() < from) return false;
            if (!q) return true;
            return [l.action, l.targetType, l.targetId, l.adminId, l.resean ?? ""].some((v) =>
                v.toLowerCase().includes(q)
            );
        });

        // the API does not sort, so do it here
        return list.sort((a, b) => {
            const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return sort === "newest" ? -diff : diff;
        });
    }, [logs, search, action, targetType, range, sort]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    const hasFilters =
        search.trim() !== "" || action !== "" || targetType !== "" || range !== "all" || sort !== "newest";

    const clearFilters = () => {
        reset(DEFAULT_FILTERS);
        setPage(1);
    };

    const stats = useMemo(() => {
        const dayAgo = Date.now() - DAY;
        return {
            total: logs.length,
            last24h: logs.filter((l) => new Date(l.createdAt).getTime() >= dayAgo).length,
            admins: new Set(logs.map((l) => l.adminId)).size,
        };
    }, [logs]);

    const loadError =
        (error as HttpErrorLike | null)?.response?.data?.message ??
        "Something went wrong. Please check your connection and try again.";

    return (
        <div>
            {/* ================= HEADER ================= */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">Security</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                        Audit logs
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-slate-600">
                        A record of every action taken by admins, with the target and the reason.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={hasToken !== true || isFetching}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-medium text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60 sm:w-auto"
                >
                    <Svg className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} strokeWidth={2}>
                        <path d="M20 12a8 8 0 1 1-3-6.2" />
                        <path d="M20 4v4h-4" />
                    </Svg>
                    {isFetching ? "Refreshing…" : "Refresh"}
                </button>
            </div>

            {hasToken === false ? (
                /* ---------- not logged in as admin ---------- */
                <div className={`${cardCls} mx-auto mt-10 max-w-lg p-10 text-center`}>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                        <GemIcon className="h-7 w-7" />
                    </span>
                    <h2 className="mt-5 text-lg font-semibold text-slate-900">Admin login required</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Please log in with an admin account to view the audit logs.
                    </p>
                </div>
            ) : (
                <>
                    {/* ================= STATS ================= */}
                    {!isPending && !isError && logs.length > 0 && (
                        <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-5">
                            <Stat label="Total events" value={stats.total} tone="bg-slate-900 text-amber-300" />
                            <Stat label="Last 24 hours" value={stats.last24h} tone="bg-indigo-50 text-indigo-700" />
                            <Stat label="Admins involved" value={stats.admins} tone="bg-emerald-50 text-emerald-700" />
                        </div>
                    )}

                    {/* ================= FILTERS ================= */}
                    {logs.length > 0 && (
                        <div className={`${cardCls} mt-6 p-4 sm:p-5`}>
                            <form onSubmit={(e) => e.preventDefault()} role="search" className="space-y-3">
                                <div className="relative">
                                    <label htmlFor="audit-search" className="sr-only">
                                        Search audit logs
                                    </label>
                                    <Svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500">
                                        <circle cx="11" cy="11" r="7" />
                                        <path d="m20 20-3.5-3.5" />
                                    </Svg>
                                    <input
                                        id="audit-search"
                                        type="search"
                                        autoComplete="off"
                                        placeholder="Search by action, reason, target ID or admin ID…"
                                        className={`${fieldCls} pl-12 pr-4`}
                                        {...register("search")}
                                    />
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3">
                                    <SelectField id="audit-action" label="Filter by action" {...register("action")}>
                                        <option value="">All actions</option>
                                        {actions.map((a) => (
                                            <option key={a} value={a}>
                                                {actionLabel(a)}
                                            </option>
                                        ))}
                                    </SelectField>

                                    <SelectField id="audit-target" label="Filter by target type" {...register("targetType")}>
                                        <option value="">All targets</option>
                                        {targetTypes.map((t) => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </SelectField>

                                    <SelectField id="audit-sort" label="Sort logs" {...register("sort")}>
                                        <option value="newest">Newest first</option>
                                        <option value="oldest">Oldest first</option>
                                    </SelectField>
                                </div>
                            </form>

                            <div
                                className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                role="group"
                                aria-label="Filter by date"
                            >
                                {RANGES.map((r) => {
                                    const active = range === r.value;
                                    return (
                                        <button
                                            key={r.value}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => setValue("range", r.value)}
                                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active
                                                ? "bg-slate-950 text-amber-300 shadow-md shadow-slate-950/20"
                                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                                }`}
                                        >
                                            {r.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ================= LIST ================= */}
                    <div className="mt-6">
                        {hasToken === null || isPending ? (
                            <div className="space-y-4">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className={`${cardCls} flex items-start gap-4 p-5`}>
                                        <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-200/70" />
                                        <div className="flex-1 space-y-3">
                                            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200/70" />
                                            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200/70" />
                                            <div className="h-6 w-1/2 animate-pulse rounded-lg bg-slate-200/70" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : isError ? (
                            <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                                    <Svg className="h-7 w-7">
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 8v5M12 16.5v.01" />
                                    </Svg>
                                </span>
                                <h2 className="mt-5 text-lg font-semibold text-slate-900">
                                    We couldn&apos;t load the audit logs
                                </h2>
                                <p className="mt-2 text-sm text-slate-600">{loadError}</p>
                                <button type="button" onClick={() => refetch()} className={`${goldBtn} mt-6`}>
                                    Try again
                                </button>
                            </div>
                        ) : logs.length === 0 ? (
                            <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                                    <GemIcon className="h-7 w-7" />
                                </span>
                                <h2 className="mt-5 text-lg font-semibold text-slate-900">No activity yet</h2>
                                <p className="mt-2 text-sm text-slate-600">
                                    Admin actions will appear here as soon as they happen.
                                </p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                                    <GemIcon className="h-7 w-7" />
                                </span>
                                <h2 className="mt-5 text-lg font-semibold text-slate-900">No logs found</h2>
                                <p className="mt-2 text-sm text-slate-600">
                                    Try a different search or remove the filters.
                                </p>
                                <button type="button" onClick={clearFilters} className={`${goldBtn} mt-6`}>
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="mb-4 text-sm text-slate-600" aria-live="polite">
                                    <span className="font-semibold text-slate-900">{filtered.length}</span>{" "}
                                    {filtered.length === 1 ? "event" : "events"}
                                    {hasFilters && (
                                        <>
                                            {" "}·{" "}
                                            <button
                                                type="button"
                                                onClick={clearFilters}
                                                className="font-medium text-slate-900 underline underline-offset-4"
                                            >
                                                Clear filters
                                            </button>
                                        </>
                                    )}
                                </p>

                                <div className="space-y-4">
                                    {pageItems.map((log) => (
                                        <AuditLogRow key={log.userId} log={log} />
                                    ))}
                                </div>

                                <Pagination
                                    page={currentPage}
                                    totalPages={totalPages}
                                    onChange={(p) => {
                                        setPage(p);
                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}
                                />
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}