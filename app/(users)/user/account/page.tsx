"use client";

import { forwardRef, useEffect, type InputHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import { useUserSession } from "@/app/hooks/use-user-session";

/* ---------- config (change if your routes differ) ---------- */
const USER_PROFILE_ENDPOINT = "/api/auth/user/profile";
const LOGIN_PATH = "/user/auth-user";

/* ---------- types ---------- */
interface ProfileFormValues {
    name: string;
    email: string;
    mobileNo: string;
}

interface ApiErrorLike {
    response?: { data?: { message?: string } };
}

/* ---------- shared style tokens (same as homepage) ---------- */
const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 disabled:cursor-not-allowed disabled:opacity-50";

const ghostBtn =
    "inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const inputCls =
    "h-12 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/70 disabled:bg-slate-50 disabled:text-slate-500";

/* ---------- small helpers ---------- */
const Svg = ({
    children,
    className = "h-5 w-5",
}: {
    children: ReactNode;
    className?: string;
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {children}
    </svg>
);

const GridTexture = () => (
    <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
            backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
        }}
    />
);

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    hint?: string;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
    { label, error, hint, id, ...rest },
    ref
) {
    return (
        <div>
            <label htmlFor={id} className="text-sm font-medium text-slate-700">
                {label}
            </label>
            <input
                ref={ref}
                id={id}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
                className={`${inputCls} mt-2 ${error ? "!ring-2 !ring-rose-400/70" : ""}`}
                {...rest}
            />
            {error ? (
                <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-600">
                    {error}
                </p>
            ) : hint ? (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
                    {hint}
                </p>
            ) : null}
        </div>
    );
});

const SectionTitle = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
    <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">{eyebrow}</p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {title}
        </h2>
    </div>
);

