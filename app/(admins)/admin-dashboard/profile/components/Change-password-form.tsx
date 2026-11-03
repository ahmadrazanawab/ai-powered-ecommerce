
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/app/lib/axios";
import { Svg, cardCls, fieldCls } from "@/app/components/Shop-ui";

const ENDPOINT = "/api/auth/admin/profile";

interface FormValues {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    otp: string;
}

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

interface HttpErrorLike {
    response?: {
        data?: {
            message?: string;
            errors?: Partial<Record<string, string[]>>;
        };
    };
}

/* simple strength meter, guidance only (the server enforces 8+ characters) */
function getStrength(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [
        { label: "Too short", bar: "bg-slate-300", text: "text-slate-500" },
        { label: "Weak", bar: "bg-rose-500", text: "text-rose-600" },
        { label: "Fair", bar: "bg-amber-500", text: "text-amber-700" },
        { label: "Good", bar: "bg-indigo-500", text: "text-indigo-700" },
        { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-700" },
    ];
    return { score, ...levels[pw.length === 0 ? 0 : score] };
}

const FIELDS: { name: PasswordField; label: string; autoComplete: string }[] = [
    { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
    { name: "newPassword", label: "New password", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
];

export default function ChangePasswordForm() {
    const [visible, setVisible] = useState<Record<PasswordField, boolean>>({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
    });

    // set after step 1 (code sent). While it is set, the OTP field is shown.
    const [otpToken, setOtpToken] = useState<string | null>(null);
    const otpSent = otpToken !== null;

    const {
        register,
        handleSubmit,
        watch,
        reset,
        setError,
        setValue,
        getValues,
        formState: { errors },
    } = useForm<FormValues>({
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "", otp: "" },
    });

    const currentPassword = watch("currentPassword");
    const newPassword = watch("newPassword");
    const strength = getStrength(newPassword);

    // show server field errors under the right input
    const mapServerErrors = (err: unknown) => {
        const fieldErrors = (err as HttpErrorLike).response?.data?.errors;
        (["currentPassword", "newPassword", "otp"] as const).forEach((field) => {
            const message = fieldErrors?.[field]?.[0];
            if (message) setError(field, { type: "server", message });
        });
    };

    /* step 1: check the passwords and send the code */
    const requestOtpMutation = useMutation({
        mutationFn: async (values: FormValues) =>
            (
                await api.post(ENDPOINT, {
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword,
                })
            ).data,
        onSuccess: (data) => {
            setOtpToken(data.otpToken);
            setValue("otp", "");
        },
        onError: mapServerErrors,
    });

    /* step 2: send the code and change the password */
    const confirmMutation = useMutation({
        mutationFn: async (values: FormValues) =>
            (
                await api.patch(ENDPOINT, {
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword,
                    otp: values.otp,
                    otpToken,
                })
            ).data,
        onSuccess: () => {
            reset();
            setOtpToken(null);
        },
        onError: mapServerErrors,
    });

    const isPending = requestOtpMutation.isPending || confirmMutation.isPending;

    const onSubmit = (values: FormValues) => {
        if (otpSent) {
            requestOtpMutation.reset();
            confirmMutation.mutate(values);
        } else {
            confirmMutation.reset();
            requestOtpMutation.mutate(values);
        }
    };

    // ask for a new code with the same passwords
    const resendCode = () => {
        confirmMutation.reset();
        requestOtpMutation.mutate(getValues());
    };

    // go back and edit the passwords (this discards the current code)
    const editDetails = () => {
        setOtpToken(null);
        setValue("otp", "");
        requestOtpMutation.reset();
        confirmMutation.reset();
    };

    const serverData = (confirmMutation.error ?? requestOtpMutation.error) as HttpErrorLike | null;
    const failed = confirmMutation.isError || requestOtpMutation.isError;
    const showBanner = failed && !serverData?.response?.data?.errors;

    const rules: Record<keyof FormValues, Parameters<typeof register>[1]> = {
        currentPassword: { required: "Enter your current password" },
        newPassword: {
            required: "Enter a new password",
            minLength: { value: 8, message: "Use at least 8 characters" },
            maxLength: { value: 72, message: "Use at most 72 characters" },
            validate: (v) => v !== currentPassword || "New password must be different from the current one",
        },
        confirmPassword: {
            required: "Confirm your new password",
            validate: (v) => v === newPassword || "Passwords do not match",
        },
        otp: {
            validate: (v) => !otpSent || /^\d{6}$/.test(v) || "Enter the 6-digit code",
        },
    };

    return (
        <section className={`${cardCls} p-5 sm:p-8`}>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">Security</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Change password</h2>
            <p className="mt-1 text-sm text-slate-600">
                Use a long, unique password. You will stay signed in on this device.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-5">
                {FIELDS.map((f) => {
                    const error = errors[f.name];
                    return (
                        <div key={f.name}>
                            <label htmlFor={f.name} className="text-sm font-medium text-slate-900">
                                {f.label}
                            </label>
                            <div className="relative mt-2">
                                <input
                                    id={f.name}
                                    type={visible[f.name] ? "text" : "password"}
                                    autoComplete={f.autoComplete}
                                    aria-invalid={Boolean(error)}
                                    readOnly={otpSent}
                                    className={`${fieldCls} pl-4 pr-12 read-only:bg-slate-50 read-only:text-slate-600`}
                                    {...register(f.name, rules[f.name])}
                                />
                                <button
                                    type="button"
                                    onClick={() => setVisible((v) => ({ ...v, [f.name]: !v[f.name] }))}
                                    aria-label={visible[f.name] ? `Hide ${f.label.toLowerCase()}` : `Show ${f.label.toLowerCase()}`}
                                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                >
                                    <Svg className="h-5 w-5">
                                        {visible[f.name] ? (
                                            <>
                                                <path d="M3 3l18 18" />
                                                <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6a14 14 0 0 1-2.6 3M6.1 7.5A14 14 0 0 0 2.5 12C3.5 13.5 7 18 12 18a9.6 9.6 0 0 0 4-.9" />
                                                <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
                                            </>
                                        ) : (
                                            <>
                                                <path d="M2.5 12C3.5 10.5 7 6 12 6s8.5 4.5 9.5 6c-1 1.5-4.5 6-9.5 6s-8.5-4.5-9.5-6Z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </>
                                        )}
                                    </Svg>
                                </button>
                            </div>

                            {error && (
                                <p role="alert" className="mt-1.5 text-xs text-rose-600">
                                    {error.message}
                                </p>
                            )}

                            {f.name === "newPassword" && newPassword.length > 0 && !otpSent && (
                                <div className="mt-3" aria-live="polite">
                                    <div className="flex gap-1.5">
                                        {[1, 2, 3, 4].map((i) => (
                                            <span
                                                key={i}
                                                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.bar : "bg-slate-200"
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <p className={`mt-1.5 text-xs font-medium ${strength.text}`}>
                                        {strength.label}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* ---------- OTP (shown after the code was sent) ---------- */}
                {otpSent && (
                    <div>
                        <label htmlFor="otp" className="text-sm font-medium text-slate-900">
                            Verification code
                        </label>
                        <input
                            id="otp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            placeholder="000000"
                            autoFocus
                            aria-invalid={Boolean(errors.otp)}
                            className={`${fieldCls} mt-2 px-4 text-center font-mono text-lg tracking-[0.5em]`}
                            {...register("otp", rules.otp)}
                        />
                        {errors.otp && (
                            <p role="alert" className="mt-1.5 text-xs text-rose-600">
                                {errors.otp.message}
                            </p>
                        )}

                        <p
                            role="status"
                            className="mt-3 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-800"
                        >
                            We sent a 6-digit code to your admin email. It expires in 10 minutes.
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                            <button
                                type="button"
                                onClick={resendCode}
                                disabled={isPending}
                                className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700 disabled:opacity-50"
                            >
                                {requestOtpMutation.isPending ? "Sending…" : "Resend code"}
                            </button>
                            <button
                                type="button"
                                onClick={editDetails}
                                disabled={isPending}
                                className="font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900 disabled:opacity-50"
                            >
                                Edit details
                            </button>
                        </div>
                    </div>
                )}

                {confirmMutation.isSuccess && (
                    <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        <Svg className="h-4 w-4 shrink-0" strokeWidth={2}>
                            <path d="m5 12 5 5 9-10" />
                        </Svg>
                        Your password has been updated.
                    </p>
                )}

                {showBanner && (
                    <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {serverData?.response?.data?.message ?? "Could not update the password. Please try again."}
                    </p>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            reset();
                            setOtpToken(null);
                            requestOtpMutation.reset();
                            confirmMutation.reset();
                        }}
                        disabled={isPending}
                        className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
                    >
                        Clear
                    </button>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl
                            bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 bg-[length:200%_100%] bg-left
                            px-8 text-sm font-semibold uppercase tracking-[0.16em] text-stone-950
                            ring-1 ring-amber-200/70 shadow-[0_12px_30px_-10px_rgba(217,119,6,0.75)]
                            transition-all duration-500 hover:-translate-y-0.5 hover:bg-right
                            hover:shadow-[0_18px_40px_-10px_rgba(217,119,6,0.9)]
                            active:translate-y-0 active:scale-[0.98]
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2
                            disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-left"
                    >
                        {/* soft shine sweep on hover */}
                        <span className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent transition-all duration-700 group-hover:left-[150%] group-disabled:hidden" />
                        <span className="relative">
                            {isPending
                                ? otpSent
                                    ? "Verifying…"
                                    : "Sending code…"
                                : otpSent
                                    ? "Verify & update"
                                    : "Update password"}
                        </span>
                    </button>
                </div>
            </form>
        </section>
    );
}
