
// FILE: app/user/categories/[slug]/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/app/lib/axios";
import {
    GemIcon,
    GridTexture,
    PAGE_SIZE,
    Pagination,
    ProductCard,
    ProductSkeleton,
    SORT_OPTIONS,
    Svg,
    cardCls,
    fieldCls,
    goldBtn,
    useDebounce,
    type CategoryI,
    type PaginationI,
    type ProductI,
} from "../../../../components/Shop-ui";

interface FiltersForm {
    search: string;
    sort: string;
}

const DEFAULT_FILTERS: FiltersForm = { search: "", sort: "newest-desc" };

interface HttpErrorLike {
    response?: { status?: number };
}

export default function CategoryPage() {
    const { slug } = useParams<{ slug: string }>();

    const [page, setPage] = useState(1);
    const gridTopRef = useRef<HTMLDivElement>(null);

    const { register, watch, reset } = useForm<FiltersForm>({
        defaultValues: DEFAULT_FILTERS,
    });

    const search = watch("search");
    const sort = watch("sort");
    const debouncedSearch = useDebounce(search.trim(), 400);
    const [sortBy, sortOrder] = sort.split("-");

    useEffect(() => {
        const sub = watch(() => setPage(1));
        return () => sub.unsubscribe();
    }, [watch]);

    useEffect(() => {
        reset(DEFAULT_FILTERS);
        setPage(1);
    }, [slug, reset]);

    /* 1. the category itself */
    const {
        data: catData,
        isPending: catPending,
        isError: catError,
        error: catErr,
        refetch: refetchCategory,
    } = useQuery({
        queryKey: ["category", slug],
        queryFn: async () => (await api.get(`/api/categories/category/${slug}`)).data,
        enabled: Boolean(slug),
        retry: 1,
    });

    const category: CategoryI | undefined = catData?.data;
    const notFound = (catErr as HttpErrorLike | null)?.response?.status === 404;

    /* 2. all categories (for the chips) */
    const { data: allCatData } = useQuery({
        queryKey: ["categories"],
        queryFn: async () => (await api.get("/api/categories")).data,
        staleTime: 5 * 60 * 1000,
    });

    const categories: CategoryI[] = Array.isArray(allCatData?.data)
        ? allCatData.data
        : [];

    /* 3. products of this category */
    const categoryId = category?.categoryId;

    const { data, isPending, isError, isFetching, refetch } = useQuery({
        queryKey: [
            "products",
            { categoryId, search: debouncedSearch, sortBy, sortOrder, page },
        ],
        queryFn: async () => {
            const res = await api.get("/api/products", {
                params: {
                    categoryId,
                    search: debouncedSearch || undefined,
                    sortBy,
                    sortOrder,
                    page,
                    limit: PAGE_SIZE,
                },
            });

            return res.data;
        },
        enabled: Boolean(categoryId),
        placeholderData: keepPreviousData,
    });

    // Only show products that belong to a vendor listing.
    const products: ProductI[] = Array.isArray(data?.data)
        ? data.data.filter(
            (product: ProductI) =>
                typeof product.listingId === "string" &&
                product.listingId.trim().length > 0
        )
        : [];

    // Counts and pagination are still supplied by the API.
    const pagination: PaginationI = data?.pagination ?? {
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1,
    };

    const hasFilters = search.trim() !== "" || sort !== DEFAULT_FILTERS.sort;

    const clearFilters = () => {
        reset(DEFAULT_FILTERS);
        setPage(1);
    };

    const goToPage = (p: number) => {
        setPage(p);
        gridTopRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    /* ---------- category loading ---------- */
    if (catPending) {
        return (
            <div>
                <div className="h-72 animate-pulse bg-slate-900" />
                <div className="mx-auto mt-10 grid max-w-7xl grid-cols-2 gap-4 px-4 sm:gap-5 sm:px-6 lg:grid-cols-3 lg:px-8 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <ProductSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    /* ---------- category not found / error ---------- */
    if (catError || !category) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
                <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                        <GemIcon className="h-7 w-7" />
                    </span>
                    <h1 className="mt-5 text-lg font-semibold text-slate-900">
                        {notFound
                            ? "Category not found"
                            : "We couldn't load this category"}
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        {notFound
                            ? "It may have been removed or the link is incorrect."
                            : "Something went wrong. Please try again."}
                    </p>
                    <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                        {!notFound && (
                            <button
                                type="button"
                                onClick={() => refetchCategory()}
                                className={goldBtn}
                            >
                                Try again
                            </button>
                        )}
                        <Link
                            href="/user/shop"
                            className="inline-flex h-12 items-center justify-center rounded-xl px-7 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                            Back to shop
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-24">
            {/* ================= HEADER BAND ================= */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                {category.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={category.imageUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover opacity-25"
                    />
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/30" />
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
                <GridTexture />

                <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
                    <nav aria-label="Breadcrumb" className="text-xs text-slate-300">
                        <Link href="/user" className="hover:text-white">
                            Home
                        </Link>
                        <span className="mx-2 text-slate-500">/</span>
                        <Link href="/user/shop" className="hover:text-white">
                            Shop
                        </Link>
                        <span className="mx-2 text-slate-500">/</span>
                        <span className="text-amber-200">{category.name}</span>
                    </nav>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">
                                Category
                            </p>
                            <h1 className="mt-3 bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
                                {category.name}
                            </h1>
                            {category.description && (
                                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                                    {category.description}
                                </p>
                            )}
                        </div>

                        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-amber-200 ring-1 ring-white/15 backdrop-blur">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                            {isPending ? "Loading…" : `${pagination.total} products`}
                        </span>
                    </div>
                </div>
            </section>

            {/* ================= FILTER BAR ================= */}
            <section className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 sm:-mt-14 sm:px-6 lg:px-8">
                <div className={`${cardCls} p-4 sm:p-5`}>
                    <form
                        onSubmit={(e) => e.preventDefault()}
                        className="grid gap-3 md:grid-cols-[1fr_16rem]"
                        role="search"
                    >
                        <div className="relative">
                            <label htmlFor="category-search" className="sr-only">
                                Search in {category.name}
                            </label>
                            <Svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500">
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-3.5-3.5" />
                            </Svg>
                            <input
                                id="category-search"
                                type="search"
                                autoComplete="off"
                                placeholder={`Search in ${category.name}…`}
                                className={`${fieldCls} pl-12 pr-4`}
                                {...register("search")}
                            />
                        </div>

                        <div className="relative">
                            <label htmlFor="category-sort" className="sr-only">
                                Sort products
                            </label>
                            <select
                                id="category-sort"
                                className={`${fieldCls} cursor-pointer appearance-none px-4 pr-11`}
                                {...register("sort")}
                            >
                                {SORT_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            <Svg
                                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                                strokeWidth={2}
                            >
                                <path d="m6 9 6 6 6-6" />
                            </Svg>
                        </div>
                    </form>

                    {/* other categories: links to their own pages */}
                    <nav
                        aria-label="Categories"
                        className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        <Link
                            href="/user/shop"
                            className="shrink-0 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                            All
                        </Link>
                        {categories.map((c) => {
                            const active = c.slug === category.slug;
                            return (
                                <Link
                                    key={c.categoryId}
                                    href={`/user/categories/${c.slug}`}
                                    aria-current={active ? "page" : undefined}
                                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active
                                            ? "bg-slate-950 text-amber-300 shadow-md shadow-slate-950/20"
                                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        }`}
                                >
                                  {c.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </section>

            {/* ================= RESULTS ================= */}
            <section
                ref={gridTopRef}
                className="mx-auto mt-10 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600" aria-live="polite">
                        {isPending ? (
                            "Loading products…"
                        ) : (
                            <>
                                <span className="font-semibold text-slate-900">
                                    {products.length}
                                </span>{" "}
                                {products.length === 1 ? "product" : "products"} in{" "}
                                <span className="font-semibold text-slate-900">
                                    {category.name}
                                </span>
                                {debouncedSearch && (
                                    <>
                                        {" "}for &ldquo;
                                        <span className="font-semibold text-slate-900">
                                            {debouncedSearch}
                                        </span>
                                        &rdquo;
                                    </>
                                )}
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

                <div
                    className={`mt-6 transition-opacity duration-200 ${isFetching && !isPending ? "opacity-60" : "opacity-100"
                        }`}
                >
                    {isPending ? (
                        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
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
                                We couldn&apos;t load the products
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Something went wrong. Please check your connection and try again.
                            </p>
                            <button
                                type="button"
                                onClick={() => refetch()}
                                className={`${goldBtn} mt-6`}
                            >
                                Try again
                            </button>
                        </div>
                    ) : products.length === 0 ? (
                        <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                                <GemIcon className="h-7 w-7" />
                            </span>
                            <h2 className="mt-5 text-lg font-semibold text-slate-900">
                                {hasFilters
                                    ? "No products found"
                                    : `No products in ${category.name} yet`}
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {hasFilters
                                    ? "Try a different search or remove the filters."
                                    : "New pieces will appear here soon."}
                            </p>
                            {hasFilters ? (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className={`${goldBtn} mt-6`}
                                >
                                    Clear filters
                                </button>
                            ) : (
                                <Link href="/user/shop" className={`${goldBtn} mt-6`}>
                                    Browse all products
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                            {products.map((p) => (
                                <ProductCard
                                    key={p.listingId}
                                    product={p}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {!isError && (
                    <Pagination
                        page={pagination.page}
                        totalPages={pagination.totalPages}
                        onChange={goToPage}
                    />
                )}
            </section>
        </div>
    );
}


// "use client";

// import { useEffect, useRef, useState } from "react";
// import Link from "next/link";
// import { useParams } from "next/navigation";
// import { keepPreviousData, useQuery } from "@tanstack/react-query";
// import { useForm } from "react-hook-form";
// import { api } from "@/app/lib/axios";
// import {
//     GemIcon,
//     GridTexture,
//     PAGE_SIZE,
//     Pagination,
//     ProductCard,
//     ProductSkeleton,
//     SORT_OPTIONS,
//     Svg,
//     cardCls,
//     fieldCls,
//     goldBtn,
//     useDebounce,
//     type CategoryI,
//     type PaginationI,
//     type ProductI,
// } from "../../../../components/Shop-ui";

// interface FiltersForm {
//     search: string;
//     sort: string;
// }

// const DEFAULT_FILTERS: FiltersForm = { search: "", sort: "newest-desc" };

// interface HttpErrorLike {
//     response?: { status?: number };
// }

// export default function CategoryPage() {
//     // dynamic segment: the folder name [slug] becomes params.slug
//     const { slug } = useParams<{ slug: string }>();

//     const [page, setPage] = useState(1);
//     const gridTopRef = useRef<HTMLDivElement>(null);

//     const { register, watch, reset } = useForm<FiltersForm>({
//         defaultValues: DEFAULT_FILTERS,
//     });

//     const search = watch("search");
//     const sort = watch("sort");
//     const debouncedSearch = useDebounce(search.trim(), 400);
//     const [sortBy, sortOrder] = sort.split("-");

//     // go back to page 1 whenever a filter changes
//     useEffect(() => {
//         const sub = watch(() => setPage(1));
//         return () => sub.unsubscribe();
//     }, [watch]);

//     // the component stays mounted when you move between categories, so reset on slug change
//     useEffect(() => {
//         reset(DEFAULT_FILTERS);
//         setPage(1);
//     }, [slug, reset]);

//     /* 1. the category itself */
//     const {
//         data: catData,
//         isPending: catPending,
//         isError: catError,
//         error: catErr,
//         refetch: refetchCategory,
//     } = useQuery({
//         queryKey: ["category", slug],
//         queryFn: async () => (await api.get(`/api/categories/category/${slug}`)).data,
//         enabled: Boolean(slug),
//         retry: 1,
//     });

//     const category: CategoryI | undefined = catData?.data;
//     const notFound = (catErr as HttpErrorLike | null)?.response?.status === 404;

//     /* 2. all categories (for the chips) */
//     const { data: allCatData } = useQuery({
//         queryKey: ["categories"],
//         queryFn: async () => (await api.get("/api/categories")).data,
//         staleTime: 5 * 60 * 1000,
//     });
//     const categories: CategoryI[] = Array.isArray(allCatData?.data) ? allCatData.data : [];

//     /* 3. products of this category (same /api/products endpoint, filtered by categoryId) */
//     const categoryId = category?.categoryId;

//     const { data, isPending, isError, isFetching, refetch } = useQuery({
//         queryKey: ["products", { categoryId, search: debouncedSearch, sortBy, sortOrder, page }],
//         queryFn: async () => {
//             const res = await api.get("/api/products", {
//                 params: {
//                     categoryId,
//                     search: debouncedSearch || undefined,
//                     sortBy,
//                     sortOrder,
//                     page,
//                     limit: PAGE_SIZE,
//                 },
//             });
//             return res.data;
//         },
//         enabled: Boolean(categoryId),
//         placeholderData: keepPreviousData,
//     });

//     const products: ProductI[] = Array.isArray(data?.data) ? data.data : [];
//     const pagination: PaginationI = data?.pagination ?? {
//         page: 1,
//         limit: PAGE_SIZE,
//         total: 0,
//         totalPages: 1,
//     };

//     const hasFilters = search.trim() !== "" || sort !== DEFAULT_FILTERS.sort;

//     const clearFilters = () => {
//         reset(DEFAULT_FILTERS);
//         setPage(1);
//     };

//     const goToPage = (p: number) => {
//         setPage(p);
//         gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
//     };

//     /* ---------- category loading ---------- */
//     if (catPending) {
//         return (
//             <div>
//                 <div className="h-72 animate-pulse bg-slate-900" />
//                 <div className="mx-auto mt-10 grid max-w-7xl grid-cols-2 gap-4 px-4 sm:gap-5 sm:px-6 lg:grid-cols-3 lg:px-8 xl:grid-cols-4">
//                     {Array.from({ length: 8 }).map((_, i) => (
//                         <ProductSkeleton key={i} />
//                     ))}
//                 </div>
//             </div>
//         );
//     }

//     /* ---------- category not found / error ---------- */
//     if (catError || !category) {
//         return (
//             <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
//                 <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
//                     <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
//                         <GemIcon className="h-7 w-7" />
//                     </span>
//                     <h1 className="mt-5 text-lg font-semibold text-slate-900">
//                         {notFound ? "Category not found" : "We couldn't load this category"}
//                     </h1>
//                     <p className="mt-2 text-sm text-slate-600">
//                         {notFound
//                             ? "It may have been removed or the link is incorrect."
//                             : "Something went wrong. Please try again."}
//                     </p>
//                     <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
//                         {!notFound && (
//                             <button type="button" onClick={() => refetchCategory()} className={goldBtn}>
//                                 Try again
//                             </button>
//                         )}
//                         <Link
//                             href="/user/shop"
//                             className="inline-flex h-12 items-center justify-center rounded-xl px-7 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
//                         >
//                             Back to shop
//                         </Link>
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="pb-24">
//             {/* ================= HEADER BAND ================= */}
//             <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
//                 {category.imageUrl && (
//                     // eslint-disable-next-line @next/next/no-img-element
//                     <img
//                         src={category.imageUrl}
//                         alt=""
//                         aria-hidden="true"
//                         className="absolute inset-0 h-full w-full object-cover opacity-25"
//                     />
//                 )}
//                 <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/30" />
//                 <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
//                 <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
//                 <GridTexture />

//                 <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
//                     <nav aria-label="Breadcrumb" className="text-xs text-slate-300">
//                         <Link href="/user" className="hover:text-white">
//                             Home
//                         </Link>
//                         <span className="mx-2 text-slate-500">/</span>
//                         <Link href="/user/shop" className="hover:text-white">
//                             Shop
//                         </Link>
//                         <span className="mx-2 text-slate-500">/</span>
//                         <span className="text-amber-200">{category.name}</span>
//                     </nav>

//                     <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
//                         <div className="max-w-2xl">
//                             <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">
//                                 Category
//                             </p>
//                             <h1 className="mt-3 bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
//                                 {category.name}
//                             </h1>
//                             {category.description && (
//                                 <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
//                                     {category.description}
//                                 </p>
//                             )}
//                         </div>

//                         <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-amber-200 ring-1 ring-white/15 backdrop-blur">
//                             <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
//                             {isPending ? "Loading…" : `${pagination.total} products`}
//                         </span>
//                     </div>
//                 </div>
//             </section>

//             {/* ================= FILTER BAR ================= */}
//             <section className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 sm:-mt-14 sm:px-6 lg:px-8">
//                 <div className={`${cardCls} p-4 sm:p-5`}>
//                     <form
//                         onSubmit={(e) => e.preventDefault()}
//                         className="grid gap-3 md:grid-cols-[1fr_16rem]"
//                         role="search"
//                     >
//                         <div className="relative">
//                             <label htmlFor="category-search" className="sr-only">
//                                 Search in {category.name}
//                             </label>
//                             <Svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500">
//                                 <circle cx="11" cy="11" r="7" />
//                                 <path d="m20 20-3.5-3.5" />
//                             </Svg>
//                             <input
//                                 id="category-search"
//                                 type="search"
//                                 autoComplete="off"
//                                 placeholder={`Search in ${category.name}…`}
//                                 className={`${fieldCls} pl-12 pr-4`}
//                                 {...register("search")}
//                             />
//                         </div>

//                         <div className="relative">
//                             <label htmlFor="category-sort" className="sr-only">
//                                 Sort products
//                             </label>
//                             <select
//                                 id="category-sort"
//                                 className={`${fieldCls} cursor-pointer appearance-none px-4 pr-11`}
//                                 {...register("sort")}
//                             >
//                                 {SORT_OPTIONS.map((o) => (
//                                     <option key={o.value} value={o.value}>
//                                         {o.label}
//                                     </option>
//                                 ))}
//                             </select>
//                             <Svg
//                                 className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
//                                 strokeWidth={2}
//                             >
//                                 <path d="m6 9 6 6 6-6" />
//                             </Svg>
//                         </div>
//                     </form>

//                     {/* other categories: links to their own pages */}
//                     <nav
//                         aria-label="Categories"
//                         className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
//                     >
//                         <Link
//                             href="/user/shop"
//                             className="shrink-0 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
//                         >
//                             All
//                         </Link>
//                         {categories.map((c) => {
//                             const active = c.slug === category.slug;
//                             return (
//                                 <Link
//                                     key={c.categoryId}
//                                     href={`/user/categories/${c.slug}`}
//                                     aria-current={active ? "page" : undefined}
//                                     className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active
//                                             ? "bg-slate-950 text-amber-300 shadow-md shadow-slate-950/20"
//                                             : "bg-slate-100 text-slate-700 hover:bg-slate-200"
//                                         }`}
//                                 >
//                                     {c.name}
//                                 </Link>
//                             );
//                         })}
//                     </nav>
//                 </div>
//             </section>

//             {/* ================= RESULTS ================= */}
//             <section ref={gridTopRef} className="mx-auto mt-10 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
//                 <div className="flex flex-wrap items-center justify-between gap-3">
//                     <p className="text-sm text-slate-600" aria-live="polite">
//                         {isPending ? (
//                             "Loading products…"
//                         ) : (
//                             <>
//                                 <span className="font-semibold text-slate-900">{pagination.total}</span>{" "}
//                                 {pagination.total === 1 ? "product" : "products"} in{" "}
//                                 <span className="font-semibold text-slate-900">{category.name}</span>
//                                 {debouncedSearch && (
//                                     <>
//                                         {" "}for &ldquo;<span className="font-semibold text-slate-900">{debouncedSearch}</span>&rdquo;
//                                     </>
//                                 )}
//                             </>
//                         )}
//                     </p>

//                     {hasFilters && (
//                         <button
//                             type="button"
//                             onClick={clearFilters}
//                             className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
//                         >
//                             <Svg className="h-4 w-4" strokeWidth={2}>
//                                 <path d="M6 6l12 12M18 6 6 18" />
//                             </Svg>
//                             Clear filters
//                         </button>
//                     )}
//                 </div>

//                 <div
//                     className={`mt-6 transition-opacity duration-200 ${isFetching && !isPending ? "opacity-60" : "opacity-100"
//                         }`}
//                 >
//                     {isPending ? (
//                         <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
//                             {Array.from({ length: PAGE_SIZE }).map((_, i) => (
//                                 <ProductSkeleton key={i} />
//                             ))}
//                         </div>
//                     ) : isError ? (
//                         <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
//                             <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
//                                 <Svg className="h-7 w-7">
//                                     <circle cx="12" cy="12" r="9" />
//                                     <path d="M12 8v5M12 16.5v.01" />
//                                 </Svg>
//                             </span>
//                             <h2 className="mt-5 text-lg font-semibold text-slate-900">
//                                 We couldn&apos;t load the products
//                             </h2>
//                             <p className="mt-2 text-sm text-slate-600">
//                                 Something went wrong. Please check your connection and try again.
//                             </p>
//                             <button type="button" onClick={() => refetch()} className={`${goldBtn} mt-6`}>
//                                 Try again
//                             </button>
//                         </div>
//                     ) : products.length === 0 ? (
//                         <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
//                             <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
//                                 <GemIcon className="h-7 w-7" />
//                             </span>
//                             <h2 className="mt-5 text-lg font-semibold text-slate-900">
//                                 {hasFilters ? "No products found" : `No products in ${category.name} yet`}
//                             </h2>
//                             <p className="mt-2 text-sm text-slate-600">
//                                 {hasFilters
//                                     ? "Try a different search or remove the filters."
//                                     : "New pieces will appear here soon."}
//                             </p>
//                             {hasFilters ? (
//                                 <button type="button" onClick={clearFilters} className={`${goldBtn} mt-6`}>
//                                     Clear filters
//                                 </button>
//                             ) : (
//                                 <Link href="/user/shop" className={`${goldBtn} mt-6`}>
//                                     Browse all products
//                                 </Link>
//                             )}
//                         </div>
//                     ) : (
//                         <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
//                             {products.map((p) => (
//                                 <ProductCard
//                                     key={p.listingId ?? `admin-${p.productId}`}
//                                     product={p}
//                                 />
//                             ))}
//                         </div>
//                     )}
//                 </div>

//                 {!isError && (
//                     <Pagination
//                         page={pagination.page}
//                         totalPages={pagination.totalPages}
//                         onChange={goToPage}
//                     />
//                 )}
//             </section>
//         </div>
//     );
// }