/* ---------- page ---------- */
export default function UserAccountPage() {
    const queryClient = useQueryClient();
    const { authUser, isLoading, isError, logout, isLoggingOut } = useUserSession();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<ProfileFormValues>({
        defaultValues: { name: "", email: "", mobileNo: "" },
    });

    // Fill the form once the profile arrives
    useEffect(() => {
        if (authUser) {
            reset({
                name: authUser.name ?? "",
                email: authUser.email ?? "",
                mobileNo: authUser.mobileNo ?? "",
            });
        }
    }, [authUser, reset]);

    const updateProfile = useMutation({
        mutationFn: async (values: ProfileFormValues) => {
            const res = await api.patch(USER_PROFILE_ENDPOINT, {
                name: values.name.trim(),
                mobileNo: values.mobileNo.trim() || null,
            });
            return res.data;
        },
        onSuccess: (_data, values) => {
            // keep the form clean with the saved values, then refresh cached profile
            reset(values);
            queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        },
    });

    const onSubmit: SubmitHandler<ProfileFormValues> = (values) => {
        updateProfile.mutate(values);
    };

    const serverError =
        (updateProfile.error as ApiErrorLike | null)?.response?.data?.message ??
        (updateProfile.isError ? "Could not save your changes. Please try again." : "");

    const displayName = authUser?.name?.trim() || authUser?.email?.split("@")[0] || "Your account";
    const initial = displayName.charAt(0);

    /* ----- loading ----- */
    if (isLoading) {
        return (
            <div>
                <div className="h-56 animate-pulse bg-slate-900 sm:h-64" />
                <div className="mx-auto -mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="h-72 animate-pulse rounded-3xl bg-slate-200/70" />
                        <div className="h-96 animate-pulse rounded-3xl bg-slate-200/70 lg:col-span-2" />
                    </div>
                </div>
            </div>
        );
    }

    /* ----- not signed in / failed ----- */
    if (isError || !authUser) {
        return (
            <div className="mx-auto max-w-lg px-4 py-24 sm:px-6">
                <div className={`${cardCls} p-8 text-center sm:p-10`}>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                        <Svg className="h-6 w-6">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 21a8 8 0 0 1 16 0" />
                        </Svg>
                    </span>
                    <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
                        Sign in to see your account
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Your session may have expired. Log in again to manage your profile.
                    </p>
                    <Link href={LOGIN_PATH} className={`${goldBtn} mt-7`}>
                        Log in
                    </Link>
                </div>
            </div>
        );
    }

    /* ----- profile ----- */
    return (
        <div className="pb-20">
            {/* Banner */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
                <GridTexture />

                <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-28 pt-12 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:pt-16 lg:px-8">
                    <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 text-3xl font-semibold uppercase text-slate-950 shadow-xl shadow-amber-400/20 sm:h-24 sm:w-24 sm:text-4xl">
                        {initial}
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-200">
                            My account
                        </p>
                        <h1 className="mt-1.5 truncate text-3xl font-semibold tracking-tight sm:text-4xl">
                            {displayName}
                        </h1>
                        {authUser.email && (
                            <p className="mt-1 truncate text-sm text-slate-300">{authUser.email}</p>
                        )}
                    </div>
                </div>
            </section>

            {/* Content (overlaps banner) */}
            <div className="relative mx-auto -mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Side navigation */}
                    <aside className={`${cardCls} h-fit p-3 sm:p-4`}>
                        <nav aria-label="Account" className="flex flex-col gap-1">
                            <Link
                                href="/user/account"
                                aria-current="page"
                                className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                            >
                                <Svg className="h-4.5 w-4.5 text-amber-300">
                                    <circle cx="12" cy="8" r="4" />
                                    <path d="M4 21a8 8 0 0 1 16 0" />
                                </Svg>
                                Profile
                            </Link>
                            <Link
                                href="/user/orders"
                                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            >
                                <Svg className="h-4.5 w-4.5">
                                    <path d="M6 7h12l-1 13H7L6 7Z" />
                                    <path d="M9 7a3 3 0 0 1 6 0" />
                                </Svg>
                                My orders
                            </Link>
                            <Link
                                href="/user/shop"
                                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            >
                                <Svg className="h-4.5 w-4.5">
                                    <path d="M3 7h18l-2 5H5L3 7Z" />
                                    <path d="M5 12v7h14v-7" />
                                </Svg>
                                Continue shopping
                            </Link>

                            <div className="my-2 h-px bg-slate-100" />

                            <button
                                type="button"
                                onClick={logout}
                                disabled={isLoggingOut}
                                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                            >
                                <Svg className="h-4.5 w-4.5">
                                    <path d="M9 4H5v16h4" />
                                    <path d="M16 8l4 4-4 4M20 12H9" />
                                </Svg>
                                {isLoggingOut ? "Logging out..." : "Log out"}
                            </button>
                        </nav>
                    </aside>

                    {/* Personal details */}
                    <section className={`${cardCls} p-6 sm:p-8 lg:col-span-2`}>
                        <SectionTitle eyebrow="Account" title="Personal details" />
                        <p className="mt-2 max-w-md text-sm text-slate-500">
                            Keep your name and phone number up to date so we can reach you about your orders.
                        </p>

                        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
                            <Field
                                id="profile-name"
                                label="Full name"
                                type="text"
                                autoComplete="name"
                                placeholder="Enter your full name"
                                error={errors.name?.message}
                                {...register("name", {
                                    required: "Enter your name.",
                                    minLength: { value: 2, message: "Name must be at least 2 characters." },
                                    maxLength: { value: 80, message: "Name must be 80 characters or fewer." },
                                })}
                            />

                            <Field
                                id="profile-email"
                                label="Email address"
                                type="email"
                                autoComplete="email"
                                readOnly
                                disabled
                                hint="Your email is used to log in and can't be changed here."
                                {...register("email")}
                            />

                            <Field
                                id="profile-mobile"
                                label="Mobile number"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="e.g. 9876543210"
                                error={errors.mobileNo?.message}
                                {...register("mobileNo", {
                                    pattern: {
                                        value: /^\+?[0-9\s-]{7,15}$/,
                                        message: "Enter a valid phone number (7 to 15 digits).",
                                    },
                                })}
                            />

                            {serverError && (
                                <div
                                    role="alert"
                                    className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200"
                                >
                                    {serverError}
                                </div>
                            )}

                            {updateProfile.isSuccess && !isDirty && (
                                <div
                                    role="status"
                                    className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200"
                                >
                                    Your changes were saved.
                                </div>
                            )}

                            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    className={ghostBtn}
                                    disabled={!isDirty || updateProfile.isPending}
                                    onClick={() => {
                                        updateProfile.reset();
                                        reset({
                                            name: authUser.name ?? "",
                                            email: authUser.email ?? "",
                                            mobileNo: authUser.mobileNo ?? "",
                                        });
                                    }}
                                >
                                    Discard changes
                                </button>
                                <button
                                    type="submit"
                                    className={goldBtn}
                                    disabled={!isDirty || updateProfile.isPending}
                                >
                                    {updateProfile.isPending ? "Saving..." : "Save changes"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
}