"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PendingAdmin = {
    name?: string;
    email?: string;
};

/* ---------- inline icons (no extra dependency) ---------- */
const svgBase = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

const ShieldIcon = () => (
    <svg {...svgBase} strokeWidth={1.6} className="h-6 w-6">
        <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);
const ClockIcon = () => (
    <svg {...svgBase} className="h-8 w-8">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
    </svg>
);
const CheckIcon = () => (
    <svg {...svgBase} strokeWidth={3} className="h-3.5 w-3.5">
        <path d="m5 12 5 5 9-10" />
    </svg>
);
const MailIcon = () => (
    <svg {...svgBase} className="h-[18px] w-[18px] shrink-0 text-slate-400">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
    </svg>
);
const UserIcon = () => (
    <svg {...svgBase} className="h-[18px] w-[18px] shrink-0 text-slate-400">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
);

const steps = [
    {
        title: "Account created",
        text: "Your details were submitted successfully.",
        state: "done" as const,
    },
    {
        title: "Review by super admin",
        text: "A super admin is checking your request.",
        state: "current" as const,
    },
    {
        title: "Access granted",
        text: "You can log in once your account is approved.",
        state: "upcoming" as const,
    },
];

const Page = () => {
    const [admin, setAdmin] = useState<PendingAdmin | null>(null);

    // Read the details saved right after signup (UI only)
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem("pending_admin");
            if (raw) setAdmin(JSON.parse(raw) as PendingAdmin);
        } catch {
            setAdmin(null);
        }
    }, []);

    return (
        <main
            data-theme="light"
            className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2"
        >
            {/* ---------- Brand panel ---------- */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
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

                <div className="relative flex h-full flex-col justify-between gap-10 px-6 py-8 sm:px-10 lg:min-h-screen lg:px-16 lg:py-14">
                    <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                            <ShieldIcon />
                        </span>
                        <span className="text-lg font-semibold tracking-tight">
                                Vendor Console
                        </span>
                    </div>

                    <div className="max-w-md">
                        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                            Thanks for signing up
                        </h1>
                        <p className="mt-4 hidden text-base leading-relaxed text-slate-300 sm:block">
                            For security, every new vendor account is reviewed by
                            an admin  before it can access the dashboard.
                        </p>
                    </div>

                    <p className="hidden text-sm text-slate-400 lg:block">
                        Restricted area. Only authorized administrators can
                        sign in.
                    </p>
                </div>
            </section>

            {/* ---------- Status panel ---------- */}
            <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:py-14">
                <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70 sm:p-10">
                    {/* Status icon */}
                    <div className="relative mx-auto mb-6 grid h-20 w-20 place-items-center">
                        <span className="absolute inset-0 animate-ping rounded-full bg-amber-200/60 motion-reduce:hidden" />
                        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200">
                            <ClockIcon />
                        </span>
                    </div>

                    <header className="text-center">
                        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Pending approval
                        </span>
                        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                            Your account is waiting for approval
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-500">
                            Your account will be approved by an admin.
                            You will be able to log in as soon as it is
                            approved.
                        </p>
                    </header>

                    {/* Submitted details */}
                    {(admin?.name || admin?.email) && (
                        <dl className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                            {admin?.name && (
                                <div className="flex items-center gap-3">
                                    <UserIcon />
                                    <div className="min-w-0">
                                        <dt className="text-xs text-slate-400">
                                            Name
                                        </dt>
                                        <dd className="truncate text-sm font-medium text-slate-800">
                                            {admin.name}
                                        </dd>
                                    </div>
                                </div>
                            )}
                            {admin?.email && (
                                <div className="flex items-center gap-3">
                                    <MailIcon />
                                    <div className="min-w-0">
                                        <dt className="text-xs text-slate-400">
                                            Email
                                        </dt>
                                        <dd className="truncate text-sm font-medium text-slate-800">
                                            {admin.email}
                                        </dd>
                                    </div>
                                </div>
                            )}
                        </dl>
                    )}

                    {/* Progress */}
                    <ol className="mt-8 space-y-0">
                        {steps.map((step, i) => {
                            const isLast = i === steps.length - 1;
                            return (
                                <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
                                    {!isLast && (
                                        <span
                                            className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px ${step.state === "done"
                                                    ? "bg-emerald-300"
                                                    : "bg-slate-200"
                                                }`}
                                        />
                                    )}

                                    <span
                                        className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${step.state === "done"
                                                ? "bg-emerald-500 text-white"
                                                : step.state === "current"
                                                    ? "bg-amber-100 text-amber-700 ring-2 ring-amber-400"
                                                    : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                                            }`}
                                    >
                                        {step.state === "done" ? (
                                            <CheckIcon />
                                        ) : step.state === "current" ? (
                                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                                        ) : (
                                            <span className="h-2 w-2 rounded-full bg-slate-300" />
                                        )}
                                    </span>

                                    <div>
                                        <p
                                            className={`text-sm font-medium ${step.state === "upcoming"
                                                    ? "text-slate-400"
                                                    : "text-slate-900"
                                                }`}
                                        >
                                            {step.title}
                                        </p>
                                        <p className="mt-0.5 text-sm text-slate-500">
                                            {step.text}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>

                    {/* Actions */}
                    <div className="mt-8 space-y-3">
                        <Link
                            href="/vendor/login"
                            className="btn h-12 w-full rounded-xl border-0 bg-slate-900 text-base font-medium text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                        >
                            Back to login
                        </Link>
                        <p className="text-center text-xs leading-relaxed text-slate-400">
                            Trying to log in before approval will not work.
                            Please contact your super admin if this takes
                            longer than expected.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Page;