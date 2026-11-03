"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

/* ---------- config ---------- */
const BRAND = "Aurelia";
const CURRENCY = "$";
const PRODUCT_BASE = "/user/shop";
const MAX_ITEMS = 4;

/* ---------- types ---------- */
interface RelatedI {
    productId: string;
    listingId: string | null;
    name: string;
    slug: string;
    imageUrl: string | null;
    categoryId?: string;
    categoryName: string;
    price: string | number;
    stock: number;
    vendorName: string | null;
}

/* ---------- local helpers ---------- */
const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

function Svg({
    children,
    className = "h-5 w-5",
    strokeWidth = 1.7,
}: {
    children: ReactNode;
    className?: string;
    strokeWidth?: number;
}) {
    return (
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
}

const GemIcon = ({ className }: { className?: string }) => (
    <Svg className={className} strokeWidth={1.5}>
        <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
        <path d="M3 9h18M9 4l3 5 3-5M12 9v11" />
    </Svg>
);

function formatPrice(value: string | number) {
    const n = Number(value);
    if (Number.isNaN(n)) return `${CURRENCY}0.00`;
    return `${CURRENCY}${n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/* ---------- component ---------- */
export function RelatedProducts({
    productId,
    categoryId,
}: {
    productId: string;
    categoryId: string;
}) {
    // 1) same category
    const sameQ = useQuery({
        queryKey: ["related-same", categoryId],
        queryFn: async () =>
            (await api.get("/api/products", { params: { categoryId, limit: 12 } })).data,
        enabled: Boolean(categoryId),
        staleTime: 5 * 60 * 1000,
    });

    // 2) any products, used only to fill empty slots
    const anyQ = useQuery({
        queryKey: ["related-any"],
        queryFn: async () => (await api.get("/api/products", { params: { limit: 12 } })).data,
        staleTime: 5 * 60 * 1000,
    });

    const isPending = sameQ.isPending || anyQ.isPending;

    const items = useMemo(() => {
        const same: RelatedI[] = Array.isArray(sameQ.data?.data) ? sameQ.data.data : [];
        const any: RelatedI[] = Array.isArray(anyQ.data?.data) ? anyQ.data.data : [];

        const seen = new Set<string>([productId]);
        const out: RelatedI[] = [];

        const add = (p: RelatedI) => {
            if (out.length >= MAX_ITEMS || seen.has(p.productId)) return;
            seen.add(p.productId);
            out.push(p);
        };

        // same category first (skip only if the item clearly belongs to another category)
        same.forEach((p) => {
            if (p.categoryId && p.categoryId !== categoryId) return;
            add(p);
        });

        // then fill with other products
        any.forEach(add);

        return out;
    }, [sameQ.data, anyQ.data, productId, categoryId]);

    if (!isPending && items.length === 0) return null;

    return (
        <section className="mt-16 border-t border-slate-200 pt-12" aria-labelledby="related-title">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">
                You may also like
            </p>
            <h2
                id="related-title"
                className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
            >
                Related products
            </h2>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
                {isPending
                    ? Array.from({ length: MAX_ITEMS }).map((_, i) => (
                        <div key={i} className={`${cardCls} overflow-hidden`}>
                            <div className="aspect-square animate-pulse bg-slate-200/70" />
                            <div className="space-y-3 p-4">
                                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/70" />
                                <div className="h-5 w-16 animate-pulse rounded bg-slate-200/70" />
                            </div>
                        </div>
                    ))
                    : items.map((p) => {
                        const href = p.listingId
                            ? `${PRODUCT_BASE}/${p.slug}?listing=${encodeURIComponent(p.listingId)}`
                            : `${PRODUCT_BASE}/${p.slug}`;
                        const soldOut = p.stock <= 0;

                        return (
                            <Link
                                key={p.listingId ?? `admin-${p.productId}`}
                                href={href}
                                className={`${cardCls} group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
                            >
                                <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-900">
                                    {p.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={p.imageUrl}
                                            alt={p.name}
                                            loading="lazy"
                                            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${soldOut ? "opacity-60 grayscale" : ""
                                                }`}
                                        />
                                    ) : (
                                        <div className="grid h-full w-full place-items-center text-amber-200/40">
                                            <GemIcon className="h-16 w-16" />
                                        </div>
                                    )}
                                    {soldOut && (
                                        <span className="absolute left-3 top-3 rounded-full bg-slate-950/85 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                                            Sold out
                                        </span>
                                    )}
                                </div>

                                <div className="p-4">
                                    <p className="line-clamp-1 text-xs text-slate-500">
                                        {p.vendorName ?? `${BRAND} Official`}
                                    </p>
                                    <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-slate-900">
                                        {p.name}
                                    </h3>
                                    <p className="mt-2 text-base font-semibold tracking-tight text-slate-900">
                                        {formatPrice(p.price)}
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
            </div>
        </section>
    );
}

// "use client";

// import { useMemo, type ReactNode } from "react";
// import Link from "next/link";
// import { useQuery } from "@tanstack/react-query";
// import { api } from "@/app/lib/axios";

// /* ---------- config ---------- */
// const BRAND = "Aurelia";
// const CURRENCY = "$";
// const PRODUCT_BASE = "/user/shop";
// const MAX_ITEMS = 4;

// /* ---------- types ---------- */
// interface RelatedI {
//     productId: string;
//     listingId: string | null;
//     name: string;
//     slug: string;
//     imageUrl: string | null;
//     categoryId: string;
//     categoryName: string;
//     price: string | number;
//     stock: number;
//     vendorName: string | null;
// }

// /* ---------- local helpers ---------- */
// const cardCls =
//     "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

// const GemIcon = ({ className }: { className?: string }) => (
//     <Svg className={className} strokeWidth={1.5}>
//         <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
//         <path d="M3 9h18M9 4l3 5 3-5M12 9v11" />
//     </Svg>
// );

// function Svg({
//     children,
//     className = "h-5 w-5",
//     strokeWidth = 1.7,
// }: {
//     children: ReactNode;
//     className?: string;
//     strokeWidth?: number;
// }) {
//     return (
//         <svg
//             xmlns="http://www.w3.org/2000/svg"
//             viewBox="0 0 24 24"
//             fill="none"
//             stroke="currentColor"
//             strokeWidth={strokeWidth}
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             className={className}
//             aria-hidden="true"
//         >
//             {children}
//         </svg>
//     );
// }

// function formatPrice(value: string | number) {
//     const n = Number(value);
//     if (Number.isNaN(n)) return `${CURRENCY}0.00`;
//     return `${CURRENCY}${n.toLocaleString("en-US", {
//         minimumFractionDigits: 2,
//         maximumFractionDigits: 2,
//     })}`;
// }

// /* ---------- component ---------- */
// export function RelatedProducts({
//     productId,
//     categoryId,
// }: {
//     productId: string;
//     categoryId: string;
// }) {
//     const { data, isPending } = useQuery({
//         queryKey: ["related-products", categoryId],
//         queryFn: async () =>
//             (await api.get("/api/products", { params: { categoryId, limit: 50 } })).data,
//         enabled: Boolean(categoryId),
//         staleTime: 5 * 60 * 1000,
//     });

//     // same category only, not the opened product, one card per product
//     const items = useMemo(() => {
//         const list: RelatedI[] = Array.isArray(data?.data) ? data.data : [];
//         const seen = new Set<string>([productId]);
//         const out: RelatedI[] = [];
//         for (const p of list) {
//             if (p.categoryId !== categoryId) continue;
//             if (seen.has(p.productId)) continue;
//             seen.add(p.productId);
//             out.push(p);
//             if (out.length === MAX_ITEMS) break;
//         }
//         return out;
//     }, [data, productId, categoryId]);

//     if (!isPending && items.length === 0) return null;

//     return (
//         <section className="mt-16 border-t border-slate-200 pt-12" aria-labelledby="related-title">
//             <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">
//                 You may also like
//             </p>
//             <h2
//                 id="related-title"
//                 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
//             >
//                 Related products
//             </h2>

//             <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
//                 {isPending
//                     ? Array.from({ length: MAX_ITEMS }).map((_, i) => (
//                         <div key={i} className={`${cardCls} overflow-hidden`}>
//                             <div className="aspect-square animate-pulse bg-slate-200/70" />
//                             <div className="space-y-3 p-4">
//                                 <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/70" />
//                                 <div className="h-5 w-16 animate-pulse rounded bg-slate-200/70" />
//                             </div>
//                         </div>
//                     ))
//                     : items.map((p) => {
//                         const href = p.listingId
//                             ? `${PRODUCT_BASE}/${p.slug}?listing=${encodeURIComponent(p.listingId)}`
//                             : `${PRODUCT_BASE}/${p.slug}`;
//                         const soldOut = p.stock <= 0;

//                         return (
//                             <Link
//                                 key={p.listingId ?? `admin-${p.productId}`}
//                                 href={href}
//                                 className={`${cardCls} group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
//                             >
//                                 <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-900">
//                                     {p.imageUrl ? (
//                                         // eslint-disable-next-line @next/next/no-img-element
//                                         <img
//                                             src={p.imageUrl}
//                                             alt={p.name}
//                                             loading="lazy"
//                                             className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${soldOut ? "opacity-60 grayscale" : ""
//                                                 }`}
//                                         />
//                                     ) : (
//                                         <div className="grid h-full w-full place-items-center text-amber-200/40">
//                                             <GemIcon className="h-16 w-16" />
//                                         </div>
//                                     )}
//                                     {soldOut && (
//                                         <span className="absolute left-3 top-3 rounded-full bg-slate-950/85 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
//                                             Sold out
//                                         </span>
//                                     )}
//                                 </div>

//                                 <div className="p-4">
//                                     <p className="line-clamp-1 text-xs text-slate-500">
//                                         {p.vendorName ?? `${BRAND} Official`}
//                                     </p>
//                                     <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-slate-900">
//                                         {p.name}
//                                     </h3>
//                                     <p className="mt-2 text-base font-semibold tracking-tight text-slate-900">
//                                         {formatPrice(p.price)}
//                                     </p>
//                                 </div>
//                             </Link>
//                         );
//                     })}
//             </div>
//         </section>
//     );
// }