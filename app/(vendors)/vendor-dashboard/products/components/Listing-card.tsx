// FILE: app/components/vendor/listing-card.tsx
"use client";

import {
    GemIcon,
    LOW_STOCK_AT,
    Svg,
    cardCls,
    formatPrice,
} from "@/app/components/Shop-ui";

export interface VendorListingI {
    listingId: string;
    productId: string;
    categoryId: string;
    categoryName: string;
    name: string;
    slug: string;
    sku: string | null;
    description: string | null;
    imageUrl: string | null;
    price: string | number;
    stock: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

function statusOf(l: VendorListingI) {
    if (!l.isActive) {
        return { label: "Hidden", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
    }
    if (l.stock <= 0) {
        return { label: "Sold out", badge: "bg-rose-50 text-rose-700", dot: "bg-rose-500" };
    }
    if (l.stock <= LOW_STOCK_AT) {
        return { label: "Low stock", badge: "bg-amber-50 text-amber-800", dot: "bg-amber-500" };
    }
    return { label: "Active", badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
}

interface Props {
    listing: VendorListingI;
    busy: boolean; // a request for this listing is running
    onToggle: (listing: VendorListingI) => void;
    onEdit: (listing: VendorListingI) => void;
    onDelete: (listing: VendorListingI) => void;
}

export default function ListingCard({ listing, busy, onToggle, onEdit, onDelete }: Props) {
    const status = statusOf(listing);

    return (
        <article
            className={`${cardCls} p-4 transition-all sm:p-5 ${
                listing.isActive ? "" : "bg-slate-50/70"
            } ${busy ? "opacity-70" : ""}`}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                {/* product */}
                <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div
                        className={`grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 text-amber-200/50 sm:h-24 sm:w-24 ${
                            listing.isActive ? "" : "grayscale"
                        }`}
                    >
                        {listing.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={listing.imageUrl}
                                alt={listing.name}
                                loading="lazy"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <GemIcon className="h-8 w-8" />
                        )}
                    </div>

                    <div className="min-w-0">
                        <p className="truncate text-xs text-slate-500">{listing.categoryName}</p>
                        <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900 sm:text-base">
                            {listing.name}
                        </h3>
                        {listing.sku && (
                            <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-wider text-slate-500">
                                SKU · {listing.sku}
                            </p>
                        )}
                        <span
                            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.badge}`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                        </span>
                    </div>
                </div>

                {/* price + stock */}
                <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 sm:flex sm:gap-8 sm:bg-transparent sm:p-0">
                    <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                            Price
                        </dt>
                        <dd className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                            {formatPrice(listing.price)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                            Stock
                        </dt>
                        <dd className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                            {listing.stock}
                        </dd>
                    </div>
                </dl>

                {/* controls */}
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:justify-end sm:border-0 sm:pt-0">
                    <label className="flex cursor-pointer items-center gap-2.5">
                        <button
                            type="button"
                            role="switch"
                            aria-checked={listing.isActive}
                            aria-label={`${listing.isActive ? "Hide" : "Show"} ${listing.name} in the store`}
                            disabled={busy}
                            onClick={() => onToggle(listing)}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                                listing.isActive ? "bg-slate-950" : "bg-slate-300"
                            }`}
                        >
                            <span
                                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform ${
                                    listing.isActive
                                        ? "translate-x-5 bg-amber-300"
                                        : "translate-x-0 bg-white"
                                }`}
                            />
                        </button>
                        <span className="text-xs font-medium text-slate-600">
                            {listing.isActive ? "Visible" : "Hidden"}
                        </span>
                    </label>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onEdit(listing)}
                            disabled={busy}
                            aria-label={`Edit ${listing.name}`}
                            className="inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
                        >
                            <Svg className="h-4 w-4">
                                <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
                                <path d="m13.5 6.5 4 4" />
                            </Svg>
                            <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(listing)}
                            disabled={busy}
                            aria-label={`Delete ${listing.name}`}
                            className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 ring-1 ring-rose-100 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50"
                        >
                            <Svg className="h-4 w-4">
                                <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                                <path d="M10 11v5M14 11v5" />
                            </Svg>
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}