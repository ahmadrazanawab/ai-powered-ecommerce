"use client";

import { api } from "@/app/lib/axios";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface VendorI {
    vendorId: string,
    name: string,
    email: string,
    status: string,
    isActive: boolean,
}

type VendorAction =
    | "approve"
    | "reject"
    | "suspend"
    | "deactivate"
    | "reactivate";

interface ActionRequest {
    vendorId: string;
    action: VendorAction;
    reason?: string;
}

/* ---------- UI helpers (styling only) ---------- */
// "deactivated" = approved vendor that is switched off (isActive = false)
const getDisplayStatus = (vendor: VendorI) =>
    vendor.status === "approved" && !vendor.isActive
        ? "deactivated"
        : vendor.status;

const statusStyles: Record<string, { badge: string; dot: string }> = {
    pending: {
        badge: "bg-amber-50 text-amber-700 ring-amber-200",
        dot: "bg-amber-500",
    },
    approved: {
        badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        dot: "bg-emerald-500",
    },
    rejected: {
        badge: "bg-rose-50 text-rose-700 ring-rose-200",
        dot: "bg-rose-500",
    },
    suspended: {
        badge: "bg-orange-50 text-orange-700 ring-orange-200",
        dot: "bg-orange-500",
    },
    deactivated: {
        badge: "bg-slate-100 text-slate-600 ring-slate-200",
        dot: "bg-slate-400",
    },
};

const fallbackStyle = statusStyles.deactivated;

const filterKeys = [
    "all",
    "pending",
    "approved",
    "deactivated",
    "suspended",
    "rejected",
] as const;
type FilterKey = (typeof filterKeys)[number];

const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const outlineBtn = (tone: "rose" | "orange" | "slate") => {
    const tones = {
        rose: "border-rose-300 text-rose-600 hover:border-rose-400 hover:bg-rose-50",
        orange: "border-orange-300 text-orange-700 hover:border-orange-400 hover:bg-orange-50",
        slate: "border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50",
    };
    return `btn h-11 rounded-xl border bg-white px-5 font-medium disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${tones[tone]}`;
};
const solidDark =
    "btn h-11 rounded-xl border-0 bg-slate-900 px-5 font-medium text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400";
const solidGreen =
    "btn h-11 rounded-xl border-0 bg-emerald-600 px-5 font-medium text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400";

