"use client";

import { useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import { useRouter } from "next/navigation";

import {
    userOtpRequestSchema,
    type UserOtpRequestInput,
} from "@/app/api/lib/validations/user";

type AuthPurpose = "login" | "signup";

/*
message: "Customer login successful"
success: true
token: "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxYzM3ZDA1MS1hNTUxLTQ2ZWQtYTU5OS1lOTUwNDkxNmQyNDIiLCJyb2xlIjoiVVNFUiIsImVtYWlsIjoiYW5hbUBnbWFpbC5jb20iLCJpYXQiOjE3OTM3MjI2MDIsImV4cCI6MTc5NDMyNzQwMn0.5_Ek1D1fUQGc-XS-5SMs0s1odekYGxYpCQC8jtX0yR8"
user: 
    email: "anam@gmail.com"
    id: "1c37d051-a551-46ed-a599-e9504916d242"
    mobileNo: null
    name: null
*/


const Page = () => {
    const router = useRouter();

    const [purpose, setPurpose] = useState<AuthPurpose>("login");

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<UserOtpRequestInput>({
        resolver: zodResolver(userOtpRequestSchema),
        defaultValues: {
            identifier: "",
            purpose: "login",
        },
    });

    const authMutation = useMutation({
        mutationFn: async (data: UserOtpRequestInput) => {
            const res = await api.post(
                "/api/auth/user/request-otp",
                data
            );

            return res.data;
        },

        onSuccess: (_, variables) => {
            sessionStorage.setItem(
                "opt_identifier",
                variables.identifier
            );

            sessionStorage.setItem(
                "purpose",
                variables.purpose
            );

            router.push("/user/verify-otp");
        },

        onError: (error) => {
            if (axios.isAxiosError(error)) {
                console.error(
                    error.response?.data ?? error.message
                );
            } else {
                console.error(error);
            }
        },
    });

    const handleAuthForm = (data: UserOtpRequestInput) => {
        authMutation.mutate({
            ...data,
            purpose,
        });
    };

    const fieldCls = (hasError: boolean) =>
        `input input-bordered flex h-12 w-full items-center gap-3 rounded-xl bg-slate-50 focus-within:bg-white ${hasError ? "input-error" : ""
        }`;

    const labelCls =
        "mb-1.5 block text-sm font-medium text-slate-700";

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
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-6 w-6"
                            >
                                <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
                                <path d="m9 12 2 2 4-4" />
                            </svg>
                        </span>

                        <span className="text-lg font-semibold tracking-tight">
                            User Console
                        </span>
                    </div>

                    <div className="max-w-md">
                        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                            {purpose === "login"
                                ? "Welcome back to your account"
                                : "Create your account"}
                        </h1>

                        <p className="mt-4 hidden text-base leading-relaxed text-slate-300 sm:block">
                            {purpose === "login"
                                ? "Sign in securely using your email or mobile number to access your account."
                                : "Join us and create your account using your email or mobile number."}
                        </p>
                    </div>

                    <p className="hidden text-sm text-slate-400 lg:block">
                        Secure OTP authentication. Your account is protected.
                    </p>
                </div>
            </section>

            {/* ---------- Form panel ---------- */}
            <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:py-14">

                <form
                    onSubmit={handleSubmit(handleAuthForm)}
                    className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70 sm:p-10"
                    noValidate
                >
                    <header className="mb-8">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                            {purpose === "login"
                                ? "User login"
                                : "User signup"}
                        </h2>

                        <p className="mt-1.5 text-sm text-slate-500">
                            {purpose === "login"
                                ? "Sign in to access your account"
                                : "Create your account to get started"}
                        </p>
                    </header>

                    {/* Login / Signup tabs */}
                    <div className="mb-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">

                        <button
                            type="button"
                            onClick={() => setPurpose("login")}
                            className={`rounded-lg py-2.5 text-sm font-semibold transition ${purpose === "login"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500"
                                }`}
                        >
                            Login
                        </button>

                        <button
                            type="button"
                            onClick={() => setPurpose("signup")}
                            className={`rounded-lg py-2.5 text-sm font-semibold transition ${purpose === "signup"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500"
                                }`}
                        >
                            Sign up
                        </button>
                    </div>

                    {/* Identifier */}
                    <div>
                        <label
                            htmlFor="identifier"
                            className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                            Email or phone number
                        </label>

                        <label
                            className={fieldCls(!!errors.identifier)}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-[18px] w-[18px] shrink-0 text-slate-400"
                            >
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 21a8 8 0 0 1 16 0" />
                            </svg>

                            <input
                                id="identifier"
                                type="text"
                                autoComplete="username"
                                placeholder="Enter email or phone number"
                                className="grow"
                                {...register("identifier")}
                            />
                        </label>

                        {errors.identifier && (
                            <p className="mt-1.5 text-sm text-error">
                                {errors.identifier.message}
                            </p>
                        )}
                    </div>

                    {/* Error */}
                    {authMutation.isError && (
                        <div
                            role="alert"
                            className="alert alert-error alert-soft mt-5 rounded-xl"
                        >
                            <span>
                                {axios.isAxiosError(authMutation.error)
                                    ? authMutation.error.response?.data?.message ??
                                    "Something went wrong. Please try again."
                                    : "Something went wrong. Please try again."}
                            </span>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={authMutation.isPending}
                        className="btn mt-7 h-12 w-full rounded-xl border-0 bg-slate-900 text-base font-medium text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:bg-slate-400 disabled:text-white"
                    >
                        {authMutation.isPending ? (
                            <>
                                <span className="loading loading-spinner loading-sm" />
                                Sending OTP...
                            </>
                        ) : (
                            purpose === "login"
                                ? "Login"
                                : "Create Account"
                        )}
                    </button>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        You will receive an OTP to verify your identity.
                    </p>

                </form>
            </section>
        </main>
    );
};

export default Page;
