"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vendorSignupSchema, VendorSignupI } from "@/app/api/lib/validations/vendor";
import axios from "axios";
import { useRouter } from "next/navigation";

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
const iconCls = "h-[18px] w-[18px] shrink-0 text-slate-400";

const UserIcon = () => (
    <svg {...svgBase} className={iconCls}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
);
const MailIcon = () => (
    <svg {...svgBase} className={iconCls}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
    </svg>
);
const PhoneIcon = () => (
    <svg {...svgBase} className={iconCls}>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
    </svg>
);
const LockIcon = () => (
    <svg {...svgBase} className={iconCls}>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
);
const EyeIcon = ({ off }: { off: boolean }) => (
    <svg {...svgBase} className="h-[18px] w-[18px]">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {off && <path d="m4 4 16 16" />}
    </svg>
);
const StoreIcon = () => (
    <svg {...svgBase} strokeWidth={1.6} className="h-6 w-6">
        <path d="M3 9 5 4h14l2 5" />
        <path d="M4 9v11h16V9" />
        <path d="M9 20v-6h6v6" />
    </svg>
);
const CheckIcon = () => (
    <svg {...svgBase} strokeWidth={3} className="h-3 w-3">
        <path d="m5 12 5 5 9-10" />
    </svg>
);

const Page = () => {
    // UI-only state: toggles password visibility
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const router = useRouter();
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<VendorSignupI>({
        resolver: zodResolver(vendorSignupSchema),
        defaultValues: {
            name: "",
            email: "",
            mobileNumber: "",
            password: "",
            confirmPassword: "",
        },
    });

    const vendorSignupMutation = useMutation({
        mutationFn: async (data: VendorSignupI) => {
            const res = await api.post("/api/auth/vendor/signup", data);
            router.push("/pending-approval-vendor")
            return res.data;
        },

        onSuccess: (data) => {
            console.log("Signup successfully", data);
        },

        onError: (error) => {
            if (axios.isAxiosError(error)) {
                console.error(error.response?.data ?? error.message);
            } else {
                console.error(error);
            }
        },
    });

    const handleVendorSignupForm = (data: VendorSignupI) => {
        vendorSignupMutation.mutate(data);
    };

    const fieldCls = (hasError: boolean) =>
        `input input-bordered flex h-12 w-full items-center gap-3 rounded-xl bg-slate-50 focus-within:bg-white ${
            hasError ? "input-error" : ""
        }`;
    const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";
    const toggleCls =
        "text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:text-slate-900";

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
                            <StoreIcon />
                        </span>
                        <span className="text-lg font-semibold tracking-tight">
                            Vendor Portal
                        </span>
                    </div>

                    <div className="max-w-md">
                        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                            Start selling to more customers
                        </h1>
                        <p className="mt-4 hidden text-base leading-relaxed text-slate-300 sm:block">
                            Create your vendor account to list products, manage
                            orders and grow your business, all from one
                            dashboard.
                        </p>
                    </div>

                    <ul className="hidden space-y-3 text-sm text-slate-300 lg:block">
                        {[
                            "List and manage your products easily",
                            "Track orders and earnings in one place",
                            "Reach customers across the platform",
                        ].map((item) => (
                            <li key={item} className="flex items-center gap-3">
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-white">
                                    <CheckIcon />
                                </span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* ---------- Form panel ---------- */}
            <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:py-14">
                <form
                    onSubmit={handleSubmit(handleVendorSignupForm)}
                    className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70 sm:p-10"
                    noValidate
                >
                    <header className="mb-8">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                            Create your vendor account
                        </h2>
                        <p className="mt-1.5 text-sm text-slate-500">
                            Fill in your details to start selling
                        </p>
                    </header>

                    <div className="space-y-5">
                        {/* Name */}
                        <div>
                            <label htmlFor="name" className={labelCls}>
                                Full name
                            </label>
                            <label className={fieldCls(!!errors.name)}>
                                <UserIcon />
                                <input
                                    id="name"
                                    type="text"
                                    {...register("name")}
                                    className="grow"
                                    placeholder="Enter your full name"
                                    autoComplete="name"
                                />
                            </label>
                            {errors.name && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.name.message}
                                </p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className={labelCls}>
                                Email address
                            </label>
                            <label className={fieldCls(!!errors.email)}>
                                <MailIcon />
                                <input
                                    id="email"
                                    type="text"
                                    {...register("email")}
                                    className="grow"
                                    placeholder="Enter your email"
                                    autoComplete="email"
                                />
                            </label>
                            {errors.email && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.email.message}
                                </p>
                            )}
                        </div>

                        {/* Mobile number */}
                        <div>
                            <label htmlFor="mobileNumber" className={labelCls}>
                                Mobile number
                            </label>
                            <label className={fieldCls(!!errors.mobileNumber)}>
                                <PhoneIcon />
                                <input
                                    id="mobileNumber"
                                    type="text"
                                    {...register("mobileNumber")}
                                    className="grow"
                                    placeholder="Enter your mobile number"
                                    autoComplete="tel"
                                />
                            </label>
                            {errors.mobileNumber && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.mobileNumber.message}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className={labelCls}>
                                Password
                            </label>
                            <label className={fieldCls(!!errors.password)}>
                                <LockIcon />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    {...register("password")}
                                    className="grow"
                                    placeholder="Create a password"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    className={toggleCls}
                                >
                                    <EyeIcon off={showPassword} />
                                </button>
                            </label>
                            {errors.password && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.password.message}
                                </p>
                            )}
                        </div>

                        {/* Confirm password */}
                        <div>
                            <label htmlFor="confirmPassword" className={labelCls}>
                                Confirm password
                            </label>
                            <label className={fieldCls(!!errors.confirmPassword)}>
                                <LockIcon />
                                <input
                                    id="confirmPassword"
                                    type={showConfirm ? "text" : "password"}
                                    {...register("confirmPassword")}
                                    className="grow"
                                    placeholder="Re-enter your password"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm((v) => !v)}
                                    aria-label={
                                        showConfirm
                                            ? "Hide confirm password"
                                            : "Show confirm password"
                                    }
                                    className={toggleCls}
                                >
                                    <EyeIcon off={showConfirm} />
                                </button>
                            </label>
                            {errors.confirmPassword && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.confirmPassword.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Server error */}
                    {vendorSignupMutation.isError && (
                        <div
                            role="alert"
                            className="alert alert-error alert-soft mt-5 rounded-xl"
                        >
                            <span>
                                {axios.isAxiosError(vendorSignupMutation.error)
                                    ? vendorSignupMutation.error.response?.data?.message ??
                                      "Signup failed. Please try again."
                                    : "Something went wrong. Please try again."}
                            </span>
                        </div>
                    )}

                    {/* Success */}
                    {vendorSignupMutation.isSuccess && (
                        <div
                            role="status"
                            className="alert alert-success alert-soft mt-5 rounded-xl"
                        >
                            <span>
                                {vendorSignupMutation.data?.message ??
                                    "Signup successful!"}
                            </span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={vendorSignupMutation.isPending}
                        className="btn mt-7 h-12 w-full rounded-xl border-0 bg-slate-900 text-base font-medium text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:bg-slate-400 disabled:text-white"
                    >
                        {vendorSignupMutation.isPending ? (
                            <>
                                <span className="loading loading-spinner loading-sm" />
                                Signing up...
                            </>
                        ) : (
                            "Sign Up"
                        )}
                    </button>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Already have an account?{" "}
                        <Link
                            href="/vendor/login"
                            className="font-medium text-slate-900 underline-offset-4 hover:underline"
                        >
                            Login
                        </Link>
                    </p>
                </form>
            </section>
        </main>
    );
};

export default Page;
