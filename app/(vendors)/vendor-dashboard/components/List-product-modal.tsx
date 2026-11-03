// FILE: app/components/vendor/list-product-modal.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/app/lib/axios";
import { CURRENCY, GemIcon, Svg, fieldCls, goldBtn } from "@/app/components/Shop-ui";
import type { CatalogProductI } from "../components/Catalog-card";


/* ---------- CHECK THIS AGAINST YOUR vendor-products/route.ts ---------- */
const LISTING_ENDPOINT = "/api/auth/vendor/vendor-product";
// body sent: { productId, price, stock }

interface FormValues {
    price: number;
    stock: number;
    isActive?: boolean;
}

interface HttpErrorLike {
    response?: { data?: { message?: string } };
}

interface Props {
    product: CatalogProductI;
    categoryName?: string;
    onClose: () => void;
}

export default function ListProductModal({ product, categoryName, onClose }: Props) {
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        setFocus,
        formState: { errors },
    } = useForm<FormValues>({ defaultValues: { stock: 1 } });

    const mutation = useMutation({
        mutationFn: async (values: FormValues) =>
            (
                await api.post(LISTING_ENDPOINT, {
                    productId: product.id,
                    price: values.price,
                    stock: values.stock, 
                })
            ).data,
        onSuccess: () => {
            // refresh the "My listings" page data
            queryClient.invalidateQueries({ queryKey: ["vendor-listings"] });
        },
    });

    // focus the price field, close on Escape, lock page scroll while open
    useEffect(() => {
        setFocus("price");
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [setFocus, onClose]);

    const errorMessage =
        (mutation.error as HttpErrorLike | null)?.response?.data?.message ??
        "Could not create the listing. Please try again.";

    return (
        <div
            className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/60 backdrop-blur-sm sm:place-items-center sm:p-4"
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="list-product-title"
                className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200/70 sm:max-w-md sm:rounded-3xl"
            >
                {mutation.isSuccess ? (
                    /* ---------- success ---------- */
                    <div className="p-8 text-center">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <Svg className="h-7 w-7" strokeWidth={2}>
                                <path d="m5 12 5 5 9-10" />
                            </Svg>
                        </span>
                        <h2 id="list-product-title" className="mt-5 text-lg font-semibold text-slate-900">
                            Listed successfully
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            <span className="font-medium text-slate-900">{product.name}</span> is now in your
                            listings. It may need approval before customers can see it.
                        </p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Link href="/vendor-dashboard/products" className={goldBtn}>
                                View my listings
                            </Link>
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex h-12 items-center justify-center rounded-xl px-7 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                                Keep browsing
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ---------- form ---------- */
                    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 text-amber-200/50">
                                    {product.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <GemIcon className="h-7 w-7" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-700">
                                        List product
                                    </p>
                                    <h2
                                        id="list-product-title"
                                        className="truncate text-base font-semibold text-slate-900"
                                    >
                                        {product.name}
                                    </h2>
                                    {categoryName && (
                                        <p className="truncate text-xs text-slate-500">{categoryName}</p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                                <Svg className="h-5 w-5" strokeWidth={2}>
                                    <path d="M6 6l12 12M18 6 6 18" />
                                </Svg>
                            </button>
                        </div>

                        <div className="space-y-5 p-5 sm:p-6">
                            {/* price */}
                            <div>
                                <label htmlFor="listing-price" className="text-sm font-medium text-slate-900">
                                    Your price
                                </label>
                                <div className="relative mt-2">
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                                        {CURRENCY}
                                    </span>
                                    <input
                                        id="listing-price"
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        placeholder="0.00"
                                        aria-invalid={Boolean(errors.price)}
                                        className={`${fieldCls} pl-9 pr-4`}
                                        {...register("price", {
                                            valueAsNumber: true,
                                            required: "Enter a price",
                                            min: { value: 0.01, message: "Price must be greater than 0" },
                                        })}
                                    />
                                </div>
                                {errors.price && (
                                    <p role="alert" className="mt-1.5 text-xs text-rose-600">
                                        {errors.price.message}
                                    </p>
                                )}
                            </div>

                            {/* stock */}
                            <div>
                                <label htmlFor="listing-stock" className="text-sm font-medium text-slate-900">
                                    Stock available
                                </label>
                                <input
                                    id="listing-stock"
                                    type="number"
                                    inputMode="numeric"
                                    step="1"
                                    aria-invalid={Boolean(errors.stock)}
                                    className={`${fieldCls} mt-2 px-4`}
                                    {...register("stock", {
                                        valueAsNumber: true,
                                        required: "Enter the stock quantity",
                                        min: { value: 0, message: "Stock cannot be negative" },
                                        validate: (v) => Number.isInteger(v) || "Use a whole number",
                                    })}
                                />
                                {errors.stock && (
                                    <p role="alert" className="mt-1.5 text-xs text-rose-600">
                                        {errors.stock.message}
                                    </p>
                                )}
                            </div>

                            {mutation.isError && (
                                <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {errorMessage}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={mutation.isPending}
                                className={`${goldBtn} disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                                {mutation.isPending ? "Listing…" : "Create listing"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}