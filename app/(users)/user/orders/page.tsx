"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
    useCancelOrder,
    useOrders,
    type FulfillmentStatus,
    type OrderI,
    type OrderStatus,
} from "@/app/hooks/use-orders";

/* ---------- config ---------- */
const PAGE_SIZE = 6;

/* ---------- types ---------- */
interface FiltersForm {
    status: "" | OrderStatus;
}

const STATUS_FILTERS: { value: "" | OrderStatus; label: string }[] = [
    { value: "", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
];

const STATUS_STYLE: Record<OrderStatus, string> = {
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    processing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    shipped: "bg-sky-50 text-sky-700 ring-sky-200",
    delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

const ITEM_STATUS_STYLE: Record<FulfillmentStatus, string> = {
    pending: "text-amber-700",
    processing: "text-indigo-600",
    shipped: "text-sky-700",
    delivered: "text-emerald-700",
    cancelled: "text-rose-600",
};

const PAYMENT_LABEL: Record<string, string> = {
    pending: "Payment pending",
    processing: "Payment processing",
    paid: "Paid",
    succeeded: "Paid",
    failed: "Payment failed",
    refunded: "Refunded",
    cancelled: "Payment cancelled",
};

const STEPS: OrderStatus[] = [
    "confirmed",
    "processing",
    "shipped",
    "delivered",
];

const TONES = [
    "from-slate-900 to-indigo-900",
    "from-indigo-950 to-slate-800",
    "from-slate-800 to-slate-950",
    "from-amber-900 to-slate-900",
];

/* ---------- shared style helpers (same as shop page) ---------- */
const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

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

const GemIcon = ({ className }: { className?: string }) => (
    <Svg className={className} strokeWidth={1.5}>
        <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
        <path d="M3 9h18M9 4l3 5 3-5M12 9v11" />
    </Svg>
);

const GridTexture = ({ opacity = "opacity-[0.07]" }: { opacity?: string }) => (
    <div
        className={`pointer-events-none absolute inset-0 ${opacity}`}
        style={{
            backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
        }}
    />
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

function toneFor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash + id.charCodeAt(i)) % 997;
    }
    return TONES[hash % TONES.length];
}

function shortId(id: string) {
    return id.slice(0, 8).toUpperCase();
}

function titleCase(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function canCancel(order: OrderI) {
    return (
        ["pending", "confirmed"].includes(order.status) &&
        order.items.length > 0 &&
        order.items.every((i) => i.fulfillmentStatus === "pending")
    );
}

function getPages(current: number, total: number): (number | "…")[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

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

/* ---------- small components ---------- */
function StatusBadge({ status }: { status: OrderStatus }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_STYLE[status]}`}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {titleCase(status)}
        </span>
    );
}

function Progress({ status }: { status: OrderStatus }) {
    if (status === "cancelled") return null;

    // "pending" sits before the first step
    const current = status === "pending" ? -1 : STEPS.indexOf(status);

    return (
        <ol
            className="mt-5 grid grid-cols-4 gap-2"
            aria-label="Order progress"
        >
            {STEPS.map((step, i) => {
                const done = i <= current;

                return (
                    <li key={step} className="min-w-0">
                        <div
                            className={`h-1.5 rounded-full ${done
                                ? "bg-gradient-to-r from-amber-300 to-amber-400"
                                : "bg-slate-200"
                                }`}
                        />
                        <p
                            className={`mt-1.5 truncate text-[11px] font-medium ${done ? "text-slate-900" : "text-slate-500"
                                }`}
                        >
                            {titleCase(step)}
                        </p>
                    </li>
                );
            })}
        </ol>
    );
}

function OrderSkeleton() {
    return (
        <div className={`${cardCls} p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200/70" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200/70" />
                </div>
                <div className="h-7 w-24 animate-pulse rounded-full bg-slate-200/70" />
            </div>
            <div className="mt-5 flex gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-16 w-16 animate-pulse rounded-2xl bg-slate-200/70"
                    />
                ))}
            </div>
        </div>
    );
}

