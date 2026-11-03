// FILE: app/(vendors)/vendor-dashbaord/products/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/app/lib/axios";
import {
    GemIcon,
    Pagination,
    Svg,
    cardCls,
    fieldCls,
    goldBtn,
} from "@/app/components/Shop-ui";
import ListingCard, { type VendorListingI } from "./components/Listing-card";
import EditListingModal from "./components/Edit-listing-modal";
import DeleteListingDialog from "./components/Delete-listing-dialog";

const LISTINGS_KEY = ["vendor-listings"]; // the catalog modal refreshes this same key
const PER_PAGE = 8;

type StatusFilter = "all" | "active" | "inactive" | "out";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Hidden" },
    { value: "out", label: "Out of stock" },
];

interface FiltersForm {
    search: string;
    status: StatusFilter;
}

const DEFAULT_FILTERS: FiltersForm = { search: "", status: "all" };

interface ListingsResponse {
    data?: VendorListingI[];
}

interface HttpErrorLike {
    response?: { data?: { message?: string } };
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
    return (
        <div className={`${cardCls} flex items-center gap-4 p-4 sm:p-5`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>
                <span className="text-base font-semibold">{value}</span>
            </span>
            <p className="text-sm font-medium text-slate-600">{label}</p>
        </div>
    );
}

export default function VendorListingsPage() {
    const queryClient = useQueryClient();

    const [page, setPage] = useState(1);
    const [editing, setEditing] = useState<VendorListingI | null>(null);
    const [deleting, setDeleting] = useState<VendorListingI | null>(null);

    const { register, watch, setValue, reset } = useForm<FiltersForm>({
        defaultValues: DEFAULT_FILTERS,
    });

    const search = watch("search");
    const status = watch("status");

    // back to page 1 whenever a filter changes
    useEffect(() => {
        const sub = watch(() => setPage(1));
        return () => sub.unsubscribe();
    }, [watch]);

    /* ---------- data ---------- */
    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey: LISTINGS_KEY,
        queryFn: async () => (await api.get("/api/auth/vendor/products")).data,
    });

    const listings: VendorListingI[] = Array.isArray(data?.data) ? data.data : [];

    /* ---------- quick show/hide switch (optimistic) ---------- */
    const toggleMutation = useMutation({
        mutationFn: async ({ listingId, isActive }: { listingId: string; isActive: boolean }) =>
            (await api.put(`/api/auth/vendor/products/${listingId}`, { isActive })).data,
        onMutate: async ({ listingId, isActive }) => {
            await queryClient.cancelQueries({ queryKey: LISTINGS_KEY });
            const previous = queryClient.getQueryData<ListingsResponse>(LISTINGS_KEY);
            queryClient.setQueryData<ListingsResponse>(LISTINGS_KEY, (old) =>
                old
                    ? {
                        ...old,
                        data: old.data?.map((l) => (l.listingId === listingId ? { ...l, isActive } : l)),
                    }
                    : old
            );
            return { previous };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.previous) queryClient.setQueryData(LISTINGS_KEY, ctx.previous);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: LISTINGS_KEY }),
    });

    const busyId = toggleMutation.isPending ? toggleMutation.variables?.listingId : undefined;

    /* ---------- filtering + paging (client side) ---------- */
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return listings.filter((l) => {
            if (status === "active" && !l.isActive) return false;
            if (status === "inactive" && l.isActive) return false;
            if (status === "out" && l.stock > 0) return false;
            if (!q) return true;
            return [l.name, l.sku ?? "", l.categoryName].some((v) => v.toLowerCase().includes(q));
        });
    }, [listings, search, status]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    const hasFilters = search.trim() !== "" || status !== "all";

    const clearFilters = () => {
        reset(DEFAULT_FILTERS);
        setPage(1);
    };

    const stats = {
        total: listings.length,
        active: listings.filter((l) => l.isActive).length,
        out: listings.filter((l) => l.stock <= 0).length,
    };

    const loadError =
        (error as HttpErrorLike | null)?.response?.data?.message ??
        "Something went wrong. Please check your connection and try again.";

    return (
        <div>
            {/* ================= HEADER ================= */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">Listings</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                        My listings
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-slate-600">
                        Update your prices and stock, or hide a product without deleting it.
                    </p>
                </div>

                <Link href="/vendor-dashbaord/catalog" className={`${goldBtn} w-full sm:w-auto`}>
                    <Svg className="mr-2 h-4 w-4" strokeWidth={2}>
                        <path d="M12 5v14M5 12h14" />
                    </Svg>
                    Add from catalog
                </Link>
            </div>

            {/* ================= STATS ================= */}
            {!isPending && !isError && listings.length > 0 && (
                <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-5">
                    <Stat label="Total listings" value={stats.total} tone="bg-slate-900 text-amber-300" />
                    <Stat label="Visible in store" value={stats.active} tone="bg-emerald-50 text-emerald-700" />
                    <Stat label="Out of stock" value={stats.out} tone="bg-rose-50 text-rose-700" />
                </div>
            )}

            {/* ================= FILTERS ================= */}
            {listings.length > 0 && (
                <div className={`${cardCls} mt-6 p-4 sm:p-5`}>
                    <form onSubmit={(e) => e.preventDefault()} role="search">
                        <div className="relative">
                            <label htmlFor="listings-search" className="sr-only">
                                Search listings
                            </label>
                            <Svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500">
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-3.5-3.5" />
                            </Svg>
                            <input
                                id="listings-search"
                                type="search"
                                autoComplete="off"
                                placeholder="Search by name, SKU or category…"
                                className={`${fieldCls} pl-12 pr-4`}
                                {...register("search")}
                            />
                        </div>
                    </form>

                    <div
                        className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        role="group"
                        aria-label="Filter by status"
                    >
                        {STATUS_FILTERS.map((f) => {
                            const active = status === f.value;
                            return (
                                <button
                                    key={f.value}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setValue("status", f.value)}
                                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active
                                        ? "bg-slate-950 text-amber-300 shadow-md shadow-slate-950/20"
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        }`}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ================= LIST ================= */}
            <div className="mt-6">
                {toggleMutation.isError && (
                    <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        Could not update the listing. Your change was reverted.
                    </p>
                )}

                {isPending ? (
                    <div className="space-y-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className={`${cardCls} flex items-center gap-4 p-5`}>
                                <div className="h-24 w-24 shrink-0 animate-pulse rounded-2xl bg-slate-200/70" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-3 w-1/4 animate-pulse rounded bg-slate-200/70" />
                                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200/70" />
                                    <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200/70" />
                                </div>
                            </div>
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
                            We couldn&apos;t load your listings
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">{loadError}</p>
                        <button type="button" onClick={() => refetch()} className={`${goldBtn} mt-6`}>
                            Try again
                        </button>
                    </div>
                ) : listings.length === 0 ? (
                    <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                            <GemIcon className="h-7 w-7" />
                        </span>
                        <h2 className="mt-5 text-lg font-semibold text-slate-900">No listings yet</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Pick a product from the catalog and set your own price and stock.
                        </p>
                        <Link href="/vendor-dashbaord/catalog" className={`${goldBtn} mt-6`}>
                            Browse catalog
                        </Link>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                            <GemIcon className="h-7 w-7" />
                        </span>
                        <h2 className="mt-5 text-lg font-semibold text-slate-900">No listings found</h2>
                        <p className="mt-2 text-sm text-slate-600">Try a different search or remove the filters.</p>
                        {hasFilters && (
                            <button type="button" onClick={clearFilters} className={`${goldBtn} mt-6`}>
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-sm text-slate-600" aria-live="polite">
                            <span className="font-semibold text-slate-900">{filtered.length}</span>{" "}
                            {filtered.length === 1 ? "listing" : "listings"}
                            {hasFilters && (
                                <>
                                    {" "}·{" "}
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="font-medium text-slate-900 underline underline-offset-4"
                                    >
                                        Clear filters
                                    </button>
                                </>
                            )}
                        </p>

                        <div className="space-y-4">
                            {pageItems.map((l) => (
                                <ListingCard
                                    key={l.listingId}
                                    listing={l}
                                    busy={busyId === l.listingId}
                                    onToggle={(item) =>
                                        toggleMutation.mutate({
                                            listingId: item.listingId,
                                            isActive: !item.isActive,
                                        })
                                    }
                                    onEdit={setEditing}
                                    onDelete={setDeleting}
                                />
                            ))}
                        </div>

                        <Pagination
                            page={currentPage}
                            totalPages={totalPages}
                            onChange={(p) => {
                                setPage(p);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                        />
                    </>
                )}
            </div>

            {/* ================= MODALS ================= */}
            {editing && <EditListingModal listing={editing} onClose={() => setEditing(null)} />}
            {deleting && <DeleteListingDialog listing={deleting} onClose={() => setDeleting(null)} />}
        </div>
    );
}