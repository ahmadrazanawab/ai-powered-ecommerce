"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/app/lib/axios";

interface TaxListing {
    listingId: string;
    vendorName: string;
    productName: string;
    sku: string;
    price: string;
    gstStatus: string | null;
    verificationStatus: string | null;
    hsnCode: string | null;
    gstRate: string | null;
    taxUpdatedAt: string | null;
}

interface TaxFormValue {
    hsnCode: string;
    gstRate: string;
}

interface ListingProps {
    listing: TaxListing;
    value: TaxFormValue;
    onChange: (value: TaxFormValue) => void;
    onSave: () => void;
    saving: boolean;
}

function TaxListingRow({
    listing,
    value,
    onChange,
    onSave,
    saving,
}: ListingProps) {
    return (
        <article className="grid gap-4 border-b border-slate-100 p-5 last:border-0 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] lg:items-end">
            <div className="min-w-0">
                <h2 className="truncate font-medium text-slate-900">
                    {listing.productName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    {listing.vendorName} · SKU {listing.sku} · Listing price{" "}
                    {listing.price}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                    Vendor tax profile: {listing.gstStatus ?? "not submitted"} ·
                    {" "}verification: {listing.verificationStatus ?? "not reviewed"}
                </p>
            </div>
            <label className="text-sm text-slate-700">
                HSN code
                <input
                    value={value.hsnCode}
                    onChange={(event) =>
                        onChange({ ...value, hsnCode: event.target.value })
                    }
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="4, 6, or 8 digits"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
            </label>
            <label className="text-sm text-slate-700">
                GST rate (%)
                <input
                    value={value.gstRate}
                    onChange={(event) =>
                        onChange({ ...value, gstRate: event.target.value })
                    }
                    inputMode="decimal"
                    placeholder="Enter verified rate"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
            </label>
            <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
                {saving ? "Saving..." : "Save"}
            </button>
            {listing.taxUpdatedAt && (
                <p className="text-xs text-slate-400 lg:col-start-1">
                    Updated {new Date(listing.taxUpdatedAt).toLocaleString()}
                </p>
            )}
        </article>
    );
}

export default function InvoiceTaxSettingsPage() {
    const queryClient = useQueryClient();
    const [values, setValues] = useState<Record<string, TaxFormValue>>({});
    const [message, setMessage] = useState("");

    const query = useQuery<{ success: boolean; data: TaxListing[] }>({
        queryKey: ["admin-vendor-product-taxes"],
        queryFn: async () =>
            (await api.get("/api/auth/admin/vendor-product-taxes")).data,
        retry: false,
    });

    const mutation = useMutation({
        mutationFn: async (listing: TaxListing) => {
            const value = values[listing.listingId] ?? {
                hsnCode: listing.hsnCode ?? "",
                gstRate: listing.gstRate ?? "",
            };
            const response = await api.put(
                `/api/auth/admin/vendor-product-taxes/${listing.listingId}`,
                value
            );
            return response.data;
        },
        onSuccess: async (response) => {
            setMessage(response.message ?? "Tax settings saved");
            await queryClient.invalidateQueries({
                queryKey: ["admin-vendor-product-taxes"],
            });
        },
        onError: (error) => {
            const responseMessage = (
                error as { response?: { data?: { message?: string } } }
            ).response?.data?.message;
            setMessage(responseMessage ?? "Could not save tax settings");
        },
    });

    const listings = query.data?.data ?? [];

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <header>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">
                    Invoice configuration
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-950">
                    Vendor Listing Tax Settings
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Admins must enter the verified HSN code and GST rate for
                    each vendor listing. The system treats current listing
                    prices as GST-inclusive, preserves checkout totals, and
                    snapshots tax calculations on new orders only. These values
                    are not tax advice; verify the classification and rate before
                    saving.
                </p>
            </header>

            {message && (
                <p role="status" className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                    {message}
                </p>
            )}

            <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
                {query.isPending ? (
                    <p className="p-8 text-sm text-slate-600">
                        Loading vendor listings...
                    </p>
                ) : query.isError ? (
                    <p className="p-8 text-sm text-rose-700">
                        Could not load tax settings. Refresh to try again.
                    </p>
                ) : listings.length === 0 ? (
                    <p className="p-8 text-sm text-slate-600">
                        No vendor listings are available.
                    </p>
                ) : (
                    listings.map((listing) => (
                        <TaxListingRow
                            key={listing.listingId}
                            listing={listing}
                            value={
                                values[listing.listingId] ?? {
                                    hsnCode: listing.hsnCode ?? "",
                                    gstRate: listing.gstRate ?? "",
                                }
                            }
                            onChange={(value) =>
                                setValues((current) => ({
                                    ...current,
                                    [listing.listingId]: value,
                                }))
                            }
                            onSave={() => mutation.mutate(listing)}
                            saving={
                                mutation.isPending &&
                                mutation.variables?.listingId ===
                                    listing.listingId
                            }
                        />
                    ))
                )}
            </section>
        </div>
    );
}