const Page = () => {
    const queryClient = useQueryClient();

    const [isAdmin, setIsAdmin] = useState(false);
    const [checkingRole, setCheckingRole] = useState(true);
    const [reasons, setReasons] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState<string | null>(null);
    const [actionError, setActionError] = useState("");
    const [actionSuccess, setActionSuccess] = useState("");
    // UI-only state: which status chip is selected
    const [filter, setFilter] = useState<FilterKey>("all");

    useEffect(() => {
        const savedToken = localStorage.getItem("admin_token");
        setIsAdmin(Boolean(savedToken));
        setCheckingRole(false);
    }, []);

    const { data,
        isPending,
        isError,
        error } = useQuery({
            queryKey: ["getAllVendors"],
            queryFn: async () => {
                const res = await api.get("/api/auth/admin/vendors/get-vendors");
                return res.data;
            },
            enabled: isAdmin && !checkingRole,
        });

    const Vendors: VendorI[] = data?.vendorDetails
        ? (Array.isArray(data.vendorDetails) ? data.vendorDetails : [data.vendorDetails])
        : [];

    const actionMutation = useMutation({
        mutationFn: async ({ vendorId, action, reason }: ActionRequest) => {
            // Approve: same call as before (no body)
            if (action === "approve") {
                const response = await api.patch(
                    `/api/auth/admin/vendors/${vendorId}/approve`
                );
                return response.data;
            }

            // Reject: handled by the approve route
            if (action === "reject") {
                const response = await api.patch(
                    `/api/auth/admin/vendors/${vendorId}/approve`,
                    { action, reason }
                );
                return response.data;
            }

            // Suspend / deactivate / reactivate: handled by the status route
            const response = await api.patch(
                `/api/auth/admin/vendors/${vendorId}/status`,
                {
                    action,
                    ...(reason ? { reason } : {}),
                }
            );
            return response.data;
        },

        onSuccess: async (result, variables) => {
            setActionError("");
            setActionSuccess(
                result.message || `Vendor ${variables.action} successful`
            );

            setReasons((previous) => ({
                ...previous,
                [variables.vendorId]: "",
            }));

            await queryClient.invalidateQueries({
                queryKey: ["getAllVendors"],
            });
        },

        onError: (error: any) => {
            setActionSuccess("");
            setActionError(
                error?.response?.data?.message ||
                error?.message ||
                "Vendor action failed"
            );
        },
    });

    async function handleAction(vendor: VendorI, action: VendorAction) {
        const needsReason =
            action === "reject" ||
            action === "suspend" ||
            action === "deactivate";
        const reason = reasons[vendor.vendorId]?.trim() ?? "";

        if (needsReason && !reason) {
            const verb =
                action === "reject"
                    ? "rejecting"
                    : action === "suspend"
                    ? "suspending"
                    : "deactivating";
            setActionError(
                `Please enter a reason before ${verb} this vendor.`
            );
            setActionSuccess("");
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to ${action} ${vendor.email}?`
        );

        if (!confirmed) return;

        setProcessing(`${vendor.vendorId}:${action}`);
        setActionError("");
        setActionSuccess("");

        try {
            await actionMutation.mutateAsync({
                vendorId: vendor.vendorId,
                action,
                ...(needsReason ? { reason } : {}),
            });
        } finally {
            setProcessing(null);
        }
    }

    /* ---------- states ---------- */
    const stateCard = (content: React.ReactNode) => (
        <div className={`${cardCls} mx-auto max-w-6xl p-8 text-center sm:p-10`}>
            {content}
        </div>
    );

    if (checkingRole) {
        return stateCard(
            <>
                <span className="loading loading-spinner loading-md text-slate-400" />
                <p className="mt-3 text-sm text-slate-500">
                    Checking permissions...
                </p>
            </>
        );
    }

    if (!isAdmin) {
        return stateCard(
            <>
                <h2 className="text-xl font-semibold text-slate-900">
                    Access Denied
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                    Only admins can access this page.
                </p>
            </>
        );
    }

    if (isPending) {
        return stateCard(
            <>
                <span className="loading loading-spinner loading-md text-slate-400" />
                <p className="mt-3 text-sm text-slate-500">
                    Loading vendors...
                </p>
            </>
        );
    }

    if (isError) {
        return stateCard(
            <p className="text-sm font-medium text-rose-600">
                Failed to fetch vendors: {error.message}
            </p>
        );
    }

    // UI-only: counts and filtered list
    const countFor = (key: FilterKey) =>
        key === "all"
            ? Vendors.length
            : Vendors.filter((v) => getDisplayStatus(v) === key).length;
    const visibleVendors =
        filter === "all"
            ? Vendors
            : Vendors.filter((v) => getDisplayStatus(v) === filter);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* Header banner */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white sm:p-10">
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                        backgroundSize: "44px 44px",
                    }}
                />
                <div className="relative max-w-xl">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
                        Vendor management
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                        Approve, reject, suspend, deactivate and reactivate
                        vendor accounts.
                    </p>
                </div>
            </section>

            {/* Filter chips */}
            <div className={`${cardCls} p-2`}>
                <div className="flex gap-1 overflow-x-auto">
                    {filterKeys.map((key) => {
                        const active = filter === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFilter(key)}
                                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium capitalize transition-colors ${
                                    active
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                                        : "text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                                {key}
                                <span
                                    className={`rounded-full px-2 py-0.5 text-xs ${
                                        active
                                            ? "bg-white/20 text-white"
                                            : "bg-slate-100 text-slate-500"
                                    }`}
                                >
                                    {countFor(key)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Feedback */}
            {actionError && (
                <div
                    role="alert"
                    className="alert alert-error alert-soft rounded-xl"
                >
                    <span>{actionError}</span>
                </div>
            )}

            {actionSuccess && (
                <div
                    role="status"
                    className="alert alert-success alert-soft rounded-xl"
                >
                    <span>{actionSuccess}</span>
                </div>
            )}

            {/* List */}
            {visibleVendors.length === 0 ? (
                <div className={`${cardCls} p-8 text-center sm:p-10`}>
                    <p className="text-sm text-slate-500">
                        No vendors found in this list.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {visibleVendors.map((vendor) => {
                        const isProcessing = processing?.startsWith(
                            `${vendor.vendorId}:`
                        );

                        const displayStatus = getDisplayStatus(vendor);
                        const style = statusStyles[displayStatus] ?? fallbackStyle;

                        const isPendingVendor = vendor.status === "pending";
                        const isActiveVendor =
                            vendor.status === "approved" && vendor.isActive;
                        const canReactivate =
                            vendor.status === "suspended" ||
                            (vendor.status === "approved" && !vendor.isActive);

                        const busy = (a: VendorAction) =>
                            processing === `${vendor.vendorId}:${a}`;

                        return (
                            <article
                                key={vendor.vendorId}
                                className={`${cardCls} p-5 sm:p-6`}
                            >
                                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                                    {/* Identity */}
                                    <div className="flex min-w-0 gap-4">
                                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 text-lg font-semibold uppercase text-white">
                                            {vendor.name?.charAt(0) ?? "?"}
                                        </span>

                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="font-semibold text-slate-900">
                                                    {vendor.name}
                                                </h2>
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${style.badge}`}
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                                                    />
                                                    {displayStatus}
                                                </span>
                                            </div>

                                            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                                                <div className="flex gap-2 sm:col-span-2">
                                                    <dt className="text-slate-400">
                                                        Email
                                                    </dt>
                                                    <dd className="break-all font-medium text-slate-700">
                                                        {vendor.email}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-2">
                                                    <dt className="text-slate-400">
                                                        Active
                                                    </dt>
                                                    <dd
                                                        className={`font-medium ${
                                                            vendor.isActive
                                                                ? "text-emerald-600"
                                                                : "text-slate-500"
                                                        }`}
                                                    >
                                                        {vendor.isActive
                                                            ? "Yes"
                                                            : "No"}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-2 sm:col-span-2">
                                                    <dt className="text-slate-400">
                                                        ID
                                                    </dt>
                                                    <dd className="break-all font-mono text-xs leading-5 text-slate-500">
                                                        {vendor.vendorId}
                                                    </dd>
                                                </div>
                                            </dl>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:shrink-0 lg:justify-end">
                                        {isPendingVendor && (
                                            <>
                                                <button
                                                    className={solidGreen}
                                                    disabled={Boolean(isProcessing)}
                                                    onClick={() =>
                                                        handleAction(vendor, "approve")
                                                    }
                                                >
                                                    {busy("approve")
                                                        ? "Approving..."
                                                        : "Approve"}
                                                </button>

                                                <button
                                                    className={outlineBtn("rose")}
                                                    disabled={Boolean(isProcessing)}
                                                    onClick={() =>
                                                        handleAction(vendor, "reject")
                                                    }
                                                >
                                                    {busy("reject")
                                                        ? "Rejecting..."
                                                        : "Reject"}
                                                </button>
                                            </>
                                        )}

                                        {isActiveVendor && (
                                            <>
                                                <button
                                                    className={outlineBtn("slate")}
                                                    disabled={Boolean(isProcessing)}
                                                    onClick={() =>
                                                        handleAction(vendor, "deactivate")
                                                    }
                                                >
                                                    {busy("deactivate")
                                                        ? "Deactivating..."
                                                        : "Deactivate"}
                                                </button>

                                                <button
                                                    className={outlineBtn("orange")}
                                                    disabled={Boolean(isProcessing)}
                                                    onClick={() =>
                                                        handleAction(vendor, "suspend")
                                                    }
                                                >
                                                    {busy("suspend")
                                                        ? "Suspending..."
                                                        : "Suspend"}
                                                </button>
                                            </>
                                        )}

                                        {canReactivate && (
                                            <button
                                                className={solidDark}
                                                disabled={Boolean(isProcessing)}
                                                onClick={() =>
                                                    handleAction(vendor, "reactivate")
                                                }
                                            >
                                                {busy("reactivate")
                                                    ? "Reactivating..."
                                                    : "Reactivate"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {(isPendingVendor || isActiveVendor) && (
                                    <div className="mt-5 border-t border-slate-100 pt-5">
                                        <label
                                            htmlFor={`reason-${vendor.vendorId}`}
                                            className="mb-1.5 block text-sm font-medium text-slate-700"
                                        >
                                            {isPendingVendor
                                                ? "Rejection reason (required only when rejecting)"
                                                : "Reason (required for suspend or deactivate)"}
                                        </label>

                                        <textarea
                                            id={`reason-${vendor.vendorId}`}
                                            className="textarea textarea-bordered w-full rounded-xl bg-slate-50 text-sm focus:bg-white"
                                            rows={2}
                                            placeholder="Enter a reason..."
                                            value={reasons[vendor.vendorId] ?? ""}
                                            onChange={(event) =>
                                                setReasons((previous) => ({
                                                    ...previous,
                                                    [vendor.vendorId]: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Page;




// "use client";
// import { api } from "@/app/lib/axios"
// import {
//     useMutation,
//     useQuery,
//     useQueryClient,
// } from "@tanstack/react-query"
// import { useEffect, useState } from "react";
// interface VendorI {
//     vendorId: string,
//     name: string,
//     email: string,
//     status: string,
//     isActive: boolean,
// }
// const page = () => {

//     const [isAdmin, setIsAdmin] = useState(false);

//     useEffect(() => {
//         const savedToken = localStorage.getItem("admin_token");
//         setIsAdmin(Boolean(savedToken));

//     }, []);

//     console.log("admin token:- ", isAdmin);
//     const { data,
//         isPending,
//         isError,
//         error } = useQuery({
//             queryKey: ["getAllVendors"],
//             queryFn: async () => {
//                 const res = await api.get("/api/auth/admin/vendors/get-vendors");
//                 return res.data;
//             }
//         });
//     // console.log(data);

//     const Vendors: VendorI[] = data?.vendorDetails
//         ? (Array.isArray(data.vendorDetails) ? data.vendorDetails : [data.vendorDetails])
//         : [];

//     const actionMutation = useMutation({
//         mutationFn: async (vendorId:string) => {
//             const response = await api.patch(
//                 `/api/auth/admin/vendors/${vendorId}/approve`
//             );
//             return response.data;
//         },

//         onSuccess: async (result, variables) => {
            
//         },

//         onError: (error: any) => {
            
//         },
//     });


//     console.log("vendors :-  ", Vendors);
//     return (
//         <div className="m-auto">
//             <div className="p-10 shadow-md rounded-2xl bg-slate-200">
//                 {Vendors.map((vendor) => {
//                     return <div>
//                         <h2>Name: {vendor.name}</h2>
//                         <p>Email: {vendor.email}</p>
//                         <p>isActive : {vendor.isActive}</p>
//                         <p>status: {vendor.status}</p>
//                         <p>status: {vendor.vendorId}</p>
//                     </div>
//                 })}
//             </div>
//         </div>
//     )
// }

// export default page
