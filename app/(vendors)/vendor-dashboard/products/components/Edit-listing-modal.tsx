// FILE: app/components/vendor/edit-listing-modal.tsx
"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/app/lib/axios";
import { CURRENCY, GemIcon, Svg, fieldCls, goldBtn } from "@/app/components/Shop-ui";
import type { VendorListingI } from "./Listing-card";

interface FormValues {
    price: string; // kept as text: the API accepts up to 2 decimals
    stock: number;
}

interface UpdateBody {
    price?: string;
    stock?: number;
}

interface HttpErrorLike {
    response?: { data?: { message?: string } };
}

interface Props {
    listing: VendorListingI;
    onClose: () => void;
}

export default function EditListingModal({ listing, onClose }: Props) {
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        setFocus,
        formState: { errors, dirtyFields, isDirty },
    } = useForm<FormValues>({
        defaultValues: {
            price: Number(listing.price).toFixed(2),
            stock: listing.stock,
        },
    });

    const mutation = useMutation({
        mutationFn: async (body: UpdateBody) =>
            (await api.put(`/api/auth/vendor/products/${listing.listingId}`, body)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendor-listings"] });
            onClose();
        },
    });

    // keep the latest onClose without re-running the effect below
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    // focus price, close on Escape, lock page scroll while open
    useEffect(() => {
        setFocus("price");
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [setFocus]);

    // send only the fields the vendor changed
    const onSubmit = (values: FormValues) => {
        const body: UpdateBody = {};
        if (dirtyFields.price) body.price = values.price.trim();
        if (dirtyFields.stock) body.stock = values.stock;
        if (Object.keys(body).length === 0) return onClose();
        mutation.mutate(body);
    };

    const errorMessage =
        (mutation.error as HttpErrorLike | null)?.response?.data?.message ??
        "Could not update the listing. Please try again.";

    return (
        <div
            className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/60 backdrop-blur-sm sm:place-items-center sm:p-4"
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-listing-title"
                className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200/70 sm:max-w-md sm:rounded-3xl"
            >
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 text-amber-200/50">
                                {listing.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={listing.imageUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <GemIcon className="h-7 w-7" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-700">
                                    Edit listing
                                </p>
                                <h2 id="edit-listing-title" className="truncate text-base font-semibold text-slate-900">
                                    {listing.name}
                                </h2>
                                <p className="truncate text-xs text-slate-500">{listing.categoryName}</p>
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
                        <div>
                            <label htmlFor="edit-price" className="text-sm font-medium text-slate-900">
                                Your price
                            </label>
                            <div className="relative mt-2">
                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                                    {CURRENCY}
                                </span>
                                <input
                                    id="edit-price"
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    aria-invalid={Boolean(errors.price)}
                                    className={`${fieldCls} pl-9 pr-4`}
                                    {...register("price", {
                                        required: "Enter a price",
                                        pattern: {
                                            value: /^\d+(\.\d{1,2})?$/,
                                            message: "Use a positive number with up to 2 decimals, e.g. 19.99",
                                        },
                                    })}
                                />
                            </div>
                            {errors.price && (
                                <p role="alert" className="mt-1.5 text-xs text-rose-600">
                                    {errors.price.message}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="edit-stock" className="text-sm font-medium text-slate-900">
                                Stock available
                            </label>
                            <input
                                id="edit-stock"
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
                            disabled={!isDirty || mutation.isPending}
                            className={`${goldBtn} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                            {mutation.isPending ? "Saving…" : "Save changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}