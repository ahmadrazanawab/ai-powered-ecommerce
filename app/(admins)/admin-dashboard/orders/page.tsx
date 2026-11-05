"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
    useAdminOrder,
    useAdminOrderAction,
    useAdminOrders,
    type AdminNextStatus,
    type AdminOrderRow,
} from "@/app/hooks/use-admin-orders";
import type {
    FulfillmentStatus,
    OrderI,
    OrderStatus,
    PaymentStatus,
} from "@/app/hooks/use-orders";

/* ---------- config ---------- */
const PAGE_SIZE = 10;
const LOGIN_PATH = "/admin/login"; // change if your admin login lives elsewhere

interface FiltersForm {
    search: string;
    status: "" | OrderStatus;
    paymentStatus: "" | PaymentStatus;
}

const DEFAULT_FILTERS: FiltersForm = {
    search: "",
    status: "",
    paymentStatus: "",
};

const ORDER_STATUSES: OrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
];

const PAYMENT_STATUSES: PaymentStatus[] = [
    "pending",
    "processing",
    "paid",
    "succeeded",
    "failed",
    "refunded",
    "cancelled",
];

const ORDER_STYLE: Record<OrderStatus, string> = {
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    processing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    shipped: "bg-sky-50 text-sky-700 ring-sky-200",
    delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    processing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    succeeded: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    failed: "bg-rose-50 text-rose-700 ring-rose-200",
    refunded: "bg-slate-100 text-slate-700 ring-slate-300",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

const ITEM_STYLE: Record<FulfillmentStatus, string> = {
    pending: "text-amber-700",
    processing: "text-indigo-600",
    shipped: "text-sky-700",
    delivered: "text-emerald-700",
    cancelled: "text-rose-600",
};

/* next forward step for each order status (matches the backend) */
const NEXT_STEP: Partial<
    Record<OrderStatus, { status: AdminNextStatus; label: string }>
> = {
    pending: { status: "confirmed", label: "Confirm order" },
    confirmed: { status: "processing", label: "Start processing" },
    processing: { status: "shipped", label: "Mark as shipped" },
    shipped: { status: "delivered", label: "Mark as delivered" },
};

/* ---------- shared style helpers (same system as the storefront) ---------- */
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

function formatDate(value: string, withTime = false) {
    return new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
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

function Badge({ label, className }: { label: string; className: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {titleCase(label)}
        </span>
    );
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

/* ---------- detail drawer ---------- */
function OrderDrawer({
    orderId,
    onClose,
}: {
    orderId: string;
    onClose: () => void;
}) {
    const { data, isPending, isError, refetch } = useAdminOrder(orderId);
    const action = useAdminOrderAction();
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    const order: OrderI | undefined = data?.data;

    useEffect(() => {
        closeRef.current?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    // mirrors the backend rules in PATCH /orders/[orderId]
    const canCancel =
        !!order &&
        ["pending", "confirmed", "processing"].includes(order.status) &&
        order.items.length > 0 &&
        !order.items.some((i) =>
            ["shipped", "delivered"].includes(i.fulfillmentStatus)
        );

    const canCollectCod =
        !!order &&
        order.paymentMethod === "cod" &&
        order.status === "delivered" &&
        !["paid", "succeeded", "refunded"].includes(order.paymentStatus);

    const nextStep = order ? NEXT_STEP[order.status] : undefined;

    const awaitingPayment =
        !!order &&
        order.status === "pending" &&
        order.paymentMethod === "online" &&
        !["paid", "succeeded"].includes(order.paymentStatus);

    const run = (
        act: "cancel" | "collect_cod" | "update_status",
        status?: AdminNextStatus
    ) => {
        setNotice(null);
        action.mutate(
            { orderId, action: act, status },
            {
                onSuccess: (res) => {
                    setConfirmCancel(false);
                    setNotice(res?.message ?? "Order updated");
                    refetch();
                },
            }
        );
    };

    const addr = order?.shippingAddress ?? {};

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <button
                type="button"
                aria-label="Close order details"
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                tabIndex={-1}
            />

            <aside
                role="dialog"
                aria-modal="true"
                aria-label="Order details"
                className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
            >
                <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-5 text-white sm:px-6">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />

                    <div className="relative flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Order #{shortId(orderId)}
                            </h2>
                            {order && (
                                <p className="mt-0.5 text-xs text-slate-300">
                                    Placed {formatDate(order.createdAt, true)}
                                </p>
                            )}
                        </div>

                        <button
                            ref={closeRef}
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                            <Svg className="h-4 w-4" strokeWidth={2}>
                                <path d="M6 6l12 12M18 6 6 18" />
                            </Svg>
                        </button>
                    </div>

                    {order && (
                        <div className="relative mt-4 flex flex-wrap gap-2">
                            <Badge
                                label={order.status}
                                className={ORDER_STYLE[order.status]}
                            />
                            <Badge
                                label={`Payment ${order.paymentStatus}`}
                                className={PAYMENT_STYLE[order.paymentStatus]}
                            />
                        </div>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {isPending ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-14 animate-pulse rounded-xl bg-slate-200/70"
                                />
                            ))}
                        </div>
                    ) : isError || !order ? (
                        <div className="py-10 text-center">
                            <p className="text-sm font-semibold text-slate-900">
                                We couldn&apos;t load this order
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                                It may have been removed, or the connection
                                failed.
                            </p>
                            <button
                                type="button"
                                onClick={() => refetch()}
                                className={`${goldBtn} mt-5`}
                            >
                                Try again
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {notice && (
                                <p
                                    role="status"
                                    className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200"
                                >
                                    {notice}
                                </p>
                            )}

                            {/* items */}
                            <section>
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Products ({order.items.length})
                                </h3>

                                <ul className="mt-2 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200/70">
                                    {order.items.map((item) => (
                                        <li
                                            key={item.id}
                                            className="flex items-center justify-between gap-3 p-3.5"
                                        >
                                            <div className="min-w-0">
                                                <p className="line-clamp-1 text-sm font-medium text-slate-900">
                                                    {item.productName}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    {item.quantity} ×{" "}
                                                    {formatMoney(
                                                        item.unitPrice,
                                                        order.currency
                                                    )}
                                                    <span
                                                        className={`ml-2 font-medium ${ITEM_STYLE[item.fulfillmentStatus]}`}
                                                    >
                                                        {titleCase(
                                                            item.fulfillmentStatus
                                                        )}
                                                    </span>
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-slate-500">
                                                    Vendor {shortId(item.vendorId)}
                                                    {item.stockRestored &&
                                                        " · stock restored"}
                                                </p>
                                            </div>

                                            <p className="shrink-0 text-sm font-semibold text-slate-900">
                                                {formatMoney(
                                                    item.lineTotal,
                                                    order.currency
                                                )}
                                            </p>
                                        </li>
                                    ))}
                                </ul>

                                <p className="mt-2 flex justify-between px-1 text-sm font-semibold text-slate-900">
                                    <span>Total</span>
                                    <span>
                                        {formatMoney(
                                            order.subtotal,
                                            order.currency
                                        )}
                                    </span>
                                </p>
                            </section>

                            {/* payment */}
                            <section>
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Payment
                                </h3>
                                <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                                        <dt className="text-xs text-slate-500">
                                            Method
                                        </dt>
                                        <dd className="mt-0.5 font-medium text-slate-900">
                                            {order.paymentMethod === "cod"
                                                ? "Cash on delivery"
                                                : "Online"}
                                        </dd>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                                        <dt className="text-xs text-slate-500">
                                            Status
                                        </dt>
                                        <dd className="mt-0.5 font-medium text-slate-900">
                                            {titleCase(order.paymentStatus)}
                                        </dd>
                                    </div>
                                    {order.paymentIntentId && (
                                        <div className="col-span-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                                            <dt className="text-xs text-slate-500">
                                                Payment reference
                                            </dt>
                                            <dd className="mt-0.5 break-all font-medium text-slate-900">
                                                {order.paymentIntentId}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </section>

                            {/* address */}
                            <section>
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Shipping address
                                </h3>
                                <address className="mt-2 text-sm not-italic leading-relaxed text-slate-600">
                                    {addr.fullName && (
                                        <span className="block font-medium text-slate-900">
                                            {addr.fullName}
                                        </span>
                                    )}
                                    {addr.addressLine1 && (
                                        <span className="block">
                                            {addr.addressLine1}
                                        </span>
                                    )}
                                    {addr.addressLine2 && (
                                        <span className="block">
                                            {addr.addressLine2}
                                        </span>
                                    )}
                                    <span className="block">
                                        {[addr.city, addr.state, addr.postalCode]
                                            .filter(Boolean)
                                            .join(", ")}
                                    </span>
                                    {addr.country && (
                                        <span className="block">
                                            {addr.country}
                                        </span>
                                    )}
                                    {addr.phone && (
                                        <span className="mt-1 block">
                                            {addr.phone}
                                        </span>
                                    )}
                                </address>
                            </section>

                            {/* cancel confirmation */}
                            {confirmCancel && (
                                <div
                                    role="alertdialog"
                                    aria-label="Confirm cancellation"
                                    className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200"
                                >
                                    <p className="text-sm font-medium text-rose-800">
                                        Cancel order #{shortId(order.id)}?
                                    </p>
                                    <p className="mt-1 text-xs text-rose-700">
                                        All items are cancelled and returned to
                                        vendor stock. This can&apos;t be undone.
                                    </p>
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            type="button"
                                            disabled={action.isPending}
                                            onClick={() => run("cancel")}
                                            className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:opacity-60"
                                        >
                                            {action.isPending
                                                ? "Cancelling…"
                                                : "Cancel order"}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={action.isPending}
                                            onClick={() => {
                                                action.reset();
                                                setConfirmCancel(false);
                                            }}
                                            className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                        >
                                            Keep order
                                        </button>
                                    </div>
                                </div>
                            )}

                            {action.isError && (
                                <p
                                    role="alert"
                                    className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
                                >
                                    {apiMessage(
                                        action.error,
                                        "Could not update this order."
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {order && (canCancel || canCollectCod || nextStep) && (
                    <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
                        {canCancel && !confirmCancel && (
                            <button
                                type="button"
                                onClick={() => setConfirmCancel(true)}
                                className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            >
                                Cancel order
                            </button>
                        )}

                        {canCollectCod && (
                            <button
                                type="button"
                                disabled={action.isPending}
                                onClick={() => run("collect_cod")}
                                className={goldBtn}
                            >
                                {action.isPending
                                    ? "Saving…"
                                    : "Mark cash as collected"}
                            </button>
                        )}

                        {nextStep && (
                            <div className="flex flex-col items-end gap-1">
                                <button
                                    type="button"
                                    disabled={action.isPending || awaitingPayment}
                                    onClick={() =>
                                        run("update_status", nextStep.status)
                                    }
                                    className={goldBtn}
                                >
                                    {action.isPending
                                        ? "Saving…"
                                        : nextStep.label}
                                </button>
                                {awaitingPayment && (
                                    <p className="text-xs text-slate-500">
                                        Waiting for online payment
                                    </p>
                                )}
                            </div>
                        )}
                    </footer>
                )}
            </aside>
        </div>
    );
}

/* ---------- page ---------- */
export default function AdminOrdersPage() {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { register, watch, reset } = useForm<FiltersForm>({
        defaultValues: DEFAULT_FILTERS,
    });

    const search = watch("search");
    const status = watch("status");
    const paymentStatus = watch("paymentStatus");

    const { data, isPending, isError, error, isFetching, refetch } =
        useAdminOrders({ status, paymentStatus });

    useEffect(() => {
        const code = (error as { response?: { status?: number } } | null)
            ?.response?.status;
        if (code === 401) router.push(LOGIN_PATH);
    }, [error, router]);

    useEffect(() => {
        const sub = watch(() => setPage(1));
        return () => sub.unsubscribe();
    }, [watch]);

    const all: AdminOrderRow[] = useMemo(
        () => (Array.isArray(data?.data) ? data.data : []),
        [data]
    );

    // search runs on the loaded rows (the API returns the latest 100)
    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return all;

        return all.filter((o) => {
            const a = o.shippingAddress ?? {};
            return [o.id, a.fullName, a.phone, a.city, o.paymentIntentId]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q));
        });
    }, [all, search]);

    const stats = useMemo(() => {
        const open = all.filter((o) =>
            ["pending", "confirmed", "processing", "shipped"].includes(
                o.status
            )
        ).length;
        const codDue = all.filter(
            (o) =>
                o.paymentMethod === "cod" &&
                o.status === "delivered" &&
                !["paid", "succeeded", "refunded"].includes(o.paymentStatus)
        ).length;
        const revenue = all
            .filter(
                (o) =>
                    o.status !== "cancelled" &&
                    ["paid", "succeeded"].includes(o.paymentStatus)
            )
            .reduce((sum, o) => sum + Number(o.subtotal), 0);

        return { open, codDue, revenue };
    }, [all]);

    const hasFilters =
        search.trim() !== "" || status !== "" || paymentStatus !== "";

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const pageBtn =
        "grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* header */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                        Orders
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Review orders, cancel them before they ship, and record
                        cash collected on delivery.
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
                    { label: "Open orders", value: String(stats.open) },
                    {
                        label: "COD cash to collect",
                        value: String(stats.codDue),
                    },
                    {
                        label: "Paid revenue (loaded orders)",
                        value: formatMoney(stats.revenue, all[0]?.currency),
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
                <form
                    role="search"
                    onSubmit={(e) => e.preventDefault()}
                    className="grid gap-3 md:grid-cols-[1fr_12rem_12rem_auto]"
                >
                    <div className="relative">
                        <label htmlFor="order-search" className="sr-only">
                            Search orders
                        </label>
                        <Svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                        </Svg>
                        <input
                            id="order-search"
                            type="search"
                            autoComplete="off"
                            placeholder="Order ID, customer, phone, city…"
                            className={`${fieldCls} pl-11 pr-4`}
                            {...register("search")}
                        />
                    </div>

                    <div>
                        <label htmlFor="order-status" className="sr-only">
                            Order status
                        </label>
                        <select
                            id="order-status"
                            className={`${fieldCls} cursor-pointer px-3`}
                            {...register("status")}
                        >
                            <option value="">All order statuses</option>
                            {ORDER_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {titleCase(s)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="payment-status" className="sr-only">
                            Payment status
                        </label>
                        <select
                            id="payment-status"
                            className={`${fieldCls} cursor-pointer px-3`}
                            {...register("paymentStatus")}
                        >
                            <option value="">All payments</option>
                            {PAYMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {titleCase(s)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {hasFilters && (
                        <button
                            type="button"
                            onClick={() => {
                                reset(DEFAULT_FILTERS);
                                setPage(1);
                            }}
                            className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                            Clear filters
                        </button>
                    )}
                </form>
            </div>

            {/* table */}
            <div
                className={`${cardCls} mt-6 overflow-hidden transition-opacity duration-200 ${isFetching && !isPending ? "opacity-60" : "opacity-100"
                    }`}
            >
                {isPending ? (
                    <div className="space-y-3 p-5">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-12 animate-pulse rounded-xl bg-slate-200/70"
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
                            We couldn&apos;t load orders
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
                                ? "Try a different search or clear the filters."
                                : "Orders will appear here once customers check out."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                                <tr>
                                    <th scope="col" className="px-5 py-3">
                                        Order
                                    </th>
                                    <th scope="col" className="px-3 py-3">
                                        Customer
                                    </th>
                                    <th scope="col" className="px-3 py-3">
                                        Status
                                    </th>
                                    <th scope="col" className="px-3 py-3">
                                        Payment
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-right"
                                    >
                                        Total
                                    </th>
                                    <th scope="col" className="px-5 py-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {visible.map((o) => (
                                    <tr
                                        key={o.id}
                                        className="transition hover:bg-slate-50/70"
                                    >
                                        <td className="px-5 py-3.5">
                                            <p className="font-semibold text-slate-900">
                                                #{shortId(o.id)}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {formatDate(o.createdAt)}
                                            </p>
                                        </td>

                                        <td className="px-3 py-3.5">
                                            <p className="line-clamp-1 font-medium text-slate-900">
                                                {o.shippingAddress?.fullName ??
                                                    "—"}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {[
                                                    o.shippingAddress?.city,
                                                    o.shippingAddress?.phone,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </p>
                                        </td>

                                        <td className="px-3 py-3.5">
                                            <Badge
                                                label={o.status}
                                                className={ORDER_STYLE[o.status]}
                                            />
                                        </td>

                                        <td className="px-3 py-3.5">
                                            <Badge
                                                label={o.paymentStatus}
                                                className={
                                                    PAYMENT_STYLE[o.paymentStatus]
                                                }
                                            />
                                            <p className="mt-1 text-xs text-slate-500">
                                                {o.paymentMethod === "cod"
                                                    ? "Cash on delivery"
                                                    : "Online"}
                                            </p>
                                        </td>

                                        <td className="px-3 py-3.5 text-right font-semibold text-slate-900">
                                            {formatMoney(o.subtotal, o.currency)}
                                        </td>

                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedId(o.id)}
                                                aria-label={`Manage order ${shortId(o.id)}`}
                                                className="inline-flex h-9 items-center rounded-lg bg-slate-950 px-3.5 text-xs font-semibold text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                                            >
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))}
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

            {selectedId && (
                <OrderDrawer
                    orderId={selectedId}
                    onClose={() => setSelectedId(null)}
                />
            )}
        </div>
    );
}


// "use client";

// import {
//     useEffect,
//     useMemo,
//     useRef,
//     useState,
//     type ReactNode,
// } from "react";
// import { useRouter } from "next/navigation";
// import { useForm } from "react-hook-form";
// import {
//     useAdminOrder,
//     useAdminOrderAction,
//     useAdminOrders,
//     type AdminOrderRow,
// } from "@/app/hooks/use-admin-orders";
// import type {
//     FulfillmentStatus,
//     OrderI,
//     OrderStatus,
//     PaymentStatus,
// } from "@/app/hooks/use-orders";

// /* ---------- config ---------- */
// const PAGE_SIZE = 10;
// const LOGIN_PATH = "/admin/login"; // change if your admin login lives elsewhere

// interface FiltersForm {
//     search: string;
//     status: "" | OrderStatus;
//     paymentStatus: "" | PaymentStatus;
// }

// const DEFAULT_FILTERS: FiltersForm = {
//     search: "",
//     status: "",
//     paymentStatus: "",
// };

// const ORDER_STATUSES: OrderStatus[] = [
//     "pending",
//     "confirmed",
//     "processing",
//     "shipped",
//     "delivered",
//     "cancelled",
// ];

// const PAYMENT_STATUSES: PaymentStatus[] = [
//     "pending",
//     "processing",
//     "paid",
//     "succeeded",
//     "failed",
//     "refunded",
//     "cancelled",
// ];

// const ORDER_STYLE: Record<OrderStatus, string> = {
//     pending: "bg-amber-50 text-amber-800 ring-amber-200",
//     confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
//     processing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
//     shipped: "bg-sky-50 text-sky-700 ring-sky-200",
//     delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
//     cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
// };

// const PAYMENT_STYLE: Record<PaymentStatus, string> = {
//     pending: "bg-amber-50 text-amber-800 ring-amber-200",
//     processing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
//     paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
//     succeeded: "bg-emerald-50 text-emerald-700 ring-emerald-200",
//     failed: "bg-rose-50 text-rose-700 ring-rose-200",
//     refunded: "bg-slate-100 text-slate-700 ring-slate-300",
//     cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
// };

// const ITEM_STYLE: Record<FulfillmentStatus, string> = {
//     pending: "text-amber-700",
//     processing: "text-indigo-600",
//     shipped: "text-sky-700",
//     delivered: "text-emerald-700",
//     cancelled: "text-rose-600",
// };

// /* ---------- shared style helpers (same system as the storefront) ---------- */
// const cardCls =
//     "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

// const goldBtn =
//     "inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:opacity-60";

// const fieldCls =
//     "h-11 w-full rounded-xl bg-white text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-amber-400/70";

// const Svg = ({
//     children,
//     className = "h-5 w-5",
//     strokeWidth = 1.7,
// }: {
//     children: ReactNode;
//     className?: string;
//     strokeWidth?: number;
// }) => (
//     <svg
//         xmlns="http://www.w3.org/2000/svg"
//         viewBox="0 0 24 24"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth={strokeWidth}
//         strokeLinecap="round"
//         strokeLinejoin="round"
//         className={className}
//         aria-hidden="true"
//     >
//         {children}
//     </svg>
// );

// /* ---------- helpers ---------- */
// function formatMoney(value: string | number, currency = "inr") {
//     const n = Number(value);
//     const safe = Number.isNaN(n) ? 0 : n;

//     try {
//         return new Intl.NumberFormat("en-IN", {
//             style: "currency",
//             currency: currency.toUpperCase(),
//         }).format(safe);
//     } catch {
//         return safe.toFixed(2);
//     }
// }

// function formatDate(value: string, withTime = false) {
//     return new Date(value).toLocaleString("en-IN", {
//         day: "numeric",
//         month: "short",
//         year: "numeric",
//         ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
//     });
// }

// const shortId = (id: string) => id.slice(0, 8).toUpperCase();
// const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// function apiMessage(err: unknown, fallback: string) {
//     return (
//         (err as { response?: { data?: { message?: string } } })?.response?.data
//             ?.message ?? fallback
//     );
// }

// function Badge({ label, className }: { label: string; className: string }) {
//     return (
//         <span
//             className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}
//         >
//             <span className="h-1.5 w-1.5 rounded-full bg-current" />
//             {titleCase(label)}
//         </span>
//     );
// }

// function getPages(current: number, total: number): (number | "…")[] {
//     if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

//     const set = new Set([1, total, current - 1, current, current + 1]);
//     const sorted = Array.from(set)
//         .filter((p) => p >= 1 && p <= total)
//         .sort((a, b) => a - b);

//     const out: (number | "…")[] = [];
//     let prev = 0;
//     for (const p of sorted) {
//         if (p - prev > 1) out.push("…");
//         out.push(p);
//         prev = p;
//     }
//     return out;
// }

// /* ---------- detail drawer ---------- */
// function OrderDrawer({
//     orderId,
//     onClose,
// }: {
//     orderId: string;
//     onClose: () => void;
// }) {
//     const { data, isPending, isError, refetch } = useAdminOrder(orderId);
//     const action = useAdminOrderAction();
//     const [confirmCancel, setConfirmCancel] = useState(false);
//     const [notice, setNotice] = useState<string | null>(null);
//     const closeRef = useRef<HTMLButtonElement>(null);

//     const order: OrderI | undefined = data?.data;

//     useEffect(() => {
//         closeRef.current?.focus();

//         const onKey = (e: KeyboardEvent) => {
//             if (e.key === "Escape") onClose();
//         };
//         document.addEventListener("keydown", onKey);
//         return () => document.removeEventListener("keydown", onKey);
//     }, [onClose]);

//     // mirrors the backend rules in PATCH /orders/[orderId]
//     const canCancel =
//         !!order &&
//         ["pending", "confirmed", "processing"].includes(order.status) &&
//         order.items.length > 0 &&
//         !order.items.some((i) =>
//             ["shipped", "delivered"].includes(i.fulfillmentStatus)
//         );

//     const canCollectCod =
//         !!order &&
//         order.paymentMethod === "cod" &&
//         order.status === "delivered" &&
//         !["paid", "succeeded", "refunded"].includes(order.paymentStatus);

//     const run = (act: "cancel" | "collect_cod") => {
//         setNotice(null);
//         action.mutate(
//             { orderId, action: act },
//             {
//                 onSuccess: (res) => {
//                     setConfirmCancel(false);
//                     setNotice(res?.message ?? "Order updated");
//                     refetch();
//                 },
//             }
//         );
//     };

//     const addr = order?.shippingAddress ?? {};

//     return (
//         <div className="fixed inset-0 z-50 flex justify-end">
//             <button
//                 type="button"
//                 aria-label="Close order details"
//                 onClick={onClose}
//                 className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
//                 tabIndex={-1}
//             />

//             <aside
//                 role="dialog"
//                 aria-modal="true"
//                 aria-label="Order details"
//                 className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
//             >
//                 <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-5 text-white sm:px-6">
//                     <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />

//                     <div className="relative flex items-start justify-between gap-3">
//                         <div>
//                             <h2 className="text-lg font-semibold">
//                                 Order #{shortId(orderId)}
//                             </h2>
//                             {order && (
//                                 <p className="mt-0.5 text-xs text-slate-300">
//                                     Placed {formatDate(order.createdAt, true)}
//                                 </p>
//                             )}
//                         </div>

//                         <button
//                             ref={closeRef}
//                             type="button"
//                             onClick={onClose}
//                             aria-label="Close"
//                             className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
//                         >
//                             <Svg className="h-4 w-4" strokeWidth={2}>
//                                 <path d="M6 6l12 12M18 6 6 18" />
//                             </Svg>
//                         </button>
//                     </div>

//                     {order && (
//                         <div className="relative mt-4 flex flex-wrap gap-2">
//                             <Badge
//                                 label={order.status}
//                                 className={ORDER_STYLE[order.status]}
//                             />
//                             <Badge
//                                 label={`Payment ${order.paymentStatus}`}
//                                 className={PAYMENT_STYLE[order.paymentStatus]}
//                             />
//                         </div>
//                     )}
//                 </header>

//                 <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
//                     {isPending ? (
//                         <div className="space-y-3">
//                             {Array.from({ length: 4 }).map((_, i) => (
//                                 <div
//                                     key={i}
//                                     className="h-14 animate-pulse rounded-xl bg-slate-200/70"
//                                 />
//                             ))}
//                         </div>
//                     ) : isError || !order ? (
//                         <div className="py-10 text-center">
//                             <p className="text-sm font-semibold text-slate-900">
//                                 We couldn&apos;t load this order
//                             </p>
//                             <p className="mt-1 text-sm text-slate-600">
//                                 It may have been removed, or the connection
//                                 failed.
//                             </p>
//                             <button
//                                 type="button"
//                                 onClick={() => refetch()}
//                                 className={`${goldBtn} mt-5`}
//                             >
//                                 Try again
//                             </button>
//                         </div>
//                     ) : (
//                         <div className="space-y-6">
//                             {notice && (
//                                 <p
//                                     role="status"
//                                     className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200"
//                                 >
//                                     {notice}
//                                 </p>
//                             )}

//                             {/* items */}
//                             <section>
//                                 <h3 className="text-sm font-semibold text-slate-900">
//                                     Products ({order.items.length})
//                                 </h3>

//                                 <ul className="mt-2 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200/70">
//                                     {order.items.map((item) => (
//                                         <li
//                                             key={item.id}
//                                             className="flex items-center justify-between gap-3 p-3.5"
//                                         >
//                                             <div className="min-w-0">
//                                                 <p className="line-clamp-1 text-sm font-medium text-slate-900">
//                                                     {item.productName}
//                                                 </p>
//                                                 <p className="mt-0.5 text-xs text-slate-500">
//                                                     {item.quantity} ×{" "}
//                                                     {formatMoney(
//                                                         item.unitPrice,
//                                                         order.currency
//                                                     )}
//                                                     <span
//                                                         className={`ml-2 font-medium ${ITEM_STYLE[item.fulfillmentStatus]}`}
//                                                     >
//                                                         {titleCase(
//                                                             item.fulfillmentStatus
//                                                         )}
//                                                     </span>
//                                                 </p>
//                                                 <p className="mt-0.5 text-[11px] text-slate-500">
//                                                     Vendor {shortId(item.vendorId)}
//                                                     {item.stockRestored &&
//                                                         " · stock restored"}
//                                                 </p>
//                                             </div>

//                                             <p className="shrink-0 text-sm font-semibold text-slate-900">
//                                                 {formatMoney(
//                                                     item.lineTotal,
//                                                     order.currency
//                                                 )}
//                                             </p>
//                                         </li>
//                                     ))}
//                                 </ul>

//                                 <p className="mt-2 flex justify-between px-1 text-sm font-semibold text-slate-900">
//                                     <span>Total</span>
//                                     <span>
//                                         {formatMoney(
//                                             order.subtotal,
//                                             order.currency
//                                         )}
//                                     </span>
//                                 </p>
//                             </section>

//                             {/* payment */}
//                             <section>
//                                 <h3 className="text-sm font-semibold text-slate-900">
//                                     Payment
//                                 </h3>
//                                 <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
//                                     <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
//                                         <dt className="text-xs text-slate-500">
//                                             Method
//                                         </dt>
//                                         <dd className="mt-0.5 font-medium text-slate-900">
//                                             {order.paymentMethod === "cod"
//                                                 ? "Cash on delivery"
//                                                 : "Online"}
//                                         </dd>
//                                     </div>
//                                     <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
//                                         <dt className="text-xs text-slate-500">
//                                             Status
//                                         </dt>
//                                         <dd className="mt-0.5 font-medium text-slate-900">
//                                             {titleCase(order.paymentStatus)}
//                                         </dd>
//                                     </div>
//                                     {order.paymentIntentId && (
//                                         <div className="col-span-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
//                                             <dt className="text-xs text-slate-500">
//                                                 Payment reference
//                                             </dt>
//                                             <dd className="mt-0.5 break-all font-medium text-slate-900">
//                                                 {order.paymentIntentId}
//                                             </dd>
//                                         </div>
//                                     )}
//                                 </dl>
//                             </section>

//                             {/* address */}
//                             <section>
//                                 <h3 className="text-sm font-semibold text-slate-900">
//                                     Shipping address
//                                 </h3>
//                                 <address className="mt-2 text-sm not-italic leading-relaxed text-slate-600">
//                                     {addr.fullName && (
//                                         <span className="block font-medium text-slate-900">
//                                             {addr.fullName}
//                                         </span>
//                                     )}
//                                     {addr.addressLine1 && (
//                                         <span className="block">
//                                             {addr.addressLine1}
//                                         </span>
//                                     )}
//                                     {addr.addressLine2 && (
//                                         <span className="block">
//                                             {addr.addressLine2}
//                                         </span>
//                                     )}
//                                     <span className="block">
//                                         {[addr.city, addr.state, addr.postalCode]
//                                             .filter(Boolean)
//                                             .join(", ")}
//                                     </span>
//                                     {addr.country && (
//                                         <span className="block">
//                                             {addr.country}
//                                         </span>
//                                     )}
//                                     {addr.phone && (
//                                         <span className="mt-1 block">
//                                             {addr.phone}
//                                         </span>
//                                     )}
//                                 </address>
//                             </section>

//                             {/* cancel confirmation */}
//                             {confirmCancel && (
//                                 <div
//                                     role="alertdialog"
//                                     aria-label="Confirm cancellation"
//                                     className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200"
//                                 >
//                                     <p className="text-sm font-medium text-rose-800">
//                                         Cancel order #{shortId(order.id)}?
//                                     </p>
//                                     <p className="mt-1 text-xs text-rose-700">
//                                         All items are cancelled and returned to
//                                         vendor stock. This can&apos;t be undone.
//                                     </p>
//                                     <div className="mt-3 flex gap-2">
//                                         <button
//                                             type="button"
//                                             disabled={action.isPending}
//                                             onClick={() => run("cancel")}
//                                             className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:opacity-60"
//                                         >
//                                             {action.isPending
//                                                 ? "Cancelling…"
//                                                 : "Cancel order"}
//                                         </button>
//                                         <button
//                                             type="button"
//                                             disabled={action.isPending}
//                                             onClick={() => {
//                                                 action.reset();
//                                                 setConfirmCancel(false);
//                                             }}
//                                             className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
//                                         >
//                                             Keep order
//                                         </button>
//                                     </div>
//                                 </div>
//                             )}

//                             {action.isError && (
//                                 <p
//                                     role="alert"
//                                     className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
//                                 >
//                                     {apiMessage(
//                                         action.error,
//                                         "Could not update this order."
//                                     )}
//                                 </p>
//                             )}
//                         </div>
//                     )}
//                 </div>

//                 {order && (canCancel || canCollectCod) && (
//                     <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
//                         {canCancel && !confirmCancel && (
//                             <button
//                                 type="button"
//                                 onClick={() => setConfirmCancel(true)}
//                                 className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
//                             >
//                                 Cancel order
//                             </button>
//                         )}

//                         {canCollectCod && (
//                             <button
//                                 type="button"
//                                 disabled={action.isPending}
//                                 onClick={() => run("collect_cod")}
//                                 className={goldBtn}
//                             >
//                                 {action.isPending
//                                     ? "Saving…"
//                                     : "Mark cash as collected"}
//                             </button>
//                         )}
//                     </footer>
//                 )}
//             </aside>
//         </div>
//     );
// }

// /* ---------- page ---------- */
// export default function AdminOrdersPage() {
//     const router = useRouter();
//     const [page, setPage] = useState(1);
//     const [selectedId, setSelectedId] = useState<string | null>(null);

//     const { register, watch, reset } = useForm<FiltersForm>({
//         defaultValues: DEFAULT_FILTERS,
//     });

//     const search = watch("search");
//     const status = watch("status");
//     const paymentStatus = watch("paymentStatus");

//     const { data, isPending, isError, error, isFetching, refetch } =
//         useAdminOrders({ status, paymentStatus });

//     useEffect(() => {
//         const code = (error as { response?: { status?: number } } | null)
//             ?.response?.status;
//         if (code === 401) router.push(LOGIN_PATH);
//     }, [error, router]);

//     useEffect(() => {
//         const sub = watch(() => setPage(1));
//         return () => sub.unsubscribe();
//     }, [watch]);

//     const all: AdminOrderRow[] = useMemo(
//         () => (Array.isArray(data?.data) ? data.data : []),
//         [data]
//     );

//     // search runs on the loaded rows (the API returns the latest 100)
//     const rows = useMemo(() => {
//         const q = search.trim().toLowerCase();
//         if (!q) return all;

//         return all.filter((o) => {
//             const a = o.shippingAddress ?? {};
//             return [o.id, a.fullName, a.phone, a.city, o.paymentIntentId]
//                 .filter(Boolean)
//                 .some((v) => String(v).toLowerCase().includes(q));
//         });
//     }, [all, search]);

//     const stats = useMemo(() => {
//         const open = all.filter((o) =>
//             ["pending", "confirmed", "processing", "shipped"].includes(
//                 o.status
//             )
//         ).length;
//         const codDue = all.filter(
//             (o) =>
//                 o.paymentMethod === "cod" &&
//                 o.status === "delivered" &&
//                 !["paid", "succeeded", "refunded"].includes(o.paymentStatus)
//         ).length;
//         const revenue = all
//             .filter(
//                 (o) =>
//                     o.status !== "cancelled" &&
//                     ["paid", "succeeded"].includes(o.paymentStatus)
//             )
//             .reduce((sum, o) => sum + Number(o.subtotal), 0);

//         return { open, codDue, revenue };
//     }, [all]);

//     const hasFilters =
//         search.trim() !== "" || status !== "" || paymentStatus !== "";

//     const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
//     const safePage = Math.min(page, totalPages);
//     const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

//     const pageBtn =
//         "grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";

//     return (
//         <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
//             {/* header */}
//             <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
//                 <div>
//                     <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
//                         Orders
//                     </h1>
//                     <p className="mt-1 text-sm text-slate-600">
//                         Review orders, cancel them before they ship, and record
//                         cash collected on delivery.
//                     </p>
//                 </div>

//                 <button
//                     type="button"
//                     onClick={() => refetch()}
//                     disabled={isFetching}
//                     className="mt-3 inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60 sm:mt-0"
//                 >
//                     <Svg
//                         className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
//                         strokeWidth={2}
//                     >
//                         <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
//                     </Svg>
//                     Refresh
//                 </button>
//             </div>

//             {/* stats */}
//             <dl className="mt-6 grid gap-3 sm:grid-cols-3">
//                 {[
//                     { label: "Open orders", value: String(stats.open) },
//                     {
//                         label: "COD cash to collect",
//                         value: String(stats.codDue),
//                     },
//                     {
//                         label: "Paid revenue (loaded orders)",
//                         value: formatMoney(stats.revenue, all[0]?.currency),
//                     },
//                 ].map((s) => (
//                     <div
//                         key={s.label}
//                         className="rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950 p-4 text-white ring-1 ring-slate-900"
//                     >
//                         <dt className="text-xs text-slate-300">{s.label}</dt>
//                         <dd className="mt-1 text-2xl font-semibold tracking-tight text-amber-300">
//                             {isPending ? "…" : s.value}
//                         </dd>
//                     </div>
//                 ))}
//             </dl>

//             {/* filters */}
//             <div className={`${cardCls} mt-6 p-4 sm:p-5`}>
//                 <form
//                     role="search"
//                     onSubmit={(e) => e.preventDefault()}
//                     className="grid gap-3 md:grid-cols-[1fr_12rem_12rem_auto]"
//                 >
//                     <div className="relative">
//                         <label htmlFor="order-search" className="sr-only">
//                             Search orders
//                         </label>
//                         <Svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500">
//                             <circle cx="11" cy="11" r="7" />
//                             <path d="m20 20-3.5-3.5" />
//                         </Svg>
//                         <input
//                             id="order-search"
//                             type="search"
//                             autoComplete="off"
//                             placeholder="Order ID, customer, phone, city…"
//                             className={`${fieldCls} pl-11 pr-4`}
//                             {...register("search")}
//                         />
//                     </div>

//                     <div>
//                         <label htmlFor="order-status" className="sr-only">
//                             Order status
//                         </label>
//                         <select
//                             id="order-status"
//                             className={`${fieldCls} cursor-pointer px-3`}
//                             {...register("status")}
//                         >
//                             <option value="">All order statuses</option>
//                             {ORDER_STATUSES.map((s) => (
//                                 <option key={s} value={s}>
//                                     {titleCase(s)}
//                                 </option>
//                             ))}
//                         </select>
//                     </div>

//                     <div>
//                         <label htmlFor="payment-status" className="sr-only">
//                             Payment status
//                         </label>
//                         <select
//                             id="payment-status"
//                             className={`${fieldCls} cursor-pointer px-3`}
//                             {...register("paymentStatus")}
//                         >
//                             <option value="">All payments</option>
//                             {PAYMENT_STATUSES.map((s) => (
//                                 <option key={s} value={s}>
//                                     {titleCase(s)}
//                                 </option>
//                             ))}
//                         </select>
//                     </div>

//                     {hasFilters && (
//                         <button
//                             type="button"
//                             onClick={() => {
//                                 reset(DEFAULT_FILTERS);
//                                 setPage(1);
//                             }}
//                             className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
//                         >
//                             Clear filters
//                         </button>
//                     )}
//                 </form>
//             </div>

//             {/* table */}
//             <div
//                 className={`${cardCls} mt-6 overflow-hidden transition-opacity duration-200 ${isFetching && !isPending ? "opacity-60" : "opacity-100"
//                     }`}
//             >
//                 {isPending ? (
//                     <div className="space-y-3 p-5">
//                         {Array.from({ length: 6 }).map((_, i) => (
//                             <div
//                                 key={i}
//                                 className="h-12 animate-pulse rounded-xl bg-slate-200/70"
//                             />
//                         ))}
//                     </div>
//                 ) : isError ? (
//                     <div className="p-10 text-center">
//                         <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
//                             <Svg className="h-7 w-7">
//                                 <circle cx="12" cy="12" r="9" />
//                                 <path d="M12 8v5M12 16.5v.01" />
//                             </Svg>
//                         </span>
//                         <h2 className="mt-5 text-lg font-semibold text-slate-900">
//                             We couldn&apos;t load orders
//                         </h2>
//                         <p className="mt-2 text-sm text-slate-600">
//                             Check your connection and sign-in, then try again.
//                         </p>
//                         <button
//                             type="button"
//                             onClick={() => refetch()}
//                             className={`${goldBtn} mt-6`}
//                         >
//                             Try again
//                         </button>
//                     </div>
//                 ) : rows.length === 0 ? (
//                     <div className="p-10 text-center">
//                         <h2 className="text-lg font-semibold text-slate-900">
//                             {hasFilters ? "No orders match" : "No orders yet"}
//                         </h2>
//                         <p className="mt-2 text-sm text-slate-600">
//                             {hasFilters
//                                 ? "Try a different search or clear the filters."
//                                 : "Orders will appear here once customers check out."}
//                         </p>
//                     </div>
//                 ) : (
//                     <div className="overflow-x-auto">
//                         <table className="w-full min-w-[820px] text-left text-sm">
//                             <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
//                                 <tr>
//                                     <th scope="col" className="px-5 py-3">
//                                         Order
//                                     </th>
//                                     <th scope="col" className="px-3 py-3">
//                                         Customer
//                                     </th>
//                                     <th scope="col" className="px-3 py-3">
//                                         Status
//                                     </th>
//                                     <th scope="col" className="px-3 py-3">
//                                         Payment
//                                     </th>
//                                     <th
//                                         scope="col"
//                                         className="px-3 py-3 text-right"
//                                     >
//                                         Total
//                                     </th>
//                                     <th scope="col" className="px-5 py-3">
//                                         <span className="sr-only">Actions</span>
//                                     </th>
//                                 </tr>
//                             </thead>

//                             <tbody className="divide-y divide-slate-100">
//                                 {visible.map((o) => (
//                                     <tr
//                                         key={o.id}
//                                         className="transition hover:bg-slate-50/70"
//                                     >
//                                         <td className="px-5 py-3.5">
//                                             <p className="font-semibold text-slate-900">
//                                                 #{shortId(o.id)}
//                                             </p>
//                                             <p className="text-xs text-slate-500">
//                                                 {formatDate(o.createdAt)}
//                                             </p>
//                                         </td>

//                                         <td className="px-3 py-3.5">
//                                             <p className="line-clamp-1 font-medium text-slate-900">
//                                                 {o.shippingAddress?.fullName ??
//                                                     "—"}
//                                             </p>
//                                             <p className="text-xs text-slate-500">
//                                                 {[
//                                                     o.shippingAddress?.city,
//                                                     o.shippingAddress?.phone,
//                                                 ]
//                                                     .filter(Boolean)
//                                                     .join(" · ")}
//                                             </p>
//                                         </td>

//                                         <td className="px-3 py-3.5">
//                                             <Badge
//                                                 label={o.status}
//                                                 className={ORDER_STYLE[o.status]}
//                                             />
//                                         </td>

//                                         <td className="px-3 py-3.5">
//                                             <Badge
//                                                 label={o.paymentStatus}
//                                                 className={
//                                                     PAYMENT_STYLE[o.paymentStatus]
//                                                 }
//                                             />
//                                             <p className="mt-1 text-xs text-slate-500">
//                                                 {o.paymentMethod === "cod"
//                                                     ? "Cash on delivery"
//                                                     : "Online"}
//                                             </p>
//                                         </td>

//                                         <td className="px-3 py-3.5 text-right font-semibold text-slate-900">
//                                             {formatMoney(o.subtotal, o.currency)}
//                                         </td>

//                                         <td className="px-5 py-3.5 text-right">
//                                             <button
//                                                 type="button"
//                                                 onClick={() => setSelectedId(o.id)}
//                                                 aria-label={`Manage order ${shortId(o.id)}`}
//                                                 className="inline-flex h-9 items-center rounded-lg bg-slate-950 px-3.5 text-xs font-semibold text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
//                                             >
//                                                 Manage
//                                             </button>
//                                         </td>
//                                     </tr>
//                                 ))}
//                             </tbody>
//                         </table>
//                     </div>
//                 )}
//             </div>

//             {/* pagination */}
//             {!isPending && !isError && totalPages > 1 && (
//                 <nav
//                     aria-label="Pagination"
//                     className="mt-8 flex flex-wrap items-center justify-center gap-2"
//                 >
//                     <button
//                         type="button"
//                         onClick={() => setPage(safePage - 1)}
//                         disabled={safePage <= 1}
//                         aria-label="Previous page"
//                         className={`${pageBtn} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
//                     >
//                         <Svg className="h-4 w-4" strokeWidth={2}>
//                             <path d="m15 6-6 6 6 6" />
//                         </Svg>
//                     </button>

//                     {getPages(safePage, totalPages).map((p, i) =>
//                         p === "…" ? (
//                             <span
//                                 key={`dots-${i}`}
//                                 className="px-1 text-slate-500"
//                                 aria-hidden="true"
//                             >
//                                 …
//                             </span>
//                         ) : (
//                             <button
//                                 key={p}
//                                 type="button"
//                                 onClick={() => setPage(p)}
//                                 aria-current={p === safePage ? "page" : undefined}
//                                 className={`${pageBtn} ${p === safePage
//                                     ? "bg-slate-950 text-amber-300 ring-slate-950"
//                                     : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
//                                     }`}
//                             >
//                                 {p}
//                             </button>
//                         )
//                     )}

//                     <button
//                         type="button"
//                         onClick={() => setPage(safePage + 1)}
//                         disabled={safePage >= totalPages}
//                         aria-label="Next page"
//                         className={`${pageBtn} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
//                     >
//                         <Svg className="h-4 w-4" strokeWidth={2}>
//                             <path d="m9 6 6 6-6 6" />
//                         </Svg>
//                     </button>
//                 </nav>
//             )}

//             {selectedId && (
//                 <OrderDrawer
//                     orderId={selectedId}
//                     onClose={() => setSelectedId(null)}
//                 />
//             )}
//         </div>
//     );
// }