"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
    useUpdateFulfillment,
    useVendorOrders,
    type VendorNextStatus,
    type VendorOrderRow,
} from "@/app/hooks/use-vendor-orders";
import type { FulfillmentStatus, PaymentStatus } from "@/app/hooks/use-orders";

/* ---------- config ---------- */
const PAGE_SIZE = 10;
const LOGIN_PATH = "/vendor/login"; // change if your vendor login lives elsewhere

interface FiltersForm {
    search: string;
    status: "" | FulfillmentStatus;
}

const STATUS_FILTERS: { value: "" | FulfillmentStatus; label: string }[] = [
    { value: "", label: "All" },
    { value: "pending", label: "To process" },
    { value: "processing", label: "To ship" },
    { value: "shipped", label: "In transit" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
];

const ITEM_STYLE: Record<FulfillmentStatus, string> = {
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    processing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    shipped: "bg-sky-50 text-sky-700 ring-sky-200",
    delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

/* same transitions as PATCH /api/auth/vendor/orders/[itemId] */
const NEXT_STEP: Partial<
    Record<FulfillmentStatus, { status: VendorNextStatus; label: string }>
> = {
    pending: { status: "processing", label: "Start processing" },
    processing: { status: "shipped", label: "Mark as shipped" },
    shipped: { status: "delivered", label: "Mark as delivered" },
};

const CAN_CANCEL: FulfillmentStatus[] = ["pending", "processing"];

/* ---------- shared style helpers ---------- */
const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:opacity-60";

const fieldCls =
    "h-11 w-full rounded-xl bg-white text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-amber-400/70";

const Svg = ({
    children,
    className = "h-5 w-5",
    strokeWidth = 1.7,
}: {
    children: ReactNode;
    className?: string;
    strokeWidth?: number;
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {children}
    </svg>
);

/* ---------- helpers ---------- */
function formatMoney(value: string | number, currency = "inr") {
    const n = Number(value);
    const safe = Number.isNaN(n) ? 0 : n;

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currency.toUpperCase(),
        }).format(safe);
    } catch {
        return safe.toFixed(2);
    }
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

const shortId = (id: string) => id.slice(0, 8).toUpperCase();
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function apiMessage(err: unknown, fallback: string) {
    return (
        (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? fallback
    );
}

function isPaid(status: PaymentStatus) {
    return status === "paid" || status === "succeeded";
}

function getPages(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const set = new Set([1, total, current - 1, current, current + 1]);
    const sorted = Array.from(set)
        .filter((p) => p >= 1 && p <= total)
        .sort((a, b) => a - b);

    const out: (number | "…")[] = [];
    let prev = 0;
    for (const p of sorted) {
        if (p - prev > 1) out.push("…");
        out.push(p);
        prev = p;
    }
    return out;
}

function Badge({
    status,
    label,
}: {
    status: FulfillmentStatus;
    label?: string;
}) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${ITEM_STYLE[status]}`}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {label ?? titleCase(status)}
        </span>
    );
}

/* ---------- page ---------- */
export default function VendorOrdersPage() {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [cancelId, setCancelId] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const { register, watch, setValue, reset } = useForm<FiltersForm>({
        defaultValues: { search: "", status: "" },
    });

    const search = watch("search");
    const status = watch("status");

    const { data, isPending, isError, error, isFetching, refetch } =
        useVendorOrders();
    const update = useUpdateFulfillment();

    useEffect(() => {
        const code = (error as { response?: { status?: number } } | null)
            ?.response?.status;
        if (code === 401) router.push(LOGIN_PATH);
    }, [error, router]);

    useEffect(() => {
        const sub = watch(() => setPage(1));
        return () => sub.unsubscribe();
    }, [watch]);

    const all: VendorOrderRow[] = useMemo(
        () => (Array.isArray(data?.data) ? data.data : []),
        [data]
    );

    const counts = useMemo(() => {
        const map: Record<string, number> = { "": all.length };
        for (const r of all) {
            map[r.item.fulfillmentStatus] =
                (map[r.item.fulfillmentStatus] ?? 0) + 1;
        }
        return map;
    }, [all]);

    const earnings = useMemo(
        () =>
            all
                .filter((r) => r.item.fulfillmentStatus === "delivered")
                .reduce((sum, r) => sum + Number(r.item.lineTotal), 0),
        [all]
    );

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();

        return all.filter((r) => {
            if (status && r.item.fulfillmentStatus !== status) return false;
            if (!q) return true;

            const a = r.order.shippingAddress ?? {};
            return [r.item.productName, r.order.id, a.fullName, a.city, a.phone]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q));
        });
    }, [all, search, status]);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const hasFilters = search.trim() !== "" || status !== "";

    const runUpdate = (itemId: string, next: VendorNextStatus) => {
        setNotice(null);
        update.mutate(
            { itemId, status: next },
            {
                onSuccess: (res) => {
                    setCancelId(null);
                    setNotice(res?.message ?? "Fulfillment status updated");
                },
            }
        );
    };

    const pendingItemId = update.isPending ? update.variables?.itemId : null;

    const pageBtn =
        "grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* header */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                        Orders to fulfil
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Process, ship and deliver the products customers ordered
                        from you.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="mt-3 inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60 sm:mt-0"
                >
                    <Svg
                        className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                        strokeWidth={2}
                    >
                        <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
                    </Svg>
                    Refresh
                </button>
            </div>

            {/* stats */}
            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                    { label: "To process", value: String(counts.pending ?? 0) },
                    { label: "To ship", value: String(counts.processing ?? 0) },
                    {
                        label: "Delivered sales",
                        value: formatMoney(earnings, all[0]?.order.currency),
                    },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950 p-4 text-white ring-1 ring-slate-900"
                    >
                        <dt className="text-xs text-slate-300">{s.label}</dt>
                        <dd className="mt-1 text-2xl font-semibold tracking-tight text-amber-300">
                            {isPending ? "…" : s.value}
                        </dd>
                    </div>
                ))}
            </dl>

            {/* filters */}
            <div className={`${cardCls} mt-6 p-4 sm:p-5`}>
                <form role="search" onSubmit={(e) => e.preventDefault()}>
                    <div className="relative">
                        <label htmlFor="vendor-search" className="sr-only">
                            Search orders
                        </label>
                        <Svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                        </Svg>
                        <input
                            id="vendor-search"
                            type="search"
                            autoComplete="off"
                            placeholder="Product, order ID, customer, city…"
                            className={`${fieldCls} pl-11 pr-4`}
                            {...register("search")}
                        />
                    </div>
                    <input type="hidden" {...register("status")} />
                </form>

                <div
                    className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    role="group"
                    aria-label="Filter by status"
                >
                    {STATUS_FILTERS.map((f) => {
                        const active = status === f.value;

                        return (
                            <button
                                key={f.value || "all"}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                    setValue("status", f.value, {
                                        shouldDirty: true,
                                    })
                                }
                                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active
                                        ? "bg-slate-950 text-amber-300 shadow-md shadow-slate-950/20"
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    }`}
                            >
                                {f.label}
                                {!isPending && (
                                    <span
                                        className={`ml-1.5 text-xs ${active
                                                ? "text-amber-300/70"
                                                : "text-slate-500"
                                            }`}
                                    >
                                        {counts[f.value] ?? 0}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* feedback */}
            <div aria-live="polite" className="mt-4 space-y-2">
                {notice && (
                    <p
                        role="status"
                        className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200"
                    >
                        {notice}
                    </p>
                )}
                {update.isError && (
                    <p
                        role="alert"
                        className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
                    >
                        {apiMessage(update.error, "Could not update this item.")}
                    </p>
                )}
            </div>

            {/* table */}
            <div
                className={`${cardCls} mt-2 overflow-hidden transition-opacity duration-200 ${isFetching && !isPending ? "opacity-60" : "opacity-100"
                    }`}
            >
                {isPending ? (
                    <div className="space-y-3 p-5">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-14 animate-pulse rounded-xl bg-slate-200/70"
                            />
                        ))}
                    </div>
                ) : isError ? (
                    <div className="p-10 text-center">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                            <Svg className="h-7 w-7">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 8v5M12 16.5v.01" />
                            </Svg>
                        </span>
                        <h2 className="mt-5 text-lg font-semibold text-slate-900">
                            {apiMessage(error, "We couldn't load your orders")}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Check your connection and sign-in, then try again.
                        </p>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className={`${goldBtn} mt-6`}
                        >
                            Try again
                        </button>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-10 text-center">
                        <h2 className="text-lg font-semibold text-slate-900">
                            {hasFilters ? "No orders match" : "No orders yet"}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            {hasFilters
                                ? "Try a different search or status."
                                : "Orders for your products will appear here."}
                        </p>
                        {hasFilters && (
                            <button
                                type="button"
                                onClick={() => {
                                    reset({ search: "", status: "" });
                                    setPage(1);
                                }}
                                className={`${goldBtn} mt-6`}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                                <tr>
                                    <th scope="col" className="px-5 py-3">
                                        Product
                                    </th>
                                    <th scope="col" className="px-3 py-3">
                                        Order
                                    </th>
                                    <th scope="col" className="px-3 py-3">
                                        Customer
                                    </th>
                                    <th scope="col" className="px-3 py-3">
                                        Status
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-right"
                                    >
                                        Total
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-5 py-3 text-right"
                                    >
                                        Action
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {visible.map(({ item, order }) => {
                                    const next = NEXT_STEP[item.fulfillmentStatus];
                                    const awaitingPayment =
                                        order.paymentMethod === "online" &&
                                        !isPaid(order.paymentStatus);
                                    const busy = pendingItemId === item.id;
                                    const expanded = expandedId === item.id;
                                    const addr = order.shippingAddress ?? {};

                                    return (
                                        <Fragment key={item.id}>
                                            <tr className="align-top transition hover:bg-slate-50/70">
                                                <td className="px-5 py-3.5">
                                                    <p className="line-clamp-1 font-medium text-slate-900">
                                                        {item.productName}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {item.quantity} ×{" "}
                                                        {formatMoney(
                                                            item.unitPrice,
                                                            order.currency
                                                        )}
                                                    </p>
                                                </td>

                                                <td className="px-3 py-3.5">
                                                    <p className="font-semibold text-slate-900">
                                                        #{shortId(order.id)}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {formatDate(
                                                            order.createdAt
                                                        )}
                                                    </p>
                                                </td>

                                                <td className="px-3 py-3.5">
                                                    <p className="line-clamp-1 font-medium text-slate-900">
                                                        {addr.fullName ?? "—"}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {addr.city ?? ""}
                                                    </p>
                                                </td>

                                                <td className="px-3 py-3.5">
                                                    <Badge
                                                        status={
                                                            item.fulfillmentStatus
                                                        }
                                                    />
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {order.paymentMethod ===
                                                            "cod"
                                                            ? "Cash on delivery"
                                                            : isPaid(
                                                                order.paymentStatus
                                                            )
                                                                ? "Paid online"
                                                                : "Awaiting payment"}
                                                    </p>
                                                </td>

                                                <td className="px-3 py-3.5 text-right font-semibold text-slate-900">
                                                    {formatMoney(
                                                        item.lineTotal,
                                                        order.currency
                                                    )}
                                                </td>

                                                <td className="px-5 py-3.5">
                                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setExpandedId(
                                                                    expanded
                                                                        ? null
                                                                        : item.id
                                                                )
                                                            }
                                                            aria-expanded={
                                                                expanded
                                                            }
                                                            className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                                        >
                                                            {expanded
                                                                ? "Hide"
                                                                : "Details"}
                                                        </button>

                                                        {next && (
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    busy ||
                                                                    awaitingPayment
                                                                }
                                                                onClick={() =>
                                                                    runUpdate(
                                                                        item.id,
                                                                        next.status
                                                                    )
                                                                }
                                                                className="inline-flex h-9 items-center rounded-lg bg-slate-950 px-3.5 text-xs font-semibold text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                                                            >
                                                                {busy
                                                                    ? "Saving…"
                                                                    : next.label}
                                                            </button>
                                                        )}

                                                        {CAN_CANCEL.includes(
                                                            item.fulfillmentStatus
                                                        ) && (
                                                                <button
                                                                    type="button"
                                                                    disabled={busy}
                                                                    onClick={() =>
                                                                        setCancelId(
                                                                            cancelId ===
                                                                                item.id
                                                                                ? null
                                                                                : item.id
                                                                        )
                                                                    }
                                                                    className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            )}
                                                    </div>

                                                    {awaitingPayment &&
                                                        next && (
                                                            <p className="mt-1.5 text-right text-xs text-slate-500">
                                                                Waiting for
                                                                online payment
                                                            </p>
                                                        )}
                                                </td>
                                            </tr>

                                            {cancelId === item.id && (
                                                <tr className="bg-rose-50/60">
                                                    <td
                                                        colSpan={6}
                                                        className="px-5 py-3"
                                                    >
                                                        <div
                                                            role="alertdialog"
                                                            aria-label="Confirm cancellation"
                                                            className="flex flex-wrap items-center justify-between gap-3"
                                                        >
                                                            <p className="text-sm text-rose-800">
                                                                Cancel{" "}
                                                                <span className="font-semibold">
                                                                    {
                                                                        item.productName
                                                                    }
                                                                </span>{" "}
                                                                from order #
                                                                {shortId(
                                                                    order.id
                                                                )}
                                                                ? Stock goes
                                                                back to your
                                                                listing.
                                                            </p>

                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        busy
                                                                    }
                                                                    onClick={() =>
                                                                        runUpdate(
                                                                            item.id,
                                                                            "cancelled"
                                                                        )
                                                                    }
                                                                    className="inline-flex h-9 items-center rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:opacity-60"
                                                                >
                                                                    {busy
                                                                        ? "Cancelling…"
                                                                        : "Yes, cancel item"}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        busy
                                                                    }
                                                                    onClick={() =>
                                                                        setCancelId(
                                                                            null
                                                                        )
                                                                    }
                                                                    className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                                                >
                                                                    Keep item
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {expanded && (
                                                <tr className="bg-slate-50/70">
                                                    <td
                                                        colSpan={6}
                                                        className="px-5 py-4"
                                                    >
                                                        <div className="grid gap-4 text-sm sm:grid-cols-3">
                                                            <div>
                                                                <p className="text-xs font-semibold text-slate-900">
                                                                    Ship to
                                                                </p>
                                                                <address className="mt-1 not-italic leading-relaxed text-slate-600">
                                                                    {addr.fullName && (
                                                                        <span className="block font-medium text-slate-900">
                                                                            {
                                                                                addr.fullName
                                                                            }
                                                                        </span>
                                                                    )}
                                                                    {addr.addressLine1 && (
                                                                        <span className="block">
                                                                            {
                                                                                addr.addressLine1
                                                                            }
                                                                        </span>
                                                                    )}
                                                                    {addr.addressLine2 && (
                                                                        <span className="block">
                                                                            {
                                                                                addr.addressLine2
                                                                            }
                                                                        </span>
                                                                    )}
                                                                    <span className="block">
                                                                        {[
                                                                            addr.city,
                                                                            addr.state,
                                                                            addr.postalCode,
                                                                        ]
                                                                            .filter(
                                                                                Boolean
                                                                            )
                                                                            .join(
                                                                                ", "
                                                                            )}
                                                                    </span>
                                                                    {addr.country && (
                                                                        <span className="block">
                                                                            {
                                                                                addr.country
                                                                            }
                                                                        </span>
                                                                    )}
                                                                </address>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-semibold text-slate-900">
                                                                    Contact
                                                                </p>
                                                                <p className="mt-1 text-slate-600">
                                                                    {addr.phone ??
                                                                        "—"}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-semibold text-slate-900">
                                                                    Payment
                                                                </p>
                                                                <p className="mt-1 text-slate-600">
                                                                    {order.paymentMethod ===
                                                                        "cod"
                                                                        ? "Cash on delivery"
                                                                        : "Online"}{" "}
                                                                    ·{" "}
                                                                    {titleCase(
                                                                        order.paymentStatus
                                                                    )}
                                                                </p>
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    Order status:{" "}
                                                                    {titleCase(
                                                                        order.status
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* pagination */}
            {!isPending && !isError && totalPages > 1 && (
                <nav
                    aria-label="Pagination"
                    className="mt-8 flex flex-wrap items-center justify-center gap-2"
                >
                    <button
                        type="button"
                        onClick={() => setPage(safePage - 1)}
                        disabled={safePage <= 1}
                        aria-label="Previous page"
                        className={`${pageBtn} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                        <Svg className="h-4 w-4" strokeWidth={2}>
                            <path d="m15 6-6 6 6 6" />
                        </Svg>
                    </button>

                    {getPages(safePage, totalPages).map((p, i) =>
                        p === "…" ? (
                            <span
                                key={`dots-${i}`}
                                className="px-1 text-slate-500"
                                aria-hidden="true"
                            >
                                …
                            </span>
                        ) : (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPage(p)}
                                aria-current={p === safePage ? "page" : undefined}
                                className={`${pageBtn} ${p === safePage
                                        ? "bg-slate-950 text-amber-300 ring-slate-950"
                                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                                    }`}
                            >
                                {p}
                            </button>
                        )
                    )}

                    <button
                        type="button"
                        onClick={() => setPage(safePage + 1)}
                        disabled={safePage >= totalPages}
                        aria-label="Next page"
                        className={`${pageBtn} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                        <Svg className="h-4 w-4" strokeWidth={2}>
                            <path d="m9 6 6 6-6 6" />
                        </Svg>
                    </button>
                </nav>
            )}
        </div>
    );
}