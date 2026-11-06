"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useAddToCart } from "@/app/hooks/use-cart";
import {
    useRemoveFromWishlist,
    useWishlist,
    type WishlistItemI,
} from "@/app/hooks/use-wishlist";

/* ---------- edit these to match your store ---------- */
const CURRENCY = "$";
const PAGE_SIZE = 12;
const LOW_STOCK_AT = 5;

/* ---------- types ---------- */
interface FiltersForm {
    search: string;
    sort: string;
}

const SORT_OPTIONS = [
    { value: "recent", label: "Recently added" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "name-asc", label: "Name: A to Z" },
];

const DEFAULT_FILTERS: FiltersForm = { search: "", sort: "recent" };

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
    "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

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

const HeartIcon = ({
    className = "h-5 w-5",
    filled = false,
}: {
    className?: string;
    filled?: boolean;
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d="M12 20s-7-4.4-9-9.1C1.7 7.6 3.6 4.5 6.8 4.5c1.9 0 3.5 1 5.2 3 1.7-2 3.3-3 5.2-3 3.2 0 5.1 3.1 3.8 6.4C19 15.6 12 20 12 20Z" />
    </svg>
);

const BagIcon = () => (
    <Svg className="h-4 w-4">
        <path d="M6 7h12l-1 12H7L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
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
function formatPrice(value: string | number | undefined) {
    const n = Number(value);

    if (value === undefined || Number.isNaN(n)) return `${CURRENCY}0.00`;

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

function apiMessage(err: unknown, fallback: string) {
    return (
        (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? fallback
    );
}

/* ---------- wishlist card ---------- */
function WishlistCard({
    item,
    removing,
    onRemove,
}: {
    item: WishlistItemI;
    removing: boolean;
    onRemove: (id: string) => void;
}) {
    const router = useRouter();
    const addToCart = useAddToCart();

    const name = item.name ?? "Unavailable product";
    const unavailable = !item.available;
    const stock = item.stock ?? 0;
    const outOfStock = !unavailable && stock <= 0;
    const lowStock = !unavailable && !outOfStock && stock <= LOW_STOCK_AT;
    const disabled = unavailable || outOfStock || addToCart.isPending;

    const href =
        !unavailable && item.slug
            ? `/user/shop/${item.slug}?listing=${encodeURIComponent(item.listingId)}`
            : null;

    const handleError = (err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response
            ?.status;
        if (status === 401) router.push("/user/login");
    };

    const payload = {
        productId: item.productId ?? "",
        listingId: item.listingId,
        quantity: 1,
    };

    const handleAdd = () => {
        if (disabled) return;
        addToCart.mutate(payload, { onError: handleError });
    };

    const handleBuyNow = () => {
        if (disabled) return;
        addToCart.mutate(payload, {
            onSuccess: () => router.push("/user/checkout"),
            onError: handleError,
        });
    };

    const err = addToCart.error as
        | { response?: { status?: number; data?: { message?: string } } }
        | null;

    const imageBlock = (
        <>
            <div
                className={`absolute inset-0 bg-gradient-to-br ${toneFor(item.productId ?? item.listingId)}`}
            >
                {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.imageUrl}
                        alt={name}
                        loading="lazy"
                        className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${outOfStock || unavailable
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
                {unavailable ? (
                    <span className="rounded-full bg-slate-950/85 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                        No longer available
                    </span>
                ) : outOfStock ? (
                    <span className="rounded-full bg-slate-950/85 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                        Sold out
                    </span>
                ) : lowStock ? (
                    <span className="rounded-full bg-gradient-to-br from-amber-200 to-amber-400 px-3 py-1 text-[11px] font-semibold text-slate-950">
                        Only {stock} left
                    </span>
                ) : null}
            </div>
        </>
    );

    return (
        <article
            className={`${cardCls} group relative flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-20px_rgba(15,23,42,0.3)] ${removing ? "pointer-events-none opacity-50" : ""
                }`}
        >
            {href ? (
                <Link
                    href={href}
                    className="relative block aspect-square overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
                >
                    {imageBlock}
                </Link>
            ) : (
                <div className="relative block aspect-square overflow-hidden">
                    {imageBlock}
                </div>
            )}

            {/* remove from wishlist (filled heart) */}
            <button
                type="button"
                onClick={() => onRemove(item.wishlistItemId)}
                disabled={removing}
                aria-label={`Remove ${name} from wishlist`}
                title="Remove from wishlist"
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-rose-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60"
            >
                <HeartIcon className="h-[18px] w-[18px]" filled />
            </button>

            <div className="flex flex-1 flex-col p-4 sm:p-5">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span className="line-clamp-1">
                        {item.vendorName ?? "Vendor"}
                        {item.categoryName ? ` · ${item.categoryName}` : ""}
                    </span>
                </p>

                <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold text-slate-900 sm:text-base">
                    {href ? (
                        <Link
                            href={href}
                            className="hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                            {name}
                        </Link>
                    ) : (
                        name
                    )}
                </h3>

                {unavailable ? (
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {item.message ??
                            "The vendor has removed this product. You can remove it from your wishlist."}
                    </p>
                ) : (
                    item.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                            {item.description}
                        </p>
                    )
                )}

                {!unavailable && (
                    <p className="mt-auto pt-4 text-lg font-semibold tracking-tight text-slate-900">
                        {formatPrice(item.price)}
                    </p>
                )}

                {unavailable ? (
                    <button
                        type="button"
                        onClick={() => onRemove(item.wishlistItemId)}
                        disabled={removing}
                        className="mt-auto inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-3 text-xs font-semibold text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:opacity-60 sm:text-sm"
                    >
                        {removing ? "Removing…" : "Remove"}
                    </button>
                ) : (
                    <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={handleAdd}
                            aria-label={`Add ${name} to cart`}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:text-sm"
                        >
                            <BagIcon />
                            {addToCart.isPending
                                ? "Adding…"
                                : addToCart.isSuccess
                                    ? "Added"
                                    : "Add to cart"}
                        </button>

                        <button
                            type="button"
                            disabled={disabled}
                            onClick={handleBuyNow}
                            aria-label={`Buy ${name} now`}
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-3 text-xs font-semibold text-slate-950 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 sm:text-sm"
                        >
                            Buy now
                        </button>
                    </div>
                )}

                {addToCart.isError && err?.response?.status !== 401 && (
                    <p role="alert" className="mt-2 text-xs text-rose-600">
                        {err?.response?.data?.message ?? "Could not add to cart."}
                    </p>
                )}
            </div>
        </article>
    );
}

function CardSkeleton() {
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

/* ---------- page ---------- */
export default function WishlistPage() {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [bulk, setBulk] = useState<{
        running: boolean;
        message: string | null;
    }>({ running: false, message: null });
    const gridTopRef = useRef<HTMLDivElement>(null);

    const bulkAdd = useAddToCart();
    const remove = useRemoveFromWishlist();

    const { register, watch, reset } = useForm<FiltersForm>({
        defaultValues: DEFAULT_FILTERS,
    });

    const search = watch("search");
    const sort = watch("sort");

    const { data, isPending, isError, error, isFetching, refetch } =
        useWishlist();

    // not signed in → login
    useEffect(() => {
        const code = (error as { response?: { status?: number } } | null)
            ?.response?.status;
        if (code === 401) router.push("/user/login");
    }, [error, router]);

    useEffect(() => {
        const sub = watch(() => setPage(1));
        return () => sub.unsubscribe();
    }, [watch]);

    const allItems: WishlistItemI[] = useMemo(
        () => (Array.isArray(data?.data?.items) ? data.data.items : []),
        [data]
    );

    const items = useMemo(() => {
        const q = search.trim().toLowerCase();

        const filtered = q
            ? allItems.filter((i) =>
                [i.name, i.vendorName, i.categoryName]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(q))
            )
            : allItems.slice();

        const price = (i: WishlistItemI) => Number(i.price ?? 0);

        switch (sort) {
            case "price-asc":
                return filtered.sort((a, b) => price(a) - price(b));
            case "price-desc":
                return filtered.sort((a, b) => price(b) - price(a));
            case "name-asc":
                return filtered.sort((a, b) =>
                    (a.name ?? "").localeCompare(b.name ?? "")
                );
            default:
                // recently added: use addedAt when the API sends it, else keep API order
                return filtered.sort((a, b) =>
                    a.addedAt && b.addedAt
                        ? new Date(b.addedAt).getTime() -
                        new Date(a.addedAt).getTime()
                        : 0
                );
        }
    }, [allItems, search, sort]);

    const buyable = allItems.filter(
        (i) => i.available && (i.stock ?? 0) > 0 && i.productId
    );

    const hasFilters = search.trim() !== "" || sort !== DEFAULT_FILTERS.sort;

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const visible = items.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE
    );

    const goToPage = (p: number) => {
        setPage(p);
        gridTopRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    const addAllToCart = async () => {
        setBulk({ running: true, message: null });

        let added = 0;
        let failed = 0;

        for (const item of buyable) {
            try {
                await bulkAdd.mutateAsync({
                    productId: item.productId!,
                    listingId: item.listingId,
                    quantity: 1,
                });
                added++;
            } catch (err) {
                const status = (err as { response?: { status?: number } })
                    ?.response?.status;

                if (status === 401) {
                    router.push("/user/login");
                    setBulk({ running: false, message: null });
                    return;
                }
                failed++;
            }
        }

        setBulk({
            running: false,
            message:
                failed === 0
                    ? `Added ${added} ${added === 1 ? "item" : "items"} to your cart.`
                    : `Added ${added}, but ${failed} could not be added (stock or price may have changed).`,
        });
    };

    const removingId = remove.isPending ? remove.variables : null;

    const pageBtn =
        "grid h-11 min-w-11 place-items-center rounded-xl px-3 text-sm font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";

    return (
        <div className="pb-24">
            {/* ================= HEADER BAND ================= */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
                <GridTexture />

                <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
                    <nav
                        aria-label="Breadcrumb"
                        className="text-xs text-slate-300"
                    >
                        <Link href="/user" className="hover:text-white">
                            Home
                        </Link>
                        <span className="mx-2 text-slate-500">/</span>
                        <span className="text-amber-200">Wishlist</span>
                    </nav>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-2xl">
                            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-amber-300">
                                <HeartIcon className="h-3.5 w-3.5" filled />
                                Saved for later
                            </p>

                            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                                Your{" "}
                                <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text text-transparent">
                                    wishlist
                                </span>
                            </h1>

                            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                                The pieces you love, all in one place. Move them
                                to your cart whenever you&apos;re ready.
                            </p>
                        </div>

                        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-amber-200 ring-1 ring-white/15 backdrop-blur">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                            {isPending
                                ? "Loading…"
                                : `${allItems.length} ${allItems.length === 1 ? "item" : "items"
                                } saved`}
                        </span>
                    </div>
                </div>
            </section>

            {/* ================= TOOLBAR ================= */}
            <section className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 sm:-mt-14 sm:px-6 lg:px-8">
                <div className={`${cardCls} p-4 sm:p-5`}>
                    <form
                        onSubmit={(e) => e.preventDefault()}
                        className="grid gap-3 md:grid-cols-[1fr_16rem_auto]"
                        role="search"
                    >
                        <div className="relative">
                            <label htmlFor="wish-search" className="sr-only">
                                Search wishlist
                            </label>

                            <Svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500">
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-3.5-3.5" />
                            </Svg>

                            <input
                                id="wish-search"
                                type="search"
                                autoComplete="off"
                                placeholder="Search your wishlist…"
                                className={`${fieldCls} pl-12 pr-4`}
                                {...register("search")}
                            />
                        </div>

                        <div className="relative">
                            <label htmlFor="wish-sort" className="sr-only">
                                Sort wishlist
                            </label>

                            <select
                                id="wish-sort"
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

                        <button
                            type="button"
                            onClick={addAllToCart}
                            disabled={buyable.length === 0 || bulk.running}
                            className={`${goldBtn} h-12 whitespace-nowrap`}
                        >
                            {bulk.running
                                ? "Adding…"
                                : `Add all to cart${buyable.length > 0
                                    ? ` (${buyable.length})`
                                    : ""
                                }`}
                        </button>
                    </form>
                </div>
            </section>

            {/* ================= RESULTS ================= */}
            <section
                ref={gridTopRef}
                className="mx-auto mt-10 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8"
            >
                <div aria-live="polite" className="space-y-2">
                    {bulk.message && (
                        <p
                            role="status"
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200"
                        >
                            <span>{bulk.message}</span>
                            <Link
                                href="/user/checkout"
                                className="font-semibold underline underline-offset-4"
                            >
                                Go to checkout
                            </Link>
                        </p>
                    )}

                    {remove.isError && (
                        <p
                            role="alert"
                            className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
                        >
                            {apiMessage(
                                remove.error,
                                "Could not remove this item."
                            )}
                        </p>
                    )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">
                        {isPending ? (
                            "Loading your wishlist…"
                        ) : (
                            <>
                                <span className="font-semibold text-slate-900">
                                    {items.length}
                                </span>{" "}
                                {items.length === 1 ? "item" : "items"}
                                {search.trim() && (
                                    <>
                                        {" "}for &ldquo;
                                        <span className="font-semibold text-slate-900">
                                            {search.trim()}
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
                            onClick={() => {
                                reset(DEFAULT_FILTERS);
                                setPage(1);
                            }}
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
                            {Array.from({ length: 8 }).map((_, i) => (
                                <CardSkeleton key={i} />
                            ))}
                        </div>
                    ) : isError ? (
                        <div
                            className={`${cardCls} mx-auto max-w-lg p-8 text-center sm:p-10`}
                        >
                            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                                <Svg className="h-7 w-7">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 8v5M12 16.5v.01" />
                                </Svg>
                            </span>

                            <h2 className="mt-5 text-lg font-semibold text-slate-900">
                                We couldn&apos;t load your wishlist
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
                    ) : items.length === 0 ? (
                        <div
                            className={`${cardCls} mx-auto max-w-lg p-8 text-center sm:p-10`}
                        >
                            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                                <HeartIcon className="h-7 w-7" />
                            </span>

                            <h2 className="mt-5 text-lg font-semibold text-slate-900">
                                {hasFilters
                                    ? "No saved items match"
                                    : "Your wishlist is empty"}
                            </h2>

                            <p className="mt-2 text-sm text-slate-600">
                                {hasFilters
                                    ? "Try a different search."
                                    : "Tap the heart on any product to save it here for later."}
                            </p>

                            {hasFilters ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        reset(DEFAULT_FILTERS);
                                        setPage(1);
                                    }}
                                    className={`${goldBtn} mt-6`}
                                >
                                    Clear filters
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
                        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                            {visible.map((item) => (
                                <WishlistCard
                                    key={item.wishlistItemId}
                                    item={item}
                                    removing={removingId === item.wishlistItemId}
                                    onRemove={(id) => remove.mutate(id)}
                                />
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
                                    onClick={() => goToPage(p)}
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
                            onClick={() => goToPage(safePage + 1)}
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
            </section>
        </div>
    );
}