function OrderCard({ order }: { order: OrderI }) {
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const cancel = useCancelOrder();

    const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const preview = order.items.slice(0, 4);
    const extra = order.items.length - preview.length;
    const addr = order.shippingAddress ?? {};
    const detailsId = `order-details-${order.id}`;


    const cancelError = cancel.error as
        | { response?: { data?: { message?: string } } }
        | null;

    return (
        <article className={`${cardCls} p-5 sm:p-6`}>
            {/* top row */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-slate-900">
                        Order #{shortId(order.id)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                        Placed on {formatDate(order.createdAt)}
                    </p>
                </div>

                <StatusBadge status={order.status} />
            </div>

            {/* item preview */}
            <div className="mt-5 flex items-center gap-3">
                <div className="flex -space-x-3">
                    {preview.map((item) => (
                        <div
                            key={item.id}
                            title={item.productName}
                            className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-amber-200/50 ring-2 ring-white ${toneFor(
                                item.productId
                            )}`}
                        >
                            {/* <GemIcon className="h-6 w-6" /> */}
                            {item.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={item.imageUrl}
                                    alt={item.productName}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <GemIcon className="h-6 w-6" />
                            )}

                        </div>
                    ))}

                    {extra > 0 && (
                        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-700 ring-2 ring-white">
                            +{extra}
                        </div>
                    )}
                </div>

                <p className="min-w-0 text-sm text-slate-600">
                    <span className="line-clamp-1 font-medium text-slate-900">
                        {order.items[0]?.productName ?? "Order items"}
                    </span>
                    <span className="text-xs text-slate-500">
                        {totalQty} {totalQty === 1 ? "item" : "items"}
                        {order.items.length > 1 &&
                            ` · ${order.items.length} products`}
                    </span>
                </p>
            </div>

            <Progress status={order.status} />

            {/* footer */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div>
                    <p className="text-xs text-slate-500">
                        {order.paymentMethod === "cod"
                            ? "Cash on delivery"
                            : "Online payment"}{" "}
                        · {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
                        {formatMoney(order.subtotal, order.currency)}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {canCancel(order) && !confirming && (
                        <button
                            type="button"
                            onClick={() => setConfirming(true)}
                            className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                            Cancel order
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                        aria-controls={detailsId}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                    >
                        {open ? "Hide details" : "View details"}
                        <Svg
                            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""
                                }`}
                            strokeWidth={2}
                        >
                            <path d="m6 9 6 6 6-6" />
                        </Svg>
                    </button>
                </div>
            </div>

            {/* cancel confirmation */}
            {confirming && (
                <div
                    role="alertdialog"
                    aria-label="Confirm cancellation"
                    className="mt-4 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200"
                >
                    <p className="text-sm font-medium text-rose-800">
                        Cancel this order?
                    </p>
                    <p className="mt-1 text-xs text-rose-700">
                        Items go back into stock and this can&apos;t be undone.
                    </p>

                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            disabled={cancel.isPending}
                            onClick={() =>
                                cancel.mutate(order.id, {
                                    onSuccess: () => setConfirming(false),
                                })
                            }
                            className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:opacity-60"
                        >
                            {cancel.isPending ? "Cancelling…" : "Yes, cancel order"}
                        </button>

                        <button
                            type="button"
                            disabled={cancel.isPending}
                            onClick={() => {
                                cancel.reset();
                                setConfirming(false);
                            }}
                            className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                            Keep order
                        </button>
                    </div>

                    {cancel.isError && (
                        <p role="alert" className="mt-2 text-xs text-rose-700">
                            {cancelError?.response?.data?.message ??
                                "Could not cancel this order."}
                        </p>
                    )}
                </div>
            )}

            {/* details */}
            {open && (
                <div
                    id={detailsId}
                    className="mt-5 grid gap-6 border-t border-slate-100 pt-5 lg:grid-cols-[1fr_18rem]"
                >
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                            Items
                        </h3>

                        <ul className="mt-3 divide-y divide-slate-100">
                            {order.items.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-center gap-3 py-3"
                                >
                                    <div
                                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-amber-200/50 ${toneFor(
                                            item.productId
                                        )}`}
                                    >
                                        {/* <GemIcon className="h-5 w-5" /> */}
                                        {item.imageUrl ? (
                                            <img
                                                src={item.imageUrl}
                                                alt={item.productName}
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <GemIcon className="h-5 w-5" />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="line-clamp-1 text-sm font-medium text-slate-900">
                                            {item.productName}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {item.quantity} ×{" "}
                                            {formatMoney(
                                                item.unitPrice,
                                                order.currency
                                            )}
                                            <span
                                                className={`ml-2 font-medium ${ITEM_STATUS_STYLE[
                                                    item.fulfillmentStatus
                                                ]
                                                    }`}
                                            >
                                                {titleCase(item.fulfillmentStatus)}
                                            </span>
                                        </p>
                                    </div>

                                    <p className="text-sm font-semibold text-slate-900">
                                        {formatMoney(
                                            item.lineTotal,
                                            order.currency
                                        )}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-5">
                        <div>
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
                                    <span className="block">{addr.country}</span>
                                )}
                                {addr.phone && (
                                    <span className="mt-1 block">
                                        {addr.phone}
                                    </span>
                                )}
                            </address>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Summary
                            </h3>
                            <dl className="mt-2 space-y-1.5 text-sm">
                                <div className="flex justify-between text-slate-600">
                                    <dt>Subtotal</dt>
                                    <dd>
                                        {formatMoney(
                                            order.subtotal,
                                            order.currency
                                        )}
                                    </dd>
                                </div>
                                <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
                                    <dt>Total</dt>
                                    <dd>
                                        {formatMoney(
                                            order.subtotal,
                                            order.currency
                                        )}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
}

/* ---------- page ---------- */
export default function CustomerOrdersPage() {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const listTopRef = useRef<HTMLDivElement>(null);

    const { register, watch, setValue, reset } = useForm<FiltersForm>({
        defaultValues: { status: "" },
    });

    const status = watch("status");

    const { data, isPending, isError, error, isFetching, refetch } =
        useOrders();

    // not signed in → login
    useEffect(() => {
        const code = (error as { response?: { status?: number } } | null)
            ?.response?.status;
        if (code === 401) router.push("/user/login");
    }, [error, router]);

    // back to page 1 whenever the filter changes
    useEffect(() => {
        const sub = watch(() => setPage(1));
        return () => sub.unsubscribe();
    }, [watch]);

    const allOrders: OrderI[] = useMemo(
        () => (Array.isArray(data?.data) ? data.data : []),
        [data]
    );

    const counts = useMemo(() => {
        const map: Record<string, number> = { "": allOrders.length };
        for (const o of allOrders) map[o.status] = (map[o.status] ?? 0) + 1;
        return map;
    }, [allOrders]);

    const filtered = useMemo(
        () =>
            status ? allOrders.filter((o) => o.status === status) : allOrders,
        [allOrders, status]
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const visible = filtered.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE
    );

    const goToPage = (p: number) => {
        setPage(p);
        listTopRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    const base =
        "grid h-11 min-w-11 place-items-center rounded-xl px-3 text-sm font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";

    return (
        <div className="pb-24">
            {/* ================= HEADER BAND ================= */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
                <GridTexture />

                <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-12 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
                    <nav
                        aria-label="Breadcrumb"
                        className="text-xs text-slate-300"
                    >
                        <Link href="/user" className="hover:text-white">
                            Home
                        </Link>
                        <span className="mx-2 text-slate-500">/</span>
                        <span className="text-amber-200">Orders</span>
                    </nav>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-2xl">
                            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                                Your{" "}
                                <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text text-transparent">
                                    orders
                                </span>
                            </h1>

                            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                                Track your purchases, review what you ordered,
                                and cancel an order before it ships.
                            </p>
                        </div>

                        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-amber-200 ring-1 ring-white/15 backdrop-blur">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                            {isPending
                                ? "Loading…"
                                : `${allOrders.length} ${allOrders.length === 1 ? "order" : "orders"
                                }`}
                        </span>
                    </div>
                </div>
            </section>

            {/* ================= FILTER BAR ================= */}
            <section className="relative z-10 mx-auto -mt-12 max-w-5xl px-4 sm:-mt-14 sm:px-6 lg:px-8">
                <div className={`${cardCls} p-4 sm:p-5`}>
                    <input type="hidden" {...register("status")} />

                    <div
                        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            </section>

            {/* ================= RESULTS ================= */}
            <section
                ref={listTopRef}
                className="mx-auto mt-10 max-w-5xl scroll-mt-24 px-4 sm:px-6 lg:px-8"
            >
                <div
                    className={`transition-opacity duration-200 ${isFetching && !isPending ? "opacity-60" : "opacity-100"
                        }`}
                >
                    {isPending ? (
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <OrderSkeleton key={i} />
                            ))}
                        </div>
                    ) : isError ? (
                        <div
                            className={`${cardCls} mx-auto max-w-lg p-10 text-center`}
                        >
                            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                                <Svg className="h-7 w-7">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 8v5M12 16.5v.01" />
                                </Svg>
                            </span>

                            <h2 className="mt-5 text-lg font-semibold text-slate-900">
                                We couldn&apos;t load your orders
                            </h2>

                            <p className="mt-2 text-sm text-slate-600">
                                Something went wrong. Please check your
                                connection and try again.
                            </p>

                            <button
                                type="button"
                                onClick={() => refetch()}
                                className={`${goldBtn} mt-6`}
                            >
                                Try again
                            </button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div
                            className={`${cardCls} mx-auto max-w-lg p-10 text-center`}
                        >
                            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                                <GemIcon className="h-7 w-7" />
                            </span>

                            <h2 className="mt-5 text-lg font-semibold text-slate-900">
                                {status ? "No orders with this status" : "No orders yet"}
                            </h2>

                            <p className="mt-2 text-sm text-slate-600">
                                {status
                                    ? "Try a different status to see your other orders."
                                    : "When you place an order, it will show up here."}
                            </p>

                            {status ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        reset({ status: "" });
                                        setPage(1);
                                    }}
                                    className={`${goldBtn} mt-6`}
                                >
                                    Show all orders
                                </button>
                            ) : (
                                <Link
                                    href="/user/shop"
                                    className={`${goldBtn} mt-6`}
                                >
                                    Browse the shop
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {visible.map((order) => (
                                <OrderCard key={order.id} order={order} />
                            ))}
                        </div>
                    )}
                </div>

                {!isPending && !isError && totalPages > 1 && (
                    <nav
                        aria-label="Pagination"
                        className="mt-12 flex flex-wrap items-center justify-center gap-2"
                    >
                        <button
                            type="button"
                            onClick={() => goToPage(safePage - 1)}
                            disabled={safePage <= 1}
                            aria-label="Previous page"
                            className={`${base} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
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
                                    onClick={() => goToPage(p)}
                                    aria-current={p === safePage ? "page" : undefined}
                                    className={`${base} ${p === safePage
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
                            onClick={() => goToPage(safePage + 1)}
                            disabled={safePage >= totalPages}
                            aria-label="Next page"
                            className={`${base} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                            <Svg className="h-4 w-4" strokeWidth={2}>
                                <path d="m9 6 6 6-6 6" />
                            </Svg>
                        </button>
                    </nav>
                )}
            </section>
        </div>
    );
}