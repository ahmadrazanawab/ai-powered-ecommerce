
"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
    useQuery,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

interface Admin {
    adminId: string;
    email: string;
    role: string;
    status: "pending" | "approved" | "rejected" | "suspended";
    isActive: boolean;
    isVerified?: boolean;
}

type AdminAction = "approve" | "reject" | "suspend" | "reactivate";

interface ActionRequest {
    adminId: string;
    action: AdminAction;
    reason?: string;
}

/* ---------- UI helpers (styling only) ---------- */
type StatusFilter = "all" | Admin["status"];

const statusStyles: Record<Admin["status"], { badge: string; dot: string }> = {
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
};

const ShieldIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
    >
        <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const Banner = ({
    title,
    subtitle,
}: {
    title: string;
    subtitle: string;
}) => (
    <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl" />
        <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
                backgroundImage:
                    "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                backgroundSize: "44px 44px",
            }}
        />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-8 sm:pb-20 sm:pt-10">
            <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                    <ShieldIcon />
                </span>
                <span className="text-lg font-semibold tracking-tight">
                    Admin Console
                </span>
            </div>
            <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
                {title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                {subtitle}
            </p>
        </div>
    </header>
);

const Shell = ({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) => (
    <main data-theme="light" className="min-h-screen bg-slate-50">
        <Banner title={title} subtitle={subtitle} />
        <div className="relative mx-auto -mt-8 max-w-5xl px-4 pb-12 sm:-mt-10 sm:px-8">
            {children}
        </div>
    </main>
);

const Panel = ({ children }: { children: ReactNode }) => (
    <div className="rounded-3xl bg-white p-6 text-center shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70 sm:p-10">
        {children}
    </div>
);

export default function SuperAdminApprovePage() {
    const queryClient = useQueryClient();

    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [checkingRole, setCheckingRole] = useState(true);
    const [reasons, setReasons] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState<string | null>(null);
    const [actionError, setActionError] = useState("");
    const [actionSuccess, setActionSuccess] = useState("");
    // UI-only state: which status chip is selected
    const [filter, setFilter] = useState<StatusFilter>("all");

    useEffect(() => {
        const savedToken = localStorage.getItem("admin_token");
        const savedRole = localStorage.getItem("admin_role");

        setIsSuperAdmin(
            savedRole === "super_admin" && Boolean(savedToken)
        );
        setCheckingRole(false);
    }, []);

    const {
        data,
        isPending,
        isError,
        error,
    } = useQuery({
        queryKey: ["pendingAdmins"],
        queryFn: async () => {
            const response = await api.get("/api/auth/admin/approve");
            return response.data;
        },
        enabled: isSuperAdmin && !checkingRole,
    });
    console.log("admin details:- ", data);
    const actionMutation = useMutation({
        mutationFn: async ({
            adminId,
            action,
            reason,
        }: ActionRequest) => {
            const response = await api.patch(
                `/api/auth/admin/approve/${adminId}`,
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
                result.message || `Admin ${variables.action} successful`
            );

            setReasons((previous) => ({
                ...previous,
                [variables.adminId]: "",
            }));

            await queryClient.invalidateQueries({
                queryKey: ["pendingAdmins"],
            });

            await queryClient.invalidateQueries({
                queryKey: ["allAdmins"],
            });
        },

        onError: (error: any) => {
            setActionSuccess("");
            setActionError(
                error?.response?.data?.message ||
                error?.message ||
                "Admin action failed"
            );
        },
    });

    async function handleAction(
        admin: Admin,
        action: AdminAction
    ) {
        const needsReason = action === "reject" || action === "suspend";
        const reason = reasons[admin.adminId]?.trim() ?? "";

        if (needsReason && !reason) {
            setActionError(
                `Please enter a reason before ${action === "reject" ? "rejecting" : "suspending"} this admin.`
            );
            setActionSuccess("");
            return;
        }

        const labels: Record<AdminAction, string> = {
            approve: "approve",
            reject: "reject",
            suspend: "suspend",
            reactivate: "reactivate",
        };

        const confirmed = window.confirm(
            `Are you sure you want to ${labels[action]} ${admin.email}?`
        );

        if (!confirmed) return;

        setProcessing(`${admin.adminId}:${action}`);
        setActionError("");
        setActionSuccess("");

        try {
            await actionMutation.mutateAsync({
                adminId: admin.adminId,
                action,
                ...(needsReason ? { reason } : {}),
            });
        } finally {
            setProcessing(null);
        }
    }

    if (checkingRole) {
        return (
            <Shell
                title="Admin management"
                subtitle="Approve, reject and manage admin accounts."
            >
                <Panel>
                    <span className="loading loading-spinner loading-md text-slate-400" />
                    <p className="mt-3 text-sm text-slate-500">
                        Checking permissions...
                    </p>
                </Panel>
            </Shell>
        );
    }

    if (!isSuperAdmin) {
        return (
            <Shell
                title="Access denied"
                subtitle="You do not have permission to view this page."
            >
                <Panel>
                    <h2 className="text-xl font-semibold text-slate-900">
                        Access Denied
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                        Only super admins can access this page.
                    </p>
                </Panel>
            </Shell>
        );
    }

    if (isPending) {
        return (
            <Shell
                title="Admin management"
                subtitle="Approve, reject and manage admin accounts."
            >
                <Panel>
                    <span className="loading loading-spinner loading-md text-slate-400" />
                    <p className="mt-3 text-sm text-slate-500">
                        Loading admins...
                    </p>
                </Panel>
            </Shell>
        );
    }

    if (isError) {
        return (
            <Shell
                title="Admin management"
                subtitle="Approve, reject and manage admin accounts."
            >
                <Panel>
                    <p className="text-sm font-medium text-rose-600">
                        Failed to fetch admins: {error.message}
                    </p>
                </Panel>
            </Shell>
        );
    }

    // Supports either adminId or id, depending on the GET API response.
    const admins: Admin[] = Array.isArray(data?.adminDetails)
        ? data.adminDetails.map((item: any) => ({
            ...item,
            adminId: item.adminId ?? item.id,
        }))
        : [];

    // UI-only: counts and filtered list
    const count = (s: Admin["status"]) =>
        admins.filter((a) => a.status === s).length;
    const chips: { key: StatusFilter; label: string; total: number }[] = [
        { key: "all", label: "All", total: admins.length },
        { key: "pending", label: "Pending", total: count("pending") },
        { key: "approved", label: "Approved", total: count("approved") },
        { key: "suspended", label: "Suspended", total: count("suspended") },
        { key: "rejected", label: "Rejected", total: count("rejected") },
    ];
    const visibleAdmins =
        filter === "all"
            ? admins
            : admins.filter((a) => a.status === filter);

    return (
        <Shell
            title="Admin management"
            subtitle="Approve, reject and manage admin accounts."
        >
            {/* Filter chips */}
            <div className="rounded-2xl bg-white p-2 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70">
                <div className="flex gap-1 overflow-x-auto">
                    {chips.map((chip) => {
                        const active = filter === chip.key;
                        return (
                            <button
                                key={chip.key}
                                type="button"
                                onClick={() => setFilter(chip.key)}
                                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${active
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                                        : "text-slate-600 hover:bg-slate-100"
                                    }`}
                            >
                                {chip.label}
                                <span
                                    className={`rounded-full px-2 py-0.5 text-xs ${active
                                            ? "bg-white/20 text-white"
                                            : "bg-slate-100 text-slate-500"
                                        }`}
                                >
                                    {chip.total}
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
                    className="alert alert-error alert-soft mt-4 rounded-xl"
                >
                    <span>{actionError}</span>
                </div>
            )}

            {actionSuccess && (
                <div
                    role="status"
                    className="alert alert-success alert-soft mt-4 rounded-xl"
                >
                    <span>{actionSuccess}</span>
                </div>
            )}

            {/* List */}
            {visibleAdmins.length === 0 ? (
                <div className="mt-4">
                    <Panel>
                        <p className="text-sm text-slate-500">
                            No admins found in this list.
                        </p>
                    </Panel>
                </div>
            ) : (
                <div className="mt-4 grid gap-4">
                    {visibleAdmins.map((admin) => {
                        const isProcessing = processing?.startsWith(
                            `${admin.adminId}:`
                        );

                        const isPendingAdmin = admin.status === "pending";
                        const isApprovedAdmin =
                            admin.status === "approved" && admin.isActive;
                        const isSuspendedAdmin = admin.status === "suspended";
                        const style = statusStyles[admin.status];

                        return (
                            <article
                                key={admin.adminId}
                                className="rounded-3xl bg-white p-5 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70 sm:p-6"
                            >
                                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                                    {/* Identity */}
                                    <div className="flex min-w-0 gap-4">
                                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 text-lg font-semibold uppercase text-white">
                                            {admin.email?.charAt(0) ?? "?"}
                                        </span>

                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="break-all font-semibold text-slate-900">
                                                    {admin.email}
                                                </p>
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${style.badge}`}
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                                                    />
                                                    {admin.status}
                                                </span>
                                            </div>

                                            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                                                <div className="flex gap-2">
                                                    <dt className="text-slate-400">
                                                        Role
                                                    </dt>
                                                    <dd className="font-medium text-slate-700">
                                                        {admin.role}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-2">
                                                    <dt className="text-slate-400">
                                                        Active
                                                    </dt>
                                                    <dd
                                                        className={`font-medium ${admin.isActive
                                                                ? "text-emerald-600"
                                                                : "text-slate-500"
                                                            }`}
                                                    >
                                                        {admin.isActive
                                                            ? "Yes"
                                                            : "No"}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-2 sm:col-span-2">
                                                    <dt className="text-slate-400">
                                                        ID
                                                    </dt>
                                                    <dd className="break-all font-mono text-xs leading-5 text-slate-500">
                                                        {admin.adminId}
                                                    </dd>
                                                </div>
                                            </dl>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:shrink-0 lg:justify-end">
                                        {isPendingAdmin && (
                                            <>
                                                <button
                                                    className="btn h-11 rounded-xl border-0 bg-emerald-600 px-5 font-medium text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
                                                    disabled={Boolean(isProcessing)}
                                                    onClick={() =>
                                                        handleAction(admin, "approve")
                                                    }
                                                >
                                                    {processing === `${admin.adminId}:approve`
                                                        ? "Approving..."
                                                        : "Approve"}
                                                </button>

                                                <button
                                                    className="btn h-11 rounded-xl border border-rose-300 bg-white px-5 font-medium text-rose-600 hover:border-rose-400 hover:bg-rose-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                                    disabled={Boolean(isProcessing)}
                                                    onClick={() =>
                                                        handleAction(admin, "reject")
                                                    }
                                                >
                                                    {processing === `${admin.adminId}:reject`
                                                        ? "Rejecting..."
                                                        : "Reject"}
                                                </button>
                                            </>
                                        )}

                                        {isApprovedAdmin && (
                                            <button
                                                className="btn h-11 rounded-xl border border-orange-300 bg-white px-5 font-medium text-orange-700 hover:border-orange-400 hover:bg-orange-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                                disabled={Boolean(isProcessing)}
                                                onClick={() =>
                                                    handleAction(admin, "suspend")
                                                }
                                            >
                                                {processing === `${admin.adminId}:suspend`
                                                    ? "Suspending..."
                                                    : "Suspend"}
                                            </button>
                                        )}

                                        {isSuspendedAdmin && (
                                            <button
                                                className="btn h-11 rounded-xl border-0 bg-slate-900 px-5 font-medium text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
                                                disabled={Boolean(isProcessing)}
                                                onClick={() =>
                                                    handleAction(admin, "reactivate")
                                                }
                                            >
                                                {processing === `${admin.adminId}:reactivate`
                                                    ? "Reactivating..."
                                                    : "Reactivate"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {(isPendingAdmin || isApprovedAdmin) && (
                                    <div className="mt-5 border-t border-slate-100 pt-5">
                                        <label
                                            htmlFor={`reason-${admin.adminId}`}
                                            className="mb-1.5 block text-sm font-medium text-slate-700"
                                        >
                                            {isPendingAdmin
                                                ? "Rejection reason (required only when rejecting)"
                                                : "Suspension reason"}
                                        </label>

                                        <textarea
                                            id={`reason-${admin.adminId}`}
                                            className="textarea textarea-bordered w-full rounded-xl bg-slate-50 text-sm focus:bg-white"
                                            rows={2}
                                            placeholder="Enter a reason for rejecting or suspending..."
                                            value={reasons[admin.adminId] ?? ""}
                                            onChange={(event) =>
                                                setReasons((previous) => ({
                                                    ...previous,
                                                    [admin.adminId]: event.target.value,
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
        </Shell>
    );
}
// "use client";

// import { useEffect, useState } from "react";
// import {
//     useQuery,
//     useMutation,
//     useQueryClient,
// } from "@tanstack/react-query";
// import { api } from "@/app/lib/axios";

// interface Admin {
//     adminId: string;
//     email: string;
//     role: string;
//     status: "pending" | "approved" | "rejected" | "suspended";
//     isActive: boolean;
//     isVerified?: boolean;
// }

// type AdminAction = "approve" | "reject" | "suspend" | "reactivate";

// interface ActionRequest {
//     adminId: string;
//     action: AdminAction;
//     reason?: string;
// }

// export default function SuperAdminApprovePage() {
//     const queryClient = useQueryClient();

//     const [isSuperAdmin, setIsSuperAdmin] = useState(false);
//     const [checkingRole, setCheckingRole] = useState(true);
//     const [reasons, setReasons] = useState<Record<string, string>>({});
//     const [processing, setProcessing] = useState<string | null>(null);
//     const [actionError, setActionError] = useState("");
//     const [actionSuccess, setActionSuccess] = useState("");

//     useEffect(() => {
//         const savedToken = localStorage.getItem("admin_token");
//         const savedRole = localStorage.getItem("admin_role");

//         setIsSuperAdmin(
//             savedRole === "super_admin" && Boolean(savedToken)
//         );
//         setCheckingRole(false);
//     }, []);

//     const {
//         data,
//         isPending,
//         isError,
//         error,
//     } = useQuery({
//         queryKey: ["pendingAdmins"],
//         queryFn: async () => {
//             const response = await api.get("/api/auth/admin/approve");
//             return response.data;
//         },
//         enabled: isSuperAdmin && !checkingRole,
//     });

//     const actionMutation = useMutation({
//         mutationFn: async ({
//             adminId,
//             action,
//             reason,
//         }: ActionRequest) => {
//             const response = await api.patch(
//                 `/api/auth/admin/approve/${adminId}`,
//                 {
//                     action,
//                     ...(reason ? { reason } : {}),
//                 }
//             );

//             return response.data;
//         },

//         onSuccess: async (result, variables) => {
//             setActionError("");
//             setActionSuccess(
//                 result.message || `Admin ${variables.action} successful`
//             );

//             setReasons((previous) => ({
//                 ...previous,
//                 [variables.adminId]: "",
//             }));

//             await queryClient.invalidateQueries({
//                 queryKey: ["pendingAdmins"],
//             });

//             await queryClient.invalidateQueries({
//                 queryKey: ["allAdmins"],
//             });
//         },

//         onError: (error: any) => {
//             setActionSuccess("");
//             setActionError(
//                 error?.response?.data?.message ||
//                 error?.message ||
//                 "Admin action failed"
//             );
//         },
//     });

//     async function handleAction(
//         admin: Admin,
//         action: AdminAction
//     ) {
//         const needsReason = action === "reject" || action === "suspend";
//         const reason = reasons[admin.adminId]?.trim() ?? "";

//         if (needsReason && !reason) {
//             setActionError(
//                 `Please enter a reason before ${action === "reject" ? "rejecting" : "suspending"} this admin.`
//             );
//             setActionSuccess("");
//             return;
//         }

//         const labels: Record<AdminAction, string> = {
//             approve: "approve",
//             reject: "reject",
//             suspend: "suspend",
//             reactivate: "reactivate",
//         };

//         const confirmed = window.confirm(
//             `Are you sure you want to ${labels[action]} ${admin.email}?`
//         );

//         if (!confirmed) return;

//         setProcessing(`${admin.adminId}:${action}`);
//         setActionError("");
//         setActionSuccess("");

//         try {
//             await actionMutation.mutateAsync({
//                 adminId: admin.adminId,
//                 action,
//                 ...(needsReason ? { reason } : {}),
//             });
//         } finally {
//             setProcessing(null);
//         }
//     }

//     if (checkingRole) {
//         return <p className="p-6">Checking permissions...</p>;
//     }

//     if (!isSuperAdmin) {
//         return (
//             <div className="p-6">
//                 <h1 className="text-xl font-bold">Access Denied</h1>
//                 <p>Only super admins can access this page.</p>
//             </div>
//         );
//     }

//     if (isPending) {
//         return <p className="p-6">Loading admins...</p>;
//     }

//     if (isError) {
//         return (
//             <p className="p-6 text-red-600">
//                 Failed to fetch admins: {error.message}
//             </p>
//         );
//     }

//     // Supports either adminId or id, depending on the GET API response.
//     const admins: Admin[] = Array.isArray(data?.adminDetails)
//         ? data.adminDetails.map((item: any) => ({
//             ...item,
//             adminId: item.adminId ?? item.id,
//         }))
//         : [];

//     return (
//         <div className="p-6">
//             <h1 className="mb-6 text-2xl font-bold">
//                 Admin Management
//             </h1>

//             {actionError && (
//                 <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">
//                     {actionError}
//                 </p>
//             )}

//             {actionSuccess && (
//                 <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-green-700">
//                     {actionSuccess}
//                 </p>
//             )}

//             {admins.length === 0 ? (
//                 <p>No admins found in this list.</p>
//             ) : (
//                 <div className="space-y-4">
//                     {admins.map((admin) => {
//                         const isProcessing = processing?.startsWith(
//                             `${admin.adminId}:`
//                         );

//                         const isPendingAdmin = admin.status === "pending";
//                         const isApprovedAdmin =
//                             admin.status === "approved" && admin.isActive;
//                         const isSuspendedAdmin = admin.status === "suspended";

//                         return (
//                             <div
//                                 key={admin.adminId}
//                                 className="rounded-xl border p-4"
//                             >
//                                 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
//                                     <div>
//                                         <p className="font-semibold">{admin.email}</p>
//                                         <p className="text-sm text-gray-500">
//                                             Role: {admin.role}
//                                         </p>
//                                         <p className="text-sm text-gray-500">
//                                             ID: {admin.adminId}
//                                         </p>
//                                         <p className="text-sm">
//                                             Status: <strong>{admin.status}</strong>
//                                         </p>
//                                         <p className="text-sm">
//                                             Active: {admin.isActive ? "Yes" : "No"}
//                                         </p>
//                                     </div>

//                                     <div className="flex flex-wrap gap-2">
//                                         {isPendingAdmin && (
//                                             <>
//                                                 <button
//                                                     className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50"
//                                                     disabled={Boolean(isProcessing)}
//                                                     onClick={() =>
//                                                         handleAction(admin, "approve")
//                                                     }
//                                                 >
//                                                     {processing === `${admin.adminId}:approve`
//                                                         ? "Approving..."
//                                                         : "Approve"}
//                                                 </button>

//                                                 <button
//                                                     className="rounded-lg border border-red-500 px-4 py-2 text-red-600 disabled:opacity-50"
//                                                     disabled={Boolean(isProcessing)}
//                                                     onClick={() =>
//                                                         handleAction(admin, "reject")
//                                                     }
//                                                 >
//                                                     {processing === `${admin.adminId}:reject`
//                                                         ? "Rejecting..."
//                                                         : "Reject"}
//                                                 </button>
//                                             </>
//                                         )}

//                                         {isApprovedAdmin && (
//                                             <button
//                                                 className="rounded-lg border border-orange-500 px-4 py-2 text-orange-700 disabled:opacity-50"
//                                                 disabled={Boolean(isProcessing)}
//                                                 onClick={() =>
//                                                     handleAction(admin, "suspend")
//                                                 }
//                                             >
//                                                 {processing === `${admin.adminId}:suspend`
//                                                     ? "Suspending..."
//                                                     : "Suspend"}
//                                             </button>
//                                         )}

//                                         {isSuspendedAdmin && (
//                                             <button
//                                                 className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
//                                                 disabled={Boolean(isProcessing)}
//                                                 onClick={() =>
//                                                     handleAction(admin, "reactivate")
//                                                 }
//                                             >
//                                                 {processing === `${admin.adminId}:reactivate`
//                                                     ? "Reactivating..."
//                                                     : "Reactivate"}
//                                             </button>
//                                         )}
//                                     </div>
//                                 </div>

//                                 {(isPendingAdmin || isApprovedAdmin) && (
//                                     <div className="mt-4">
//                                         <label
//                                             htmlFor={`reason-${admin.adminId}`}
//                                             className="mb-1 block text-sm font-medium"
//                                         >
//                                             {isPendingAdmin
//                                                 ? "Rejection reason (required only when rejecting)"
//                                                 : "Suspension reason"}
//                                         </label>

//                                         <textarea
//                                             id={`reason-${admin.adminId}`}
//                                             className="w-full rounded-lg border p-3"
//                                             rows={2}
//                                             placeholder="Enter a reason for rejecting or suspending..."
//                                             value={reasons[admin.adminId] ?? ""}
//                                             onChange={(event) =>
//                                                 setReasons((previous) => ({
//                                                     ...previous,
//                                                     [admin.adminId]: event.target.value,
//                                                 }))
//                                             }
//                                         />
//                                     </div>
//                                 )}
//                             </div>
//                         );
//                     })}
//                 </div>
//             )}
//         </div>
//     );
// }


