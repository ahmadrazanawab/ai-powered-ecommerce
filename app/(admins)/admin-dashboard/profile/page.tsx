
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import { GemIcon, GridTexture, Svg, cardCls, goldBtn } from "@/app/components/Shop-ui";
import ChangePasswordForm from "./components/Change-password-form";

interface AdminProfileI {
    id: string;
    name: string;
    phoneNumber?: number;
    email: string;
    role: string;
    isActive: boolean;
}

interface HttpErrorLike {
    response?: { data?: { message?: string } };
}

const roleLabel = (role: string) => {
    const text = role.replace(/[_-]+/g, " ").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
};

/* ---------- small presentational helpers (UI only) ---------- */

function GoldDivider({ className = "" }: { className?: string }) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-amber-500/70" />
            <span className="h-1.5 w-1.5 rotate-45 bg-amber-500/80" />
            <span className="h-px flex-1 bg-gradient-to-r from-amber-500/50 via-amber-400/20 to-transparent" />
        </div>
    );
}

function InfoRow({
    label,
    children,
    icon,
    mono = false,
}: {
    label: string;
    children: React.ReactNode;
    icon: React.ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="group flex items-start gap-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 transition-colors duration-300 hover:border-amber-300/25 hover:bg-white/[0.05]">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-200/15 to-amber-500/10 text-amber-300 ring-1 ring-amber-200/15">
                {icon}
            </span>
            <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-amber-200/60">
                    {label}
                </dt>
                <dd
                    className={`mt-1 break-all ${mono ? "font-mono text-xs text-stone-300" : "text-sm text-stone-100"
                        }`}
                >
                    {children}
                </dd>
            </div>
        </div>
    );
}

