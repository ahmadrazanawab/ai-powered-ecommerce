"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import { useRouter } from "next/navigation";
import {
    vendorLoginSchema,
    type VendorLoginI,
} from "@/app/api/lib/validations/vendor";

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

const MailIcon = () => (
    <svg {...svgBase} className="h-[18px] w-[18px] shrink-0 text-slate-400">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
    </svg>
);
const LockIcon = () => (
    <svg {...svgBase} className="h-[18px] w-[18px] shrink-0 text-slate-400">
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

const Page = () => {
    // UI-only state: toggles password visibility
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<VendorLoginI>({
        resolver: zodResolver(vendorLoginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const vendorLoginMutation = useMutation({
        mutationFn: async (data: VendorLoginI) => {
            const res = await api.post("/api/auth/vendor/login", data);

            const vendor = res.data?.vendor;

            if (!vendor?.token) {
                throw new Error("Token not found");
            }

            localStorage.setItem("vendor_token", vendor.token);
            localStorage.setItem("vendor_id", vendor.vendorId);
            localStorage.setItem("vendor_email", vendor.email);

            console.log("Vendor token saved");
            router.push("/vendor-dashboard")
            return res.data;
        },

        onSuccess: (data) => {
            console.log("Vendor login successful:", data);
        },

        onError: (error) => {
            if (axios.isAxiosError(error)) {
                console.error(error.response?.data ?? error.message);
            } else {
                console.error(error);
            }
        },
    });

    const handleVendorLogin = (data: VendorLoginI) => {
        vendorLoginMutation.mutate(data);
    };

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
                            Welcome back to your store
                        </h1>
                        <p className="mt-4 hidden text-base leading-relaxed text-slate-300 sm:block">
                            Sign in to manage your products, track orders and
                            keep your business growing.
                        </p>
                    </div>

                    <p className="hidden text-sm text-slate-400 lg:block">
                        Vendor area. Only registered vendors can sign in.
                    </p>
                </div>
            </section>

            {/* ---------- Form panel ---------- */}
            <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:py-14">
                <form
                    onSubmit={handleSubmit(handleVendorLogin)}
                    className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70 sm:p-10"
                    noValidate
                >
                    <header className="mb-8">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                            Vendor login
                        </h2>
                        <p className="mt-1.5 text-sm text-slate-500">
                            Sign in to access your vendor dashboard
                        </p>
                    </header>

                    <div className="space-y-5">
                        {/* Email */}
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-1.5 block text-sm font-medium text-slate-700"
                            >
                                Email address
                            </label>
                            <label
                                className={`input input-bordered flex h-12 w-full items-center gap-3 rounded-xl bg-slate-50 focus-within:bg-white ${errors.email ? "input-error" : ""
                                    }`}
                            >
                                <MailIcon />
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="username"
                                    placeholder="Enter your email"
                                    className="grow"
                                    {...register("email")}
                                />
                            </label>
                            {errors.email && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.email.message}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="mb-1.5 block text-sm font-medium text-slate-700"
                            >
                                Password
                            </label>
                            <label
                                className={`input input-bordered flex h-12 w-full items-center gap-3 rounded-xl bg-slate-50 focus-within:bg-white ${errors.password ? "input-error" : ""
                                    }`}
                            >
                                <LockIcon />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    className="grow"
                                    {...register("password")}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    className="text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:text-slate-900"
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
                    </div>

                    {vendorLoginMutation.isError && (
                        <div
                            role="alert"
                            className="alert alert-error alert-soft mt-5 rounded-xl"
                        >
                            <span>
                                {axios.isAxiosError(vendorLoginMutation.error)
                                    ? vendorLoginMutation.error.response?.data?.message ??
                                    "Login failed. Please check your credentials."
                                    : "Something went wrong. Please try again."}
                            </span>
                        </div>
                    )}

                    {vendorLoginMutation.isSuccess && (
                        <div
                            role="status"
                            className="alert alert-success alert-soft mt-5 rounded-xl"
                        >
                            <span>
                                {vendorLoginMutation.data?.message ??
                                    "Login successful!"}
                            </span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={vendorLoginMutation.isPending}
                        className="btn mt-7 h-12 w-full rounded-xl border-0 bg-slate-900 text-base font-medium text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:bg-slate-400 disabled:text-white"
                    >
                        {vendorLoginMutation.isPending ? (
                            <>
                                <span className="loading loading-spinner loading-sm" />
                                Logging in...
                            </>
                        ) : (
                            "Login"
                        )}
                    </button>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/vendor/signup"
                            className="font-medium text-slate-900 underline-offset-4 hover:underline"
                        >
                            Sign up
                        </Link>
                    </p>
                </form>
            </section>
        </main>
    );
};

export default Page;