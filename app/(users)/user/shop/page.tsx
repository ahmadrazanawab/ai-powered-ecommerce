
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/app/lib/axios";
import { useRouter } from "next/navigation";
import { useAddToCart } from "@/app/hooks/use-cart";


/* ---------- edit these to match your store ---------- */
const BRAND = "Aurelia";
const CURRENCY = "$";
const PAGE_SIZE = 12;
const LOW_STOCK_AT = 5;

/* ---------- types ---------- */
interface CategoryI {
    categoryId: string;
    name: string;
    slug: string;
}

interface ProductI {
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

interface PaginationI {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface FiltersForm {
    search: string;
    categoryId: string;
    sort: string;
}

const SORT_OPTIONS = [
    { value: "newest-desc", label: "Newest first" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "name-asc", label: "Name: A to Z" },
    { value: "name-desc", label: "Name: Z to A" },
];

const DEFAULT_FILTERS: FiltersForm = {
    search: "",
    categoryId: "",
    sort: "newest-desc",
};

/* fallback gradients for products without an image */
const TONES = [
    "from-slate-900 to-indigo-900",
    "from-indigo-950 to-slate-800",
    "from-slate-800 to-slate-950",
    "from-amber-900 to-slate-900",
];

/* ---------- shared style helpers ---------- */
const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

const fieldCls =
    "h-12 w-full rounded-xl bg-white text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-amber-400/70";

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
function useDebounce<T>(value: T, delay = 400) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);

    return debounced;
}