export default function AdminProfilePage() {
    // null = not checked yet, so no request is sent before reading the token
    const [hasToken, setHasToken] = useState<boolean | null>(null);

    useEffect(() => {
        setHasToken(Boolean(localStorage.getItem("admin_token")));
    }, []);

    // password modal
    const [showPwModal, setShowPwModal] = useState(false);

    // close on Escape + lock background scroll while the modal is open
    useEffect(() => {
        if (!showPwModal) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setShowPwModal(false);
        };
        document.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [showPwModal]);

    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey: ["adminProfile"],
        queryFn: async () => (await api.get("/api/auth/admin/profile")).data,
        enabled: hasToken === true,
        retry: 1,
    });

    const admin: AdminProfileI | undefined = data?.admin;
    console.log("admin details : ", admin);
    const loadError =
        (error as HttpErrorLike | null)?.response?.data?.message ??
        "Something went wrong. Please check your connection and try again.";

    return (
        <div className="relative">
            {/* soft ambient glow behind the page */}
            <div className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-72 bg-[radial-gradient(60%_60%_at_20%_0%,rgba(251,191,36,0.10),transparent_70%),radial-gradient(50%_60%_at_90%_0%,rgba(99,102,241,0.08),transparent_70%)]" />

            {/* ================= HEADER ================= */}
            <div>
                <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-700">
                    <span className="h-1.5 w-1.5 rotate-45 bg-amber-600" />
                    Account
                </p>
                <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                    My{" "}
                    <span className="bg-gradient-to-r from-amber-700 via-amber-500 to-amber-700 bg-clip-text text-transparent">
                        profile
                    </span>
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-600">
                    Your admin account details and password settings.
                </p>
                <GoldDivider className="mt-6 max-w-md" />
            </div>

            <div className="mt-10">
                {hasToken === false ? (
                    <div
                        className={`${cardCls} relative mx-auto max-w-lg overflow-hidden border border-amber-200/60 p-10 text-center shadow-[0_30px_80px_-30px_rgba(120,80,10,0.35)]`}
                    >
                        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-amber-300/25 blur-3xl" />
                        <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 text-amber-300 shadow-lg shadow-amber-900/20 ring-1 ring-amber-300/30">
                            <GemIcon className="h-7 w-7" />
                        </span>
                        <h2 className="relative mt-6 font-serif text-xl font-semibold text-stone-900">
                            Admin login required
                        </h2>
                        <p className="relative mt-2 text-sm leading-relaxed text-stone-600">
                            Please log in with an admin account to view your profile.
                        </p>
                    </div>
                ) : hasToken === null || isPending ? (
                    <div className="grid gap-7 lg:grid-cols-3">
                        <div className="h-[34rem] animate-pulse rounded-[2rem] bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900" />
                        <div className="space-y-5 lg:col-span-2">
                            <div className={`${cardCls} space-y-5 p-8`}>
                                <div className="h-4 w-28 animate-pulse rounded bg-amber-100/80" />
                                <div className="h-12 animate-pulse rounded-xl bg-stone-200/70" />
                                <div className="h-12 animate-pulse rounded-xl bg-stone-200/70" />
                                <div className="h-12 animate-pulse rounded-xl bg-stone-200/70" />
                                <div className="h-12 w-40 animate-pulse rounded-xl bg-amber-100/80" />
                            </div>
                        </div>
                    </div>
                ) : isError || !admin ? (
                    <div
                        className={`${cardCls} relative mx-auto max-w-lg overflow-hidden border border-rose-200/60 p-10 text-center shadow-[0_30px_80px_-30px_rgba(190,18,60,0.25)]`}
                    >
                        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-rose-300/20 blur-3xl" />
                        <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                            <Svg className="h-7 w-7">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 8v5M12 16.5v.01" />
                            </Svg>
                        </span>
                        <h2 className="relative mt-6 font-serif text-xl font-semibold text-stone-900">
                            We couldn&apos;t load your profile
                        </h2>
                        <p className="relative mt-2 text-sm leading-relaxed text-stone-600">{loadError}</p>
                        <button type="button" onClick={() => refetch()} className={`${goldBtn} relative mt-7`}>
                            Try again
                        </button>
                    </div>
                ) : (
                    <div className="grid items-start gap-7 lg:grid-cols-3">
                        {/* ---------- profile card ---------- */}
                        <div className="rounded-[2rem] bg-gradient-to-b from-amber-300/70 via-amber-200/10 to-amber-500/50 p-px shadow-[0_40px_90px_-30px_rgba(24,20,40,0.65)]">
                            <section className="relative overflow-hidden rounded-[calc(2rem-1px)] bg-gradient-to-br from-[#0a0a0f] via-[#14111c] to-[#1d1733] p-6 text-white sm:p-8">
                                <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
                                <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl" />
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                                <GridTexture />

                                <div className="relative">
                                    {/* monogram with gold ring */}
                                    <div className="flex items-center gap-4">
                                        <span className="rounded-[1.6rem] bg-gradient-to-br from-amber-100 via-amber-400 to-amber-700 p-[2px] shadow-xl shadow-amber-500/25">
                                            <span className="grid h-20 w-20 place-items-center rounded-[1.5rem] bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 font-serif text-3xl font-semibold uppercase text-stone-950">
                                                {admin.name
                                                    .trim()
                                                    .split(/\s+/)
                                                    .map((word) => word.charAt(0).toUpperCase())
                                                    .join("")}
                                            </span>
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-amber-200/70">
                                                Administrator
                                            </p>
                                            <h2 className="mt-1 break-words font-serif text-xl font-semibold tracking-tight text-white">
                                                {admin.name}
                                            </h2>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-wrap gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300/15 to-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 ring-1 ring-amber-300/25">
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" />
                                            {roleLabel(admin.role)}
                                        </span>
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${admin.isActive
                                                ? "bg-emerald-400/10 text-emerald-300 ring-emerald-300/25"
                                                : "bg-rose-400/10 text-rose-300 ring-rose-300/25"
                                                }`}
                                        >
                                            <span
                                                className={`h-1.5 w-1.5 rounded-full ${admin.isActive
                                                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                                                    : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]"
                                                    }`}
                                            />
                                            {admin.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </div>

                                    <GoldDivider className="mt-7" />

                                    <dl className="mt-6 space-y-3">
                                        <InfoRow
                                            label="Name"
                                            icon={
                                                <Svg className="h-4 w-4">
                                                    <circle cx="12" cy="8" r="4" />
                                                    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
                                                </Svg>
                                            }
                                        >
                                            {admin.name}
                                        </InfoRow>
                                        <InfoRow
                                            label="Email"
                                            icon={
                                                <Svg className="h-4 w-4">
                                                    <rect x="3" y="5" width="18" height="14" rx="2" />
                                                    <path d="m3 7 9 6 9-6" />
                                                </Svg>
                                            }
                                        >
                                            {admin.email}
                                        </InfoRow>
                                        <InfoRow
                                            label="Mobile No"
                                            icon={
                                                <Svg className="h-4 w-4">
                                                    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                                                    <path d="M11 18.5h2" />
                                                </Svg>
                                            }
                                        >
                                            {admin.phoneNumber ?? "—"}
                                        </InfoRow>
                                        <InfoRow
                                            label="Role"
                                            icon={
                                                <Svg className="h-4 w-4">
                                                    <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" />
                                                    <path d="m9 12 2 2 4-4" />
                                                </Svg>
                                            }
                                        >
                                            {roleLabel(admin.role)}
                                        </InfoRow>
                                        <InfoRow
                                            label="Admin ID"
                                            mono
                                            icon={
                                                <Svg className="h-4 w-4">
                                                    <path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />
                                                </Svg>
                                            }
                                        >
                                            {admin.id}
                                        </InfoRow>
                                    </dl>

                                    <p className="mt-7 text-center text-[10px] uppercase tracking-[0.3em] text-amber-200/40">
                                        Secure admin access
                                    </p>
                                </div>
                            </section>
                        </div>

                        {/* ---------- password (opens modal) ---------- */}
                        <div className="relative lg:col-span-2">
                            <div className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
                            <div className="relative rounded-[2rem] bg-gradient-to-br from-amber-200/70 via-stone-200/40 to-amber-400/50 p-px shadow-[0_30px_70px_-35px_rgba(120,80,10,0.4)]">
                                <div className="rounded-[calc(2rem-1px)] bg-gradient-to-b from-white to-stone-50/80 p-6 sm:p-8">
                                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">
                                        Security
                                    </p>
                                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                                        Password
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Keep your admin account safe by updating your password regularly.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowPwModal(true)}
                                        className={`${goldBtn} mt-6`}
                                    >
                                        Change password
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ================= CHANGE PASSWORD MODAL ================= */}
            {showPwModal && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/60 p-4 backdrop-blur-sm sm:items-center"
                    onClick={() => setShowPwModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Change password"
                >
                    <div
                        className="relative my-8 w-full max-w-xl rounded-[2rem] bg-gradient-to-br from-amber-200/70 via-stone-200/40 to-amber-400/50 p-px shadow-[0_40px_90px_-30px_rgba(24,20,40,0.65)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setShowPwModal(false)}
                            aria-label="Close"
                            className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                            <Svg className="h-5 w-5">
                                <path d="M6 6l12 12M18 6 6 18" />
                            </Svg>
                        </button>
                        <div className="rounded-[calc(2rem-1px)] bg-gradient-to-b from-white to-stone-50/80">
                            <ChangePasswordForm />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

