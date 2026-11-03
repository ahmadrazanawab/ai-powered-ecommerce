// FILE: app/components/vendor/catalog-card.tsx
"use client";

import { GemIcon, Svg, cardCls } from "@/app/components/Shop-ui";

export interface CatalogProductI {
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    description: string | null;
    categoryId: string;
    imageUrl: string | null;
}

interface Props {
    product: CatalogProductI;
    categoryName?: string;
    onList: (product: CatalogProductI) => void;
}

export default function CatalogCard({ product, categoryName, onList }: Props) {
    return (
        <article
            className={`${cardCls} group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-20px_rgba(15,23,42,0.3)]`}
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-900">
                {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="grid h-full w-full place-items-center text-amber-200/40 transition-transform duration-500 group-hover:scale-110">
                        <GemIcon className="h-16 w-16" />
                    </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/40 to-transparent" />

                {categoryName && (
                    <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur">
                        {categoryName}
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col p-4 sm:p-5">
                {product.sku && (
                    <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                        SKU · {product.sku}
                    </p>
                )}

                <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold text-slate-900 sm:text-base">
                    {product.name}
                </h3>

                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-500">
                    {product.description || "No description provided."}
                </p>

                <button
                    type="button"
                    onClick={() => onList(product)}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                >
                    <Svg className="h-4 w-4" strokeWidth={2}>
                        <path d="M12 5v14M5 12h14" />
                    </Svg>
                    List this product
                </button>
            </div>
        </article>
    );
}