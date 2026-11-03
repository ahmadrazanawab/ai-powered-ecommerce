// FILE: app/components/shop/shop-ui.tsx
// Shared pieces for the shop page and the category page.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

/* ---------- edit these to match your store ---------- */
export const BRAND = "Aurelia";
export const CURRENCY = "$";
export const PAGE_SIZE = 12;
export const LOW_STOCK_AT = 5;

/* ---------- types ---------- */
export interface CategoryI {
    categoryId: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
}

export interface ProductI {
    productId: string;
    listingId: string | null;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    categoryId: string;
    categoryName: string;
    price: string | number;
    stock: number;
    vendorId: string | null;
    vendorName: string | null;
    source: "admin" | "vendor";
}

export interface PaginationI {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export const SORT_OPTIONS = [
    { value: "newest-desc", label: "Newest first" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "name-asc", label: "Name: A to Z" },
    { value: "name-desc", label: "Name: Z to A" },
];

/* fallback gradients for products without an image (full class strings on purpose) */
const TONES = [
    "from-slate-900 to-indigo-900",
    "from-indigo-950 to-slate-800",
    "from-slate-800 to-slate-950",
    "from-amber-900 to-slate-900",
];

/* ---------- style helpers ---------- */
export const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

export const goldBtn =
    "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

export const fieldCls =
    "h-12 w-full rounded-xl bg-white text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-amber-400/70";

export const Svg = ({
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

export const GemIcon = ({ className }: { className?: string }) => (
    <Svg className={className} strokeWidth={1.5}>
        <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
        <path d="M3 9h18M9 4l3 5 3-5M12 9v11" />
    </Svg>
);

export const GridTexture = ({ opacity = "opacity-[0.07]" }: { opacity?: string }) => (
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
export function useDebounce<T>(value: T, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

export function formatPrice(value: string | number) {
    const n = Number(value);
    if (Number.isNaN(n)) return `${CURRENCY}0.00`;
    return `${CURRENCY}${n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function toneFor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 997;
    return TONES[hash % TONES.length];
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

/* ---------- product card ---------- */
export function ProductCard({ product }: { product: ProductI }) {
    const outOfStock = product.stock <= 0;
    const lowStock = !outOfStock && product.stock <= LOW_STOCK_AT;
    const seller = product.vendorName ?? `${BRAND} Official`;

    return (
        <article
            className={`${cardCls} group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-20px_rgba(15,23,42,0.3)]`}
        >
            <Link
                href={`/user/shop/${product.slug}`}
                className="relative block aspect-square overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
            >
                <div className={`absolute inset-0 bg-gradient-to-br ${toneFor(product.productId)}`}>
                    {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            loading="lazy"
                            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${outOfStock ? "opacity-60 grayscale" : ""
                                }`}
                        />
                    ) : (
                        <div className="grid h-full w-full place-items-center text-amber-200/40 transition-transform duration-500 group-hover:scale-110">
                            <GemIcon className="h-16 w-16 sm:h-20 sm:w-20" />
                        </div>
                    )}
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/40 to-transparent" />

                <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
                    {outOfStock ? (
                        <span className="rounded-full bg-slate-950/85 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                            Sold out
                        </span>
                    ) : lowStock ? (
                        <span className="rounded-full bg-gradient-to-br from-amber-200 to-amber-400 px-3 py-1 text-[11px] font-semibold text-slate-950">
                            Only {product.stock} left
                        </span>
                    ) : null}
                </div>

                <span className="absolute right-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur">
                    {product.categoryName}
                </span>
            </Link>

            <div className="flex flex-1 flex-col p-4 sm:p-5">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${product.source === "vendor" ? "bg-indigo-500" : "bg-amber-400"
                            }`}
                    />
                    <span className="line-clamp-1">{seller}</span>
                </p>

                <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold text-slate-900 sm:text-base">
                    <Link
                        href={`/user/products/${product.slug}`}
                        className="hover:underline focus-visible:outline-none focus-visible:underline"
                    >
                        {product.name}
                    </Link>
                </h3>

                {product.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {product.description}
                    </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <p className="text-lg font-semibold tracking-tight text-slate-900">
                        {formatPrice(product.price)}
                    </p>

                    <button
                        type="button"
                        disabled={outOfStock}
                        aria-label={`Add ${product.name} to cart`}
                        // TODO: connect to useAddToCart()
                        onClick={() => undefined}
                        className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                        <Svg className="h-5 w-5">
                            <path d="M6 7h12l-1 12H7L6 7Z" />
                            <path d="M9 7a3 3 0 0 1 6 0" />
                        </Svg>
                    </button>
                </div>
            </div>
        </article>
    );
}

export function ProductSkeleton() {
    return (
        <div className={`${cardCls} overflow-hidden`}>
            <div className="aspect-square animate-pulse bg-slate-200/70" />
            <div className="space-y-3 p-4 sm:p-5">
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200/70" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/70" />
                <div className="flex items-center justify-between pt-2">
                    <div className="h-5 w-16 animate-pulse rounded bg-slate-200/70" />
                    <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200/70" />
                </div>
            </div>
        </div>
    );
}

/* ---------- pagination ---------- */
export function Pagination({
    page,
    totalPages,
    onChange,
}: {
    page: number;
    totalPages: number;
    onChange: (p: number) => void;
}) {
    if (totalPages <= 1) return null;

    const base =
        "grid h-11 min-w-11 place-items-center rounded-xl px-3 text-sm font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";

    return (
        <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
            <button
                type="button"
                onClick={() => onChange(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                className={`${base} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
            >
                <Svg className="h-4 w-4" strokeWidth={2}>
                    <path d="m15 6-6 6 6 6" />
                </Svg>
            </button>

            {getPages(page, totalPages).map((p, i) =>
                p === "…" ? (
                    <span key={`dots-${i}`} className="px-1 text-slate-500" aria-hidden="true">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onChange(p)}
                        aria-current={p === page ? "page" : undefined}
                        className={`${base} ${p === page
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
                onClick={() => onChange(page + 1)}
                disabled={page >= totalPages}
                aria-label="Next page"
                className={`${base} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
            >
                <Svg className="h-4 w-4" strokeWidth={2}>
                    <path d="m9 6 6 6-6 6" />
                </Svg>
            </button>
        </nav>
    );
}