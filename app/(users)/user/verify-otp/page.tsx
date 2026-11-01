

"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OtpInput from 'react-otp-input';

import {
    userOtpVerifySchema,
    type UserOtpVerifyInput,
} from "@/app/api/lib/validations/user";

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


const MailIcon = () => (
    <svg {...svgBase} className={iconCls}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
    </svg>
);


const ShieldIcon = () => (
    <svg {...svgBase} strokeWidth={1.6} className="h-6 w-6">
        <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const CheckIcon = () => (
    <svg {...svgBase} strokeWidth={3} className="h-3 w-3">
        <path d="m5 12 5 5 9-10" />
    </svg>
);

const Page = () => {
    const router = useRouter();

    const [identifier, setIdentifier] = useState("");
    const [purpose, setPurpose] = useState<"login" | "signup">("login");

    const [apiError, setApiError] = useState("");

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        control,
        formState: { errors },
    } = useForm<UserOtpVerifyInput>({
        resolver: zodResolver(userOtpVerifySchema),
        defaultValues: {
            identifier: "",
            otp: "",
            purpose: "login",
        },
    });

    // Fetch saved identifier and purpose
    useEffect(() => {
        const savedIdentifier =
            sessionStorage.getItem("opt_identifier");

        const savedPurpose = sessionStorage.getItem("purpose");

        if (savedIdentifier) {
            setIdentifier(savedIdentifier);

            setValue("identifier", savedIdentifier, {
                shouldValidate: true,
            });
        }

        if (savedPurpose === "login" || savedPurpose === "signup") {
            setPurpose(savedPurpose);

            setValue("purpose", savedPurpose, {
                shouldValidate: true,
            });
        }
    }, [setValue]);

    // OTP verification mutation
    const signupMutation = useMutation({
        mutationFn: async (data: UserOtpVerifyInput) => {
            const res = await api.post(
                "/api/auth/user/verify-otp",
                data
            );

            return res.data;
        },

        onSuccess: (data) => {
            console.log("OTP verified successfully:", data);

            sessionStorage.removeItem("opt_identifier");
            sessionStorage.removeItem("purpose");

            reset();

            // Redirect after successful verification
            router.push("/");
            // if (purpose === "signup") {
            //     router.push("/user/login");
            // } else {
            //     router.push("/user");
            // }
        },

        onError: (error) => {
            if (axios.isAxiosError(error)) {
                setApiError(
                    error.response?.data?.message ||
                    error.response?.data?.error ||
                    "Invalid OTP. Please try again."
                );
            } else {
                setApiError("Something went wrong. Please try again.");
            }
        },
    });

    const handleUserSignUpForm = (data: UserOtpVerifyInput) => {
        setApiError("");

        signupMutation.mutate({
            ...data,
            identifier,
            purpose,
        });
    };

    const fieldCls = (hasError: boolean) =>
        `input input-bordered flex h-12 w-full items-center gap-3 rounded-xl bg-slate-50 focus-within:bg-white ${hasError ? "input-error" : ""
        }`;

    const labelCls =
        "mb-1.5 block text-sm font-medium text-slate-700";

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
                            <ShieldIcon />
                        </span>
                        <span className="text-lg font-semibold tracking-tight">
                            User Console
                        </span>
                    </div>

                    <div className="max-w-md">
                        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                            Sign in customer
                        </h1>
                        <p className="mt-4 hidden text-base leading-relaxed text-slate-300 sm:block">
                            Create an account to continue shoping, review activity
                            and control access from one place.
                        </p>
                    </div>

                    <ul className="hidden space-y-3 text-sm text-slate-300 lg:block">
                        {[
                            "Manage users and permissions",
                            "Track activity across your workspace",
                            "Secure access with a strong password",
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
                    onSubmit={handleSubmit(handleUserSignUpForm)}
                    className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70 sm:p-10"
                    noValidate
                >
                    <header className="mb-8">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                            Verify Your Account
                        </h2>
                        <p className="mt-1.5 text-sm text-slate-500">
                            Enter the OTP sent to your registered email or mobile number to continue.
                        </p>
                    </header>

                    <div className="space-y-5">
                        {/* Email or phone number */}
                        <div className="hidden">
                            <label htmlFor="identifier" className={labelCls}>
                                Email or Mobile Number
                            </label>

                            <label className={fieldCls(!!errors.identifier)}>
                                <MailIcon />
                                <input
                                    id="identifier"
                                    type="text"
                                    {...register("identifier")}
                                    className="grow"
                                    placeholder="Enter your email or mobile number"
                                    autoComplete="username"
                                    value={identifier}
                                    onChange={(e) => {
                                        setIdentifier(e.target.value);
                                        setValue("identifier", e.target.value, {
                                            shouldValidate: true,
                                        });
                                    }}
                                />
                            </label>

                            {errors.identifier && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.identifier.message}
                                </p>
                            )}
                        </div>


                        {/* OTP */}
                        <div>
                            {/* <label htmlFor="otp" className={labelCls}>
                                OTP
                            </label> */}

                            <div>
                                <Controller
                                    name="otp"
                                    control={control}
                                    render={({ field }) => (
                                        <OtpInput
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            numInputs={6}
                                            shouldAutoFocus
                                            inputType="tel"
                                            containerStyle="flex w-full justify-between gap-2"
                                            renderSeparator={null}
                                            renderInput={(props) => (
                                                <input
                                                    {...props}
                                                    className="!h-11 !w-10 rounded-lg border border-slate-300 bg-white text-center text-lg font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                                                />
                                            )}
                                        />
                                    )}
                                />
                            </div>

                            {errors.otp && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.otp.message}
                                </p>
                            )}
                        </div>

                        {/* purpose */}
                        <div className="hidden">
                            <label htmlFor="purpose" className={labelCls}>
                                Purpose
                            </label>

                            <label className={fieldCls(!!errors.purpose)}>
                                <MailIcon />
                                <input
                                    id="purpose"
                                    type="text"
                                    {...register("purpose")}
                                    className="grow"
                                    placeholder="Enter your purpose"
                                    value={purpose}
                                    readOnly
                                />
                            </label>

                            {errors.purpose && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.purpose.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {apiError && (
                        <div
                            role="alert"
                            className="alert alert-error alert-soft mt-5 rounded-xl"
                        >
                            <span>{apiError}</span>
                        </div>
                    )}

                    {signupMutation.isSuccess && (
                        <div
                            role="status"
                            className="alert alert-success alert-soft mt-5 rounded-xl"
                        >
                            <span>OTP verified successfully!</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={signupMutation.isPending || !identifier}
                        className="btn mt-7 h-12 w-full rounded-xl border-0 bg-slate-900 text-base font-medium text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:bg-slate-400 disabled:text-white"
                    >
                        {signupMutation.isPending ? (
                            <>
                                <span className="loading loading-spinner loading-sm" />
                                Verifying...
                            </>
                        ) : (
                            "Verify OTP"
                        )}
                    </button>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Enter the OTP sent to your registered email or mobile number to verify your account.
                    </p>
                </form>
            </section>
        </main>
    );
};

export default Page;
