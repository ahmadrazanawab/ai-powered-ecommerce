// FILE: app/user/shop/[slug]/page.tsx
"use client";

import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/app/lib/axios";
import { useAddToCart } from "@/app/hooks/use-cart";
import { RelatedProducts } from "../../components/RelatedProducts";

/* ---------- edit these to match your store ---------- */
const BRAND = "Aurelia";
const CURRENCY = "$";
const LOW_STOCK_AT = 5;

/* ---------- types ---------- */
interface OfferI {
    listingId: string;
    vendorId: string;
    vendorName: string;
    price: string | number;
    stock: number;
}

interface ProductDetailI {
    productId: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    categoryId: string;
    categoryName: string;
    price: string | number;
    stock: number;
    offers: OfferI[];
}

interface PurchaseForm {
    quantity: number;
}

interface HttpErrorLike {
    response?: { status?: number; data?: { message?: string } };
}

/* ---------- shared style helpers (move to components/ui later) ---------- */
const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none";

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

const perks = [
    {
        title: "Free shipping",
        text: "On your first order",
        icon: (
            <>
                <path d="M3 7h11v9H3z" />
                <path d="M14 10h4l3 3v3h-7" />
                <circle cx="7" cy="17.5" r="1.5" />
                <circle cx="17" cy="17.5" r="1.5" />
            </>
        ),
    },
    {
        title: "Secure payments",
        text: "Protected checkout",
        icon: (
            <>
                <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
            </>
        ),
    },
    {
        title: "Easy returns",
        text: "Hassle-free process",
        icon: (
            <>
                <path d="M4 12a8 8 0 1 0 3-6.2" />
                <path d="M4 4v4h4" />
            </>
        ),
    },
];

