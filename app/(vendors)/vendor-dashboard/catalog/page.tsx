// FILE: app/(vendors)/vendor-dashbaord/catalog/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/app/lib/axios";
import {
    GemIcon,
    PAGE_SIZE,
    Pagination,
    ProductSkeleton,
    Svg,
    cardCls,
    fieldCls,
    goldBtn,
    type CategoryI,
} from "@/app/components/Shop-ui";
import CatalogCard, { type CatalogProductI } from "../components/Catalog-card";
import ListProductModal from "../components/List-product-modal";

interface FiltersForm {
    search: string;
    categoryId: string;
}

const DEFAULT_FILTERS: FiltersForm = { search: "", categoryId: "" };

export default function VendorCatalogPage() {
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<CatalogProductI | null>(null);

    const { register, watch, setValue, reset } = useForm<FiltersForm>({
        defaultValues: DEFAULT_FILTERS,
    });

    const search = watch("search");
    const categoryId = watch("categoryId");

    // back to page 1 whenever a filter changes
    useEffect(() => {
        const sub = watch(() => setPage(1));
        return () => sub.unsubscribe();
    }, [watch]);

    /* catalog: the API returns every active product, so search and category filters run here */
    const { data, isPending, isError, refetch } = useQuery({
        queryKey: ["vendor-catalog"],
        queryFn: async () => (await api.get("/api/auth/vendor/catalog")).data,
        staleTime: 2 * 60 * 1000,
    });

    /* category names (the catalog only returns categoryId) */
    const { data: catData } = useQuery({
        queryKey: ["categories"],
        queryFn: async () => (await api.get("/api/categories")).data,
        staleTime: 5 * 60 * 1000,
    });

    const products: CatalogProductI[] = Array.isArray(data?.data) ? data.data : [];
    const categories: CategoryI[] = Array.isArray(catData?.data) ? catData.data : [];

    const categoryName = useMemo(
        () => new Map(categories.map((c) => [c.categoryId, c.name])),
        [categories]
    );

    // only show chips for categories that actually have products
    const usedCategories = useMemo(
        () => categories.filter((c) => products.some((p) => p.categoryId === c.categoryId)),
        [categories, products]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return products.filter((p) => {
            if (categoryId && p.categoryId !== categoryId) return false;
            if (!q) return true;
            return [p.name, p.sku ?? "", p.description ?? ""].some((v) => v.toLowerCase().includes(q));
        });
    }, [products, search, categoryId]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const hasFilters = search.trim() !== "" || categoryId !== "";

    const clearFilters = () => {
        reset(DEFAULT_FILTERS);
        setPage(1);
    };

    return (
        <div>
            {/* ================= HEADER ================= */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">Catalog</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                        Product catalog
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-slate-600">
                        Choose a product from our catalog and list it in your store with your own price and
                        stock.
                    </p>
                </div>

                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                    {isPending ? "Loading…" : `${products.length} products`}
                </span>
            </div>

            {/* ================= FILTERS ================= */}
            <div className={`${cardCls} mt-8 p-4 sm:p-5`}>
                <form onSubmit={(e) => e.preventDefault()} role="search">
                    <div className="relative">
                        <label htmlFor="catalog-search" className="sr-only">
                            Search catalog
                        </label>
                        <Svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                        </Svg>
                        <input
                            id="catalog-search"
                            type="search"
                            autoComplete="off"
                            placeholder="Search by name, SKU or description…"
                            className={`${fieldCls} pl-12 pr-4`}
                            {...register("search")}
                        />
                    </div>
                </form>

                {usedCategories.length > 0 && (
                    <div
                        className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        role="group"
                        aria-label="Filter by category"
                    >
                        {[{ categoryId: "", name: "All" } as CategoryI, ...usedCategories].map((c) => {
                            const active = categoryId === c.categoryId;
                            return (
                                <button
                                    key={c.categoryId || "all"}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setValue("categoryId", c.categoryId)}
                                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active
                                            ? "bg-slate-950 text-amber-300 shadow-md shadow-slate-950/20"
                                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        }`}
                                >
                                    {c.name}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ================= RESULTS ================= */}
            <div className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600" aria-live="polite">
                        {isPending ? (
                            "Loading catalog…"
                        ) : (
                            <>
                                <span className="font-semibold text-slate-900">{filtered.length}</span>{" "}
                                {filtered.length === 1 ? "product" : "products"}
                                {hasFilters && " match your filters"}
                            </>
                        )}
                    </p>

                    {hasFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                            <Svg className="h-4 w-4" strokeWidth={2}>
                                <path d="M6 6l12 12M18 6 6 18" />
                            </Svg>
                            Clear filters
                        </button>
                    )}
                </div>

                <div className="mt-6">
                    {isPending ? (
                        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <ProductSkeleton key={i} />
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
                                We couldn&apos;t load the catalog
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Something went wrong. Please check your connection and try again.
                            </p>
                            <button type="button" onClick={() => refetch()} className={`${goldBtn} mt-6`}>
                                Try again
                            </button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                                <GemIcon className="h-7 w-7" />
                            </span>
                            <h2 className="mt-5 text-lg font-semibold text-slate-900">
                                {hasFilters ? "No products found" : "The catalog is empty"}
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {hasFilters
                                    ? "Try a different search or remove the filters."
                                    : "Products added by the admin will appear here."}
                            </p>
                            {hasFilters && (
                                <button type="button" onClick={clearFilters} className={`${goldBtn} mt-6`}>
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                            {pageItems.map((p) => (
                                <CatalogCard
                                    key={p.id}
                                    product={p}
                                    categoryName={categoryName.get(p.categoryId)}
                                    onList={setSelected}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {!isPending && !isError && (
                    <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        onChange={(p) => {
                            setPage(p);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                    />
                )}
            </div>

            {/* ================= LIST MODAL ================= */}
            {selected && (
                <ListProductModal
                    product={selected}
                    categoryName={categoryName.get(selected.categoryId)}
                    onClose={() => setSelected(null)}
                />
            )}
        </div>
    );
}