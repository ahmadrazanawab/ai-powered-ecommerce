// FILE: app/components/vendor/delete-listing-dialog.tsx
"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import { Svg } from "@/app/components/Shop-ui";
import type { VendorListingI } from "./Listing-card";

interface HttpErrorLike {
    response?: { data?: { message?: string } };
}

interface Props {
    listing: VendorListingI;
    onClose: () => void;
}

export default function DeleteListingDialog({ listing, onClose }: Props) {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        // assumes a DELETE handler exists in products/[listingId]/route.ts
        mutationFn: async () =>
            (await api.delete(`/api/auth/vendor/products/${listing.listingId}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendor-listings"] });
            onClose();
        },
    });

    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    // close on Escape, lock page scroll while open
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, []);

    const errorMessage =
        (mutation.error as HttpErrorLike | null)?.response?.data?.message ??
        "Could not delete the listing. Please try again.";

    return (
        <div
            className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/60 backdrop-blur-sm sm:place-items-center sm:p-4"
            onMouseDown={(e) => e.target === e.currentTarget && !mutation.isPending && onClose()}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-listing-title"
                aria-describedby="delete-listing-text"
                className="w-full rounded-t-3xl bg-white p-6 text-center shadow-2xl ring-1 ring-slate-200/70 sm:max-w-sm sm:rounded-3xl sm:p-8"
            >
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                    <Svg className="h-7 w-7">
                        <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                        <path d="M10 11v5M14 11v5" />
                    </Svg>
                </span>

                <h2 id="delete-listing-title" className="mt-5 text-lg font-semibold text-slate-900">
                    Delete this listing?
                </h2>
                <p id="delete-listing-text" className="mt-2 text-sm leading-relaxed text-slate-600">
                    <span className="font-medium text-slate-900">{listing.name}</span> will be removed from your
                    store. The product stays in the catalog, so you can list it again later. If you only want
                    to pause sales, hide it instead.
                </p>

                {mutation.isError && (
                    <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {errorMessage}
                    </p>
                )}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                    <button
                        type="button"
                        autoFocus
                        onClick={onClose}
                        disabled={mutation.isPending}
                        className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
                    >
                        Keep listing
                    </button>
                    <button
                        type="button"
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                        className="inline-flex h-12 items-center justify-center rounded-xl bg-rose-600 px-6 text-sm font-semibold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                        {mutation.isPending ? "Deleting…" : "Yes, delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}