function formatPrice(value: string | number) {
    const n = Number(value);
    if (Number.isNaN(n)) return `${CURRENCY}0.00`;
    return `${CURRENCY}${n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/* ---------- page content ---------- */
function ProductDetailContent() {
    // dynamic segment: the folder name [slug] becomes params.slug
    const { slug } = useParams<{ slug: string }>();
    const searchParams = useSearchParams();
    const listingParam = searchParams.get("listing"); // null = admin item

    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey: ["product", slug],
        queryFn: async () => (await api.get(`/api/products/product_details/${slug}`)).data,
        enabled: Boolean(slug),
        retry: 1,
    });

    const product: ProductDetailI | undefined = data?.data;
    const notFound = (error as HttpErrorLike | null)?.response?.status === 404;

    /* only the seller the user clicked on (admin item if no listing in the URL) */
    const options = useMemo(() => {
        if (!product) return [];

        const admin = {
            id: "admin",
            listingId: null as string | null,
            label: `${BRAND} Official`,
            price: product.price,
            stock: product.stock,
        };

        const vendor = listingParam
            ? product.offers.find((o) => o.listingId === listingParam)
            : undefined;

        if (vendor) {
            return [
                {
                    id: vendor.listingId,
                    listingId: vendor.listingId as string | null,
                    label: vendor.vendorName,
                    price: vendor.price,
                    stock: vendor.stock,
                },
            ];
        }

        return [admin];
    }, [product, listingParam]);

    const {
        register,
        watch,
        setValue,
        handleSubmit,
        formState: { errors },
    } = useForm<PurchaseForm>({
        defaultValues: { quantity: 1 },
    });

    const quantity = Number(watch("quantity")) || 1;
    const selected = options[0];
    const maxQty = Math.max(1, selected?.stock ?? 1);
    const outOfStock = !selected || selected.stock <= 0;
    const lowStock = !outOfStock && selected.stock <= LOW_STOCK_AT;

    // keep quantity inside the stock of the chosen seller
    useEffect(() => {
        if (selected && quantity > maxQty) setValue("quantity", maxQty);
    }, [selected, quantity, maxQty, setValue]);

    const addToCart = useAddToCart();

    const onSubmit = (values: PurchaseForm) => {
        if (!product || !selected || outOfStock) return;
        addToCart.mutate({
            productId: product.productId,
            listingId: selected.listingId,
            quantity: Number(values.quantity),
        });
    };

    const cartError = addToCart.error as HttpErrorLike | null;
    const needsLogin = cartError?.response?.status === 401;

    /* ---------- loading ---------- */
    if (isPending) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200/70" />
                <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:gap-14">
                    <div className="aspect-square animate-pulse rounded-3xl bg-slate-200/70" />
                    <div className="space-y-4">
                        <div className="h-4 w-24 animate-pulse rounded bg-slate-200/70" />
                        <div className="h-10 w-3/4 animate-pulse rounded bg-slate-200/70" />
                        <div className="h-8 w-32 animate-pulse rounded bg-slate-200/70" />
                        <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
                        <div className="h-12 animate-pulse rounded-xl bg-slate-200/70" />
                    </div>
                </div>
            </div>
        );
    }

    /* ---------- not found / error ---------- */
    if (isError || !product) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
                <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                        <GemIcon className="h-7 w-7" />
                    </span>
                    <h1 className="mt-5 text-lg font-semibold text-slate-900">
                        {notFound ? "Product not found" : "We couldn't load this product"}
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        {notFound
                            ? "It may have been removed or is no longer available."
                            : "Something went wrong. Please try again."}
                    </p>
                    <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                        {!notFound && (
                            <button type="button" onClick={() => refetch()} className={goldBtn}>
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

    /* ---------- product ---------- */
    return (
        <div className="pb-24">
            <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
                {/* breadcrumb */}
                <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
                    <Link href="/user" className="hover:text-slate-900">
                        Home
                    </Link>
                    <span className="mx-2">/</span>
                    <Link href="/user/shop" className="hover:text-slate-900">
                        Shop
                    </Link>
                    <span className="mx-2">/</span>
                    <span className="text-slate-900">{product.name}</span>
                </nav>

                <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:gap-14">
                    {/* ---------- image ---------- */}
                    <div className="lg:sticky lg:top-24 lg:self-start">
                        <div
                            className={`${cardCls} relative aspect-square overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-900`}
                        >
                            {product.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="grid h-full w-full place-items-center text-amber-200/40">
                                    <GemIcon className="h-28 w-28" />
                                </div>
                            )}

                            <span className="absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur">
                                {product.categoryName}
                            </span>
                        </div>
                    </div>

                    {/* ---------- details ---------- */}
                    <form onSubmit={handleSubmit(onSubmit)} noValidate>
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">
                            {product.categoryName}
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                            {product.name}
                        </h1>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                            <p className="text-3xl font-semibold tracking-tight text-slate-900">
                                {formatPrice(selected.price)}
                            </p>

                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${outOfStock
                                    ? "bg-rose-50 text-rose-700"
                                    : lowStock
                                        ? "bg-amber-50 text-amber-800"
                                        : "bg-emerald-50 text-emerald-700"
                                    }`}
                            >
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${outOfStock
                                        ? "bg-rose-500"
                                        : lowStock
                                            ? "bg-amber-500"
                                            : "bg-emerald-500"
                                        }`}
                                />
                                {outOfStock
                                    ? "Sold out"
                                    : lowStock
                                        ? `Only ${selected.stock} left`
                                        : "In stock"}
                            </span>
                        </div>

                        {product.description && (
                            <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-slate-600 sm:text-base">
                                {product.description}
                            </p>
                        )}

                        {/* seller (only the one that was selected) */}
                        <fieldset className="mt-8">
                            <legend className="text-sm font-semibold text-slate-900">
                                Sold by
                            </legend>
                            <div className="mt-3 grid gap-2.5">
                                {options.map((o) => (
                                    <div
                                        key={o.id}
                                        className="flex items-center justify-between gap-4 rounded-2xl bg-slate-950 p-4 text-white ring-1 ring-slate-950"
                                    >
                                        <span className="flex items-center gap-3">
                                            <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-300 ring-1 ring-amber-300">
                                                <span className="h-2 w-2 rounded-full bg-slate-950" />
                                            </span>
                                            <span>
                                                <span className="block text-sm font-medium">
                                                    {o.label}
                                                </span>
                                                <span className="block text-xs text-slate-300">
                                                    {o.stock > 0 ? `${o.stock} available` : "Sold out"}
                                                </span>
                                            </span>
                                        </span>
                                        <span className="text-base font-semibold">
                                            {formatPrice(o.price)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </fieldset>

                        {/* quantity + add to cart */}
                        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-start">
                            <div>
                                <label htmlFor="quantity" className="sr-only">
                                    Quantity
                                </label>
                                <div className="inline-flex h-12 items-center rounded-xl bg-white ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-amber-400/70">
                                    <button
                                        type="button"
                                        aria-label="Decrease quantity"
                                        disabled={outOfStock || quantity <= 1}
                                        onClick={() => setValue("quantity", Math.max(1, quantity - 1))}
                                        className="grid h-12 w-12 place-items-center text-slate-700 hover:text-slate-950 disabled:opacity-30"
                                    >
                                        <Svg className="h-4 w-4" strokeWidth={2}>
                                            <path d="M5 12h14" />
                                        </Svg>
                                    </button>

                                    <input
                                        id="quantity"
                                        type="number"
                                        inputMode="numeric"
                                        disabled={outOfStock}
                                        className="h-12 w-14 bg-transparent text-center text-sm font-semibold text-slate-900 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        {...register("quantity", {
                                            valueAsNumber: true,
                                            required: "Enter a quantity",
                                            min: { value: 1, message: "Minimum quantity is 1" },
                                            max: {
                                                value: maxQty,
                                                message: `Only ${maxQty} available`,
                                            },
                                        })}
                                    />

                                    <button
                                        type="button"
                                        aria-label="Increase quantity"
                                        disabled={outOfStock || quantity >= maxQty}
                                        onClick={() => setValue("quantity", Math.min(maxQty, quantity + 1))}
                                        className="grid h-12 w-12 place-items-center text-slate-700 hover:text-slate-950 disabled:opacity-30"
                                    >
                                        <Svg className="h-4 w-4" strokeWidth={2}>
                                            <path d="M12 5v14M5 12h14" />
                                        </Svg>
                                    </button>
                                </div>
                                {errors.quantity && (
                                    <p role="alert" className="mt-2 text-xs text-rose-600">
                                        {errors.quantity.message}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={outOfStock || addToCart.isPending}
                                className={`${goldBtn} flex-1`}
                            >
                                <Svg className="h-5 w-5">
                                    <path d="M6 7h12l-1 12H7L6 7Z" />
                                    <path d="M9 7a3 3 0 0 1 6 0" />
                                </Svg>
                                {outOfStock
                                    ? "Sold out"
                                    : addToCart.isPending
                                        ? "Adding…"
                                        : "Add to cart"}
                            </button>
                        </div>

                        {/* result messages */}
                        <div aria-live="polite" className="mt-4">
                            {addToCart.isSuccess && (
                                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                    Added to your cart.{" "}
                                    <Link href="/user/cart" className="font-semibold underline underline-offset-4">
                                        View cart
                                    </Link>
                                </p>
                            )}
                            {addToCart.isError &&
                                (needsLogin ? (
                                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                        Please{" "}
                                        <Link href="/user/login" className="font-semibold underline underline-offset-4">
                                            log in
                                        </Link>{" "}
                                        to add items to your cart.
                                    </p>
                                ) : (
                                    <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                        {cartError?.response?.data?.message ??
                                            "Could not add to cart. Please try again."}
                                    </p>
                                ))}
                        </div>

                        {/* perks */}
                        <ul className="mt-10 grid gap-3 border-t border-slate-200 pt-8 sm:grid-cols-3">
                            {perks.map((p) => (
                                <li key={p.title} className="flex items-center gap-3">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-amber-300">
                                        <Svg>{p.icon}</Svg>
                                    </span>
                                    <span>
                                        <span className="block text-sm font-semibold text-slate-900">
                                            {p.title}
                                        </span>
                                        <span className="block text-xs text-slate-500">{p.text}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </form>
                </div>
                <RelatedProducts
                    productId={product.productId}
                    categoryId={product.categoryId}
                />
            </div>
        </div>
    );
}

/* ---------- page (Suspense is required for useSearchParams) ---------- */
export default function ProductDetailPage() {
    return (
        <Suspense fallback={null}>
            <ProductDetailContent />
        </Suspense>
    );
}