function formatPrice(value: string | number) {
    const n = Number(value);

    if (Number.isNaN(n)) return `${CURRENCY}0.00`;

    return `${CURRENCY}${n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function toneFor(id: string) {
    let hash = 0;

    for (let i = 0; i < id.length; i++) {
        hash = (hash + id.charCodeAt(i)) % 997;
    }

    return TONES[hash % TONES.length];
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

/* ---------- product card ---------- */

function ProductCard({ product }: { product: ProductI }) {
    const router = useRouter();
    const addToCart = useAddToCart();

    const isVendorProduct =
        typeof product.listingId === "string" &&
        product.listingId.trim().length > 0;

    const outOfStock = product.stock <= 0;
    const lowStock = !outOfStock && product.stock <= LOW_STOCK_AT;

    const seller = product.vendorName ?? "Vendor";

    // Always retain the selected vendor listing.
    const href = isVendorProduct
        ? `/user/shop/${product.slug}?listing=${encodeURIComponent(product.listingId!)}`
        : "#";

    const cartError = addToCart.error as
        | {
              response?: {
                  status?: number;
                  data?: { message?: string };
              };
          }
        | null;

    const handleError = (err: unknown) => {
        const status = (
            err as { response?: { status?: number } }
        )?.response?.status;

        if (status === 401) {
            router.push("/user/login");
        }
    };

    const handleAddToCart = () => {
        if (!isVendorProduct || outOfStock) return;

        addToCart.mutate(
            {
                productId: product.productId,
                listingId: product.listingId!,
                quantity: 1,
            },
            {
                onError: handleError,
            }
        );
    };

    const handleBuyNow = () => {
        if (!isVendorProduct || outOfStock) return;

        addToCart.mutate(
            {
                productId: product.productId,
                listingId: product.listingId!,
                quantity: 1,
            },
            {
                onSuccess: () => router.push("/user/checkout"),
                onError: handleError,
            }
        );
    };

    // Never render admin products.
    if (!isVendorProduct) return null;

    return (
        <article
            className={`${cardCls} group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-20px_rgba(15,23,42,0.3)]`}
        >
            <Link
                href={href}
                className="relative block aspect-square overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
            >
                <div
                    className={`absolute inset-0 bg-gradient-to-br ${toneFor(product.productId)}`}
                >
                    {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            loading="lazy"
                            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                                outOfStock
                                    ? "opacity-60 grayscale"
                                    : ""
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
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span className="line-clamp-1">{seller}</span>
                </p>

                <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold text-slate-900 sm:text-base">
                    <Link
                        href={href}
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

                <p className="mt-auto pt-4 text-lg font-semibold tracking-tight text-slate-900">
                    {formatPrice(product.price)}
                </p>

                {/* Buy + Add to cart */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        disabled={outOfStock || addToCart.isPending}
                        onClick={handleAddToCart}
                        aria-label={`Add ${product.name} to cart`}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:text-sm"
                    >
                        <Svg className="h-4 w-4">
                            <path d="M6 7h12l-1 12H7L6 7Z" />
                            <path d="M9 7a3 3 0 0 1 6 0" />
                        </Svg>

                        {addToCart.isPending
                            ? "Adding…"
                            : addToCart.isSuccess
                              ? "Added"
                              : "Add to cart"}
                    </button>

                    <button
                        type="button"
                        disabled={outOfStock || addToCart.isPending}
                        onClick={handleBuyNow}
                        aria-label={`Buy ${product.name} now`}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-3 text-xs font-semibold text-slate-950 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 sm:text-sm"
                    >
                        Buy now
                    </button>
                </div>

                {addToCart.isError && cartError?.response?.status !== 401 && (
                    <p role="alert" className="mt-2 text-xs text-rose-600">
                        {cartError?.response?.data?.message ??
                            "Could not add to cart."}
                    </p>
                )}
            </div>
        </article>
    );
}


function ProductSkeleton() {
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
function Pagination({
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
        <nav
            aria-label="Pagination"
            className="mt-12 flex flex-wrap items-center justify-center gap-2"
        >
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
                        onClick={() => onChange(p)}
                        aria-current={p === page ? "page" : undefined}
                        className={`${base} ${
                            p === page
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

/* ---------- page ---------- */
export default function ShopPage() {
    const [page, setPage] = useState(1);
    const gridTopRef = useRef<HTMLDivElement>(null);

    const { register, watch, setValue, reset } = useForm<FiltersForm>({
        defaultValues: DEFAULT_FILTERS,
    });

    const search = watch("search");
    const categoryId = watch("categoryId");
    const sort = watch("sort");

    const debouncedSearch = useDebounce(search.trim(), 400);
    const [sortBy, sortOrder] = sort.split("-");

    // go back to page 1 whenever a filter changes
    useEffect(() => {
        const sub = watch(() => setPage(1));
        return () => sub.unsubscribe();
    }, [watch]);

    /* categories */
    const { data: catData } = useQuery({
        queryKey: ["categories"],
        queryFn: async () => (await api.get("/api/categories")).data,
        staleTime: 5 * 60 * 1000,
    });

    const categories: CategoryI[] = Array.isArray(catData?.data)
        ? catData.data
        : [];

    /* products */
    const { data, isPending, isError, isFetching, refetch } = useQuery({
        queryKey: [
            "products",
            { search: debouncedSearch, categoryId, sortBy, sortOrder, page },
        ],
        queryFn: async () => {
            const res = await api.get("/api/products", {
                params: {
                    search: debouncedSearch || undefined,
                    categoryId: categoryId || undefined,
                    sortBy,
                    sortOrder,
                    page,
                    limit: PAGE_SIZE,
                },
            });

            return res.data;
        },
        placeholderData: keepPreviousData,
    });

    /*
     * IMPORTANT:
     * Only vendor products with a valid listingId are displayed.
     * Admin products have no vendor listingId and are excluded.
     */
    const allProducts: ProductI[] = Array.isArray(data?.data)
        ? data.data
        : [];

    const products: ProductI[] = allProducts.filter(
        (product) =>
            product.source === "vendor" &&
            typeof product.listingId === "string" &&
            product.listingId.trim().length > 0
    );

    const pagination: PaginationI = data?.pagination ?? {
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1,
    };

    const hasFilters =
        search.trim() !== "" ||
        categoryId !== "" ||
        sort !== DEFAULT_FILTERS.sort;

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

    const activeCategory = categories.find(
        (c) => c.categoryId === categoryId
    );

    return (
        <div className="pb-24">
            {/* ================= HEADER BAND ================= */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
                <GridTexture />

                <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
                    <nav aria-label="Breadcrumb" className="text-xs text-slate-300">
                        <Link href="/user" className="hover:text-white">
                            Home
                        </Link>
                        <span className="mx-2 text-slate-500">/</span>
                        <span className="text-amber-200">Shop</span>
                    </nav>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">
                                The collection
                            </p>

                            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                                Shop{" "}
                                <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text text-transparent">
                                    all pieces
                                </span>
                            </h1>

                            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                                Handpicked products from {BRAND} and our trusted vendors,
                                chosen for quality, craft and lasting style.
                            </p>
                        </div>

                        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-amber-200 ring-1 ring-white/15 backdrop-blur">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                            {isPending ? "Loading…" : `${products.length} products`}
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
                        {/* search */}
                        <div className="relative">
                            <label htmlFor="shop-search" className="sr-only">
                                Search products
                            </label>

                            <Svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500">
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-3.5-3.5" />
                            </Svg>

                            <input
                                id="shop-search"
                                type="search"
                                autoComplete="off"
                                placeholder="Search products, categories…"
                                className={`${fieldCls} pl-12 pr-4`}
                                {...register("search")}
                            />
                        </div>

                        {/* sort */}
                        <div className="relative">
                            <label htmlFor="shop-sort" className="sr-only">
                                Sort products
                            </label>

                            <select
                                id="shop-sort"
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

                    {/* category chips */}
                    <div
                        className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        role="group"
                        aria-label="Filter by category"
                    >
                        {[{ categoryId: "", name: "All" } as CategoryI, ...categories].map(
                            (c) => {
                                const active = categoryId === c.categoryId;

                                return (
                                    <button
                                        key={c.categoryId || "all"}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() =>
                                            setValue("categoryId", c.categoryId, {
                                                shouldDirty: true,
                                            })
                                        }
                                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                                            active
                                                ? "bg-slate-950 text-amber-300 shadow-md shadow-slate-950/20"
                                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        }`}
                                    >
                                        {c.name}
                                    </button>
                                );
                            }
                        )}
                    </div>
                </div>
            </section>

            {/* ================= RESULTS ================= */}
            <section
                ref={gridTopRef}
                className="mx-auto mt-10 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8"
            >
                {/* summary row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600" aria-live="polite">
                        {isPending ? (
                            "Loading products…"
                        ) : (
                            <>
                                <span className="font-semibold text-slate-900">
                                    {products.length}
                                </span>{" "}
                                {products.length === 1 ? "product" : "products"}

                                {activeCategory && (
                                    <>
                                        {" "}in{" "}
                                        <span className="font-semibold text-slate-900">
                                            {activeCategory.name}
                                        </span>
                                    </>
                                )}

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
                    className={`mt-6 transition-opacity duration-200 ${
                        isFetching && !isPending ? "opacity-60" : "opacity-100"
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
                                No products found
                            </h2>

                            <p className="mt-2 text-sm text-slate-600">
                                {hasFilters
                                    ? "Try a different search or remove some filters."
                                    : "New pieces will appear here soon."}
                            </p>

                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className={`${goldBtn} mt-6`}
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                            {products.map((p) => (
                                <ProductCard
                                    key={p.listingId!}
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

// import { useEffect, useRef, useState, type ReactNode } from "react";
// import Link from "next/link";
// import { keepPreviousData, useQuery } from "@tanstack/react-query";
// import { useForm } from "react-hook-form";
// import { api } from "@/app/lib/axios";
// import { RelatedProducts } from "../components/RelatedProducts";

// /* ---------- edit these to match your store ---------- */
// const BRAND = "Aurelia";
// const CURRENCY = "$";
// const PAGE_SIZE = 12;
// const LOW_STOCK_AT = 5;

// /* ---------- types ---------- */
// interface CategoryI {
//     categoryId: string;
//     name: string;
//     slug: string;
// }

// interface ProductI {
//     productId: string;
//     listingId: string | null;
//     name: string;
//     slug: string;
//     description: string | null;
//     imageUrl: string | null;
//     categoryId: string;
//     categoryName: string;
//     price: string | number;
//     stock: number;
//     vendorId: string | null;
//     vendorName: string | null;
//     source: "admin" | "vendor";
// }

// interface PaginationI {
//     page: number;
//     limit: number;
//     total: number;
//     totalPages: number;
// }

// interface FiltersForm {
//     search: string;
//     categoryId: string;
//     sort: string;
// }

// const SORT_OPTIONS = [
//     { value: "newest-desc", label: "Newest first" },
//     { value: "price-asc", label: "Price: low to high" },
//     { value: "price-desc", label: "Price: high to low" },
//     { value: "name-asc", label: "Name: A to Z" },
//     { value: "name-desc", label: "Name: Z to A" },
// ];

// const DEFAULT_FILTERS: FiltersForm = {
//     search: "",
//     categoryId: "",
//     sort: "newest-desc",
// };

// /* fallback gradients for products without an image (full class strings on purpose) */
// const TONES = [
//     "from-slate-900 to-indigo-900",
//     "from-indigo-950 to-slate-800",
//     "from-slate-800 to-slate-950",
//     "from-amber-900 to-slate-900",
// ];

// /* ---------- shared style helpers (move to components/ui later) ---------- */
// const cardCls =
//     "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

// const goldBtn =
//     "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

// const fieldCls =
//     "h-12 w-full rounded-xl bg-white text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-amber-400/70";

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

// const GemIcon = ({ className }: { className?: string }) => (
//     <Svg className={className} strokeWidth={1.5}>
//         <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
//         <path d="M3 9h18M9 4l3 5 3-5M12 9v11" />
//     </Svg>
// );

// const GridTexture = ({ opacity = "opacity-[0.07]" }: { opacity?: string }) => (
//     <div
//         className={`pointer-events-none absolute inset-0 ${opacity}`}
//         style={{
//             backgroundImage:
//                 "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
//             backgroundSize: "44px 44px",
//         }}
//     />
// );

// /* ---------- helpers ---------- */
// function useDebounce<T>(value: T, delay = 400) {
//     const [debounced, setDebounced] = useState(value);
//     useEffect(() => {
//         const t = setTimeout(() => setDebounced(value), delay);
//         return () => clearTimeout(t);
//     }, [value, delay]);
//     return debounced;
// }

// function formatPrice(value: string | number) {
//     const n = Number(value);
//     if (Number.isNaN(n)) return `${CURRENCY}0.00`;
//     return `${CURRENCY}${n.toLocaleString("en-US", {
//         minimumFractionDigits: 2,
//         maximumFractionDigits: 2,
//     })}`;
// }

// function toneFor(id: string) {
//     let hash = 0;
//     for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 997;
//     return TONES[hash % TONES.length];
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

// /* ---------- product card ---------- */
// function ProductCard({ product }: { product: ProductI }) {
//     const outOfStock = product.stock <= 0;
//     const lowStock = !outOfStock && product.stock <= LOW_STOCK_AT;
//     const seller = product.vendorName ?? `${BRAND} Official`;

//     // keep the selected seller when opening the product page
//     const href = product.listingId
//         ? `/user/shop/${product.slug}?listing=${encodeURIComponent(product.listingId)}`
//         : `/user/shop/${product.slug}?source=admin`;
//     return (
//         <article
//             className={`${cardCls} group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-20px_rgba(15,23,42,0.3)]`}
//         >
//             <Link
//                 href={href}
//                 className="relative block aspect-square overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
//             >
//                 <div className={`absolute inset-0 bg-gradient-to-br ${toneFor(product.productId)}`}>
//                     {product.imageUrl ? (
//                         // eslint-disable-next-line @next/next/no-img-element
//                         <img
//                             src={product.imageUrl}
//                             alt={product.name}
//                             loading="lazy"
//                             className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${outOfStock ? "opacity-60 grayscale" : ""
//                                 }`}
//                         />
//                     ) : (
//                         <div className="grid h-full w-full place-items-center text-amber-200/40 transition-transform duration-500 group-hover:scale-110">
//                             <GemIcon className="h-16 w-16 sm:h-20 sm:w-20" />
//                         </div>
//                     )}
//                 </div>

//                 <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/40 to-transparent" />

//                 {/* badges */}
//                 <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
//                     {outOfStock ? (
//                         <span className="rounded-full bg-slate-950/85 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
//                             Sold out
//                         </span>
//                     ) : lowStock ? (
//                         <span className="rounded-full bg-gradient-to-br from-amber-200 to-amber-400 px-3 py-1 text-[11px] font-semibold text-slate-950">
//                             Only {product.stock} left
//                         </span>
//                     ) : null}
//                 </div>

//                 <span className="absolute right-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur">
//                     {product.categoryName}
//                 </span>
//             </Link>

//             <div className="flex flex-1 flex-col p-4 sm:p-5">
//                 <p className="flex items-center gap-1.5 text-xs text-slate-500">
//                     <span
//                         className={`h-1.5 w-1.5 rounded-full ${product.source === "vendor" ? "bg-indigo-500" : "bg-amber-400"
//                             }`}
//                     />
//                     <span className="line-clamp-1">{seller}</span>
//                 </p>

//                 <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold text-slate-900 sm:text-base">
//                     <Link
//                         // href={`/user/shop/${product.slug}`}
//                         href={href}
//                         className="hover:underline focus-visible:outline-none focus-visible:underline"
//                     >
//                         {product.name}
//                     </Link>
//                 </h3>

//                 {product.description && (
//                     <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
//                         {product.description}
//                     </p>
//                 )}

//                 <div className="mt-auto flex items-center justify-between gap-2 pt-4">
//                     <p className="text-lg font-semibold tracking-tight text-slate-900">
//                         {formatPrice(product.price)}
//                     </p>

//                     <button
//                         type="button"
//                         disabled={outOfStock}
//                         aria-label={`Add ${product.name} to cart`}
//                         // TODO: connect to your cart mutation
//                         onClick={() => undefined}
//                         className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
//                     >
//                         <Svg className="h-5 w-5">
//                             <path d="M6 7h12l-1 12H7L6 7Z" />
//                             <path d="M9 7a3 3 0 0 1 6 0" />
//                         </Svg>
//                     </button>
//                 </div>
//             </div>

//         </article>
//     );
// }

// function ProductSkeleton() {
//     return (
//         <div className={`${cardCls} overflow-hidden`}>
//             <div className="aspect-square animate-pulse bg-slate-200/70" />
//             <div className="space-y-3 p-4 sm:p-5">
//                 <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200/70" />
//                 <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/70" />
//                 <div className="flex items-center justify-between pt-2">
//                     <div className="h-5 w-16 animate-pulse rounded bg-slate-200/70" />
//                     <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200/70" />
//                 </div>
//             </div>
//         </div>
//     );
// }

// /* ---------- pagination ---------- */
// function Pagination({
//     page,
//     totalPages,
//     onChange,
// }: {
//     page: number;
//     totalPages: number;
//     onChange: (p: number) => void;
// }) {
//     if (totalPages <= 1) return null;

//     const base =
//         "grid h-11 min-w-11 place-items-center rounded-xl px-3 text-sm font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";

//     return (
//         <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
//             <button
//                 type="button"
//                 onClick={() => onChange(page - 1)}
//                 disabled={page <= 1}
//                 aria-label="Previous page"
//                 className={`${base} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
//             >
//                 <Svg className="h-4 w-4" strokeWidth={2}>
//                     <path d="m15 6-6 6 6 6" />
//                 </Svg>
//             </button>

//             {getPages(page, totalPages).map((p, i) =>
//                 p === "…" ? (
//                     <span key={`dots-${i}`} className="px-1 text-slate-500" aria-hidden="true">
//                         …
//                     </span>
//                 ) : (
//                     <button
//                         key={p}
//                         type="button"
//                         onClick={() => onChange(p)}
//                         aria-current={p === page ? "page" : undefined}
//                         className={`${base} ${p === page
//                             ? "bg-slate-950 text-amber-300 ring-slate-950"
//                             : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
//                             }`}
//                     >
//                         {p}
//                     </button>
//                 )
//             )}

//             <button
//                 type="button"
//                 onClick={() => onChange(page + 1)}
//                 disabled={page >= totalPages}
//                 aria-label="Next page"
//                 className={`${base} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
//             >
//                 <Svg className="h-4 w-4" strokeWidth={2}>
//                     <path d="m9 6 6 6-6 6" />
//                 </Svg>
//             </button>
//         </nav>
//     );
// }

// /* ---------- page ---------- */
// export default function ShopPage() {
//     const [page, setPage] = useState(1);
//     const gridTopRef = useRef<HTMLDivElement>(null);

//     const { register, watch, setValue, reset } = useForm<FiltersForm>({
//         defaultValues: DEFAULT_FILTERS,
//     });

//     const search = watch("search");
//     const categoryId = watch("categoryId");
//     const sort = watch("sort");

//     const debouncedSearch = useDebounce(search.trim(), 400);
//     const [sortBy, sortOrder] = sort.split("-");

//     // go back to page 1 whenever a filter changes
//     useEffect(() => {
//         const sub = watch(() => setPage(1));
//         return () => sub.unsubscribe();
//     }, [watch]);

//     /* categories (same endpoint as the home page) */
//     const { data: catData } = useQuery({
//         queryKey: ["categories"],
//         queryFn: async () => (await api.get("/api/categories")).data,
//         staleTime: 5 * 60 * 1000,
//     });
//     const categories: CategoryI[] = Array.isArray(catData?.data) ? catData.data : [];

//     /* products */
//     const { data, isPending, isError, isFetching, refetch } = useQuery({
//         queryKey: ["products", { search: debouncedSearch, categoryId, sortBy, sortOrder, page }],
//         queryFn: async () => {
//             const res = await api.get("/api/products", {
//                 params: {
//                     search: debouncedSearch || undefined,
//                     categoryId: categoryId || undefined,
//                     sortBy,
//                     sortOrder,
//                     page,
//                     limit: PAGE_SIZE,
//                 },
//             });
//             return res.data;
//         },
//         placeholderData: keepPreviousData,
//     });

//     const products: ProductI[] = Array.isArray(data?.data) ? data.data : [];
//     const pagination: PaginationI = data?.pagination ?? {
//         page: 1,
//         limit: PAGE_SIZE,
//         total: 0,
//         totalPages: 1,
//     };

//     const hasFilters =
//         search.trim() !== "" || categoryId !== "" || sort !== DEFAULT_FILTERS.sort;

//     const clearFilters = () => {
//         reset(DEFAULT_FILTERS);
//         setPage(1);
//     };

//     const goToPage = (p: number) => {
//         setPage(p);
//         gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
//     };

//     const activeCategory = categories.find((c) => c.categoryId === categoryId);

//     return (
//         <div className="pb-24">
//             {/* ================= HEADER BAND ================= */}
//             <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
//                 <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
//                 <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
//                 <GridTexture />

//                 <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
//                     <nav aria-label="Breadcrumb" className="text-xs text-slate-300">
//                         <Link href="/user" className="hover:text-white">
//                             Home
//                         </Link>
//                         <span className="mx-2 text-slate-500">/</span>
//                         <span className="text-amber-200">Shop</span>
//                     </nav>

//                     <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
//                         <div className="max-w-2xl">
//                             <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">
//                                 The collection
//                             </p>
//                             <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
//                                 Shop{" "}
//                                 <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text text-transparent">
//                                     all pieces
//                                 </span>
//                             </h1>
//                             <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
//                                 Handpicked products from {BRAND} and our trusted vendors,
//                                 chosen for quality, craft and lasting style.
//                             </p>
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
//                         {/* search */}
//                         <div className="relative">
//                             <label htmlFor="shop-search" className="sr-only">
//                                 Search products
//                             </label>
//                             <Svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500">
//                                 <circle cx="11" cy="11" r="7" />
//                                 <path d="m20 20-3.5-3.5" />
//                             </Svg>
//                             <input
//                                 id="shop-search"
//                                 type="search"
//                                 autoComplete="off"
//                                 placeholder="Search products, categories…"
//                                 className={`${fieldCls} pl-12 pr-4`}
//                                 {...register("search")}
//                             />
//                         </div>

//                         {/* sort */}
//                         <div className="relative">
//                             <label htmlFor="shop-sort" className="sr-only">
//                                 Sort products
//                             </label>
//                             <select
//                                 id="shop-sort"
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

//                     {/* category chips */}
//                     <div
//                         className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
//                         role="group"
//                         aria-label="Filter by category"
//                     >
//                         {[{ categoryId: "", name: "All" } as CategoryI, ...categories].map((c) => {
//                             const active = categoryId === c.categoryId;
//                             return (
//                                 <button
//                                     key={c.categoryId || "all"}
//                                     type="button"
//                                     aria-pressed={active}
//                                     onClick={() => setValue("categoryId", c.categoryId, { shouldDirty: true })}
//                                     className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active
//                                         ? "bg-slate-950 text-amber-300 shadow-md shadow-slate-950/20"
//                                         : "bg-slate-100 text-slate-700 hover:bg-slate-200"
//                                         }`}
//                                 >
//                                     {c.name}
//                                 </button>
//                             );
//                         })}
//                     </div>
                   
             
//                 </div>
//             </section>

//             {/* ================= RESULTS ================= */}
//             <section ref={gridTopRef} className="mx-auto mt-10 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
//                 {/* summary row */}
//                 <div className="flex flex-wrap items-center justify-between gap-3">
//                     <p className="text-sm text-slate-600" aria-live="polite">
//                         {isPending ? (
//                             "Loading products…"
//                         ) : (
//                             <>
//                                 <span className="font-semibold text-slate-900">{pagination.total}</span>{" "}
//                                 {pagination.total === 1 ? "product" : "products"}
//                                 {activeCategory && (
//                                     <>
//                                         {" "}in <span className="font-semibold text-slate-900">{activeCategory.name}</span>
//                                     </>
//                                 )}
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
//                             <h2 className="mt-5 text-lg font-semibold text-slate-900">No products found</h2>
//                             <p className="mt-2 text-sm text-slate-600">
//                                 {hasFilters
//                                     ? "Try a different search or remove some filters."
//                                     : "New pieces will appear here soon."}
//                             </p>
//                             {hasFilters && (
//                                 <button type="button" onClick={clearFilters} className={`${goldBtn} mt-6`}>
//                                     Clear filters
//                                 </button>
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
