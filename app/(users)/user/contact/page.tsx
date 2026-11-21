"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useSendContact } from "@/app/hooks/use-contact";

/* ---------- edit these to match your store ---------- */
const BRAND = "Aurelia";
const SUPPORT_EMAIL = "support@aurelia.com";
const SUPPORT_PHONE = "+91 91852 52899";
const ADDRESS = ["Aurelia Studio", "Mundow Road", "Pune, Maharashtra 411014"];
const HOURS = [
    { days: "Monday – Friday", time: "9:00 AM – 7:00 PM" },
    { days: "Saturday", time: "10:00 AM – 4:00 PM" },
    { days: "Sunday", time: "Closed" },
];
const RESPONSE_TIME = "within 24 hours";
const MESSAGE_MAX = 1000;

/* ---------- types ---------- */
interface ContactForm {
    fullName: string;
    email: string;
    phone: string;
    subject: string;
    orderId: string;
    message: string;
    website: string; // honeypot: real people never fill this
}

const SUBJECTS = [
    { value: "order", label: "Question about an order" },
    { value: "returns", label: "Returns & refunds" },
    { value: "product", label: "Product information" },
    { value: "vendor", label: "Selling on " + BRAND },
    { value: "feedback", label: "Feedback or suggestion" },
    { value: "other", label: "Something else" },
];

const NEEDS_ORDER_ID = ["order", "returns"];

const FAQS = [
    {
        q: "Where is my order?",
        a: "Open Orders from your account to see its live status. Each order shows whether it is confirmed, processing, shipped or delivered.",
    },
    {
        q: "Can I cancel an order?",
        a: "Yes, while it is still pending or confirmed and no item has started processing. Open the order and choose Cancel order.",
    },
    {
        q: "How do refunds work?",
        a: "Once a refund is approved it is returned to your original payment method. For cash on delivery, we will contact you for refund details.",
    },
    {
        q: "How do I become a vendor?",
        a: "Choose “Selling on " + BRAND + "” in the form and tell us about your products. Our team will follow up with the next steps.",
    },
];

/* ---------- shared style helpers ---------- */
const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const fieldBase =
    "w-full rounded-xl bg-white text-sm text-slate-900 placeholder:text-slate-500 transition focus:outline-none focus:ring-2";

const fieldCls = (invalid: boolean) =>
    `${fieldBase} h-12 px-4 ring-1 ${invalid
        ? "ring-rose-400 focus:ring-rose-400/70"
        : "ring-slate-200 focus:ring-amber-400/70"
    }`;

const Svg = ({
    children,
    className = "h-5 w-5",
    strokeWidth = 1.7,
}: {
    children: ReactNode;
    className?: string;
    strokeWidth?: number;
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {children}
    </svg>
);

const GridTexture = ({ opacity = "opacity-[0.07]" }: { opacity?: string }) => (
    <div
        className={`pointer-events-none absolute inset-0 ${opacity}`}
        style={{
            backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
        }}
    />
);

/* ---------- small components ---------- */
function Field({
    id,
    label,
    optional,
    error,
    hint,
    children,
}: {
    id: string;
    label: string;
    optional?: boolean;
    error?: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div>
            <label
                htmlFor={id}
                className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-900"
            >
                <span>{label}</span>
                {optional && (
                    <span className="text-xs font-normal text-slate-500">
                        Optional
                    </span>
                )}
            </label>

            {children}

            {error ? (
                <p
                    id={`${id}-error`}
                    role="alert"
                    className="mt-1.5 text-xs text-rose-600"
                >
                    {error}
                </p>
            ) : hint ? (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

function InfoRow({
    icon,
    label,
    children,
}: {
    icon: ReactNode;
    label: string;
    children: ReactNode;
}) {
    return (
        <li className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300 ring-1 ring-white/15">
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-400">
                    {label}
                </p>
                <div className="mt-0.5 text-sm text-white">{children}</div>
            </div>
        </li>
    );
}

/* ---------- page ---------- */
export default function ContactPage() {
    const [sent, setSent] = useState(false);
    const send = useSendContact();

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<ContactForm>({
        defaultValues: {
            fullName: "",
            email: "",
            phone: "",
            subject: "",
            orderId: "",
            message: "",
            website: "",
        },
    });

    const subject = watch("subject");
    const messageLength = watch("message")?.length ?? 0;
    const showOrderId = NEEDS_ORDER_ID.includes(subject);

    const serverError = send.error as
        | { response?: { data?: { message?: string } } }
        | null;

    const onSubmit = (values: ContactForm) => {
        // honeypot filled → bot. Pretend it worked and send nothing.
        if (values.website) {
            setSent(true);
            return;
        }

        send.mutate(
            {
                fullName: values.fullName.trim(),
                email: values.email.trim(),
                phone: values.phone.trim() || undefined,
                subject: values.subject,
                orderId:
                    showOrderId && values.orderId.trim()
                        ? values.orderId.trim()
                        : undefined,
                message: values.message.trim(),
            },
            {
                onSuccess: () => {
                    reset();
                    setSent(true);
                },
            }
        );
    };

    return (
        <div className="pb-24">
            {/* ================= HEADER BAND ================= */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
                <GridTexture />

                <div className="relative mx-auto max-w-7xl px-4 pb-28 pt-12 sm:px-6 sm:pb-32 sm:pt-16 lg:px-8">
                    <nav
                        aria-label="Breadcrumb"
                        className="text-xs text-slate-300"
                    >
                        <Link href="/user" className="hover:text-white">
                            Home
                        </Link>
                        <span className="mx-2 text-slate-500">/</span>
                        <span className="text-amber-200">Contact</span>
                    </nav>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">
                                We&apos;re here to help
                            </p>

                            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                                Contact{" "}
                                <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text text-transparent">
                                    us
                                </span>
                            </h1>

                            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                                Questions about an order, a product or selling
                                with {BRAND}? Send us a message and we&apos;ll
                                get back to you {RESPONSE_TIME}.
                            </p>
                        </div>

                        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-amber-200 ring-1 ring-white/15 backdrop-blur">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                            Replies {RESPONSE_TIME}
                        </span>
                    </div>
                </div>
            </section>

            {/* ================= FORM + INFO ================= */}
            <section className="relative z-10 mx-auto -mt-16 max-w-7xl px-4 sm:-mt-20 sm:px-6 lg:px-8">
                <div className="grid gap-6 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_24rem]">
                    {/* ---- form card ---- */}
                    <div className={`${cardCls} p-5 sm:p-8`}>
                        {sent ? (
                            <div
                                role="status"
                                className="mx-auto max-w-md py-8 text-center sm:py-12"
                            >
                                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                                    <Svg className="h-7 w-7" strokeWidth={2}>
                                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                                    </Svg>
                                </span>

                                <h2 className="mt-5 text-xl font-semibold text-slate-900">
                                    Message sent
                                </h2>

                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                    Thanks for reaching out. We&apos;ll reply to
                                    your email {RESPONSE_TIME}.
                                </p>

                                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            send.reset();
                                            setSent(false);
                                        }}
                                        className={goldBtn}
                                    >
                                        Send another message
                                    </button>

                                    <Link
                                        href="/user/shop"
                                        className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-7 text-sm font-semibold text-amber-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                                    >
                                        Back to the shop
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                                    Send us a message
                                </h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    Fields marked optional can be left blank.
                                </p>

                                <form
                                    onSubmit={handleSubmit(onSubmit)}
                                    noValidate
                                    className="mt-6 grid gap-5"
                                >
                                    {/* honeypot (hidden from people and screen readers) */}
                                    <div
                                        aria-hidden="true"
                                        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
                                    >
                                        <label htmlFor="contact-website">
                                            Website
                                        </label>
                                        <input
                                            id="contact-website"
                                            type="text"
                                            tabIndex={-1}
                                            autoComplete="off"
                                            {...register("website")}
                                        />
                                    </div>

                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <Field
                                            id="contact-name"
                                            label="Full name"
                                            error={errors.fullName?.message}
                                        >
                                            <input
                                                id="contact-name"
                                                type="text"
                                                autoComplete="name"
                                                placeholder="Your name"
                                                aria-invalid={!!errors.fullName}
                                                aria-describedby={
                                                    errors.fullName
                                                        ? "contact-name-error"
                                                        : undefined
                                                }
                                                className={fieldCls(
                                                    !!errors.fullName
                                                )}
                                                {...register("fullName", {
                                                    required:
                                                        "Please enter your name",
                                                    minLength: {
                                                        value: 2,
                                                        message:
                                                            "Name is too short",
                                                    },
                                                    maxLength: {
                                                        value: 80,
                                                        message:
                                                            "Name is too long",
                                                    },
                                                })}
                                            />
                                        </Field>

                                        <Field
                                            id="contact-email"
                                            label="Email"
                                            error={errors.email?.message}
                                        >
                                            <input
                                                id="contact-email"
                                                type="email"
                                                autoComplete="email"
                                                inputMode="email"
                                                placeholder="you@example.com"
                                                aria-invalid={!!errors.email}
                                                aria-describedby={
                                                    errors.email
                                                        ? "contact-email-error"
                                                        : undefined
                                                }
                                                className={fieldCls(
                                                    !!errors.email
                                                )}
                                                {...register("email", {
                                                    required:
                                                        "Please enter your email",
                                                    pattern: {
                                                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                                        message:
                                                            "Enter a valid email address",
                                                    },
                                                })}
                                            />
                                        </Field>
                                    </div>

                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <Field
                                            id="contact-phone"
                                            label="Phone"
                                            optional
                                            error={errors.phone?.message}
                                        >
                                            <input
                                                id="contact-phone"
                                                type="tel"
                                                autoComplete="tel"
                                                inputMode="tel"
                                                placeholder="+91 98765 43210"
                                                aria-invalid={!!errors.phone}
                                                aria-describedby={
                                                    errors.phone
                                                        ? "contact-phone-error"
                                                        : undefined
                                                }
                                                className={fieldCls(
                                                    !!errors.phone
                                                )}
                                                {...register("phone", {
                                                    pattern: {
                                                        value: /^[0-9+\-()\s]{7,20}$/,
                                                        message:
                                                            "Enter a valid phone number",
                                                    },
                                                })}
                                            />
                                        </Field>

                                        <Field
                                            id="contact-subject"
                                            label="Topic"
                                            error={errors.subject?.message}
                                        >
                                            <div className="relative">
                                                <select
                                                    id="contact-subject"
                                                    aria-invalid={
                                                        !!errors.subject
                                                    }
                                                    aria-describedby={
                                                        errors.subject
                                                            ? "contact-subject-error"
                                                            : undefined
                                                    }
                                                    className={`${fieldCls(
                                                        !!errors.subject
                                                    )} cursor-pointer appearance-none pr-11`}
                                                    {...register("subject", {
                                                        required:
                                                            "Please choose a topic",
                                                    })}
                                                >
                                                    <option value="">
                                                        Select a topic
                                                    </option>
                                                    {SUBJECTS.map((s) => (
                                                        <option
                                                            key={s.value}
                                                            value={s.value}
                                                        >
                                                            {s.label}
                                                        </option>
                                                    ))}
                                                </select>

                                                <Svg
                                                    className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                                                    strokeWidth={2}
                                                >
                                                    <path d="m6 9 6 6 6-6" />
                                                </Svg>
                                            </div>
                                        </Field>
                                    </div>

                                    {showOrderId && (
                                        <Field
                                            id="contact-order"
                                            label="Order number"
                                            optional
                                            error={errors.orderId?.message}
                                            hint="Find it on your Orders page, for example #A1B2C3D4."
                                        >
                                            <input
                                                id="contact-order"
                                                type="text"
                                                autoComplete="off"
                                                placeholder="#A1B2C3D4"
                                                aria-invalid={!!errors.orderId}
                                                aria-describedby={
                                                    errors.orderId
                                                        ? "contact-order-error"
                                                        : "contact-order-hint"
                                                }
                                                className={fieldCls(
                                                    !!errors.orderId
                                                )}
                                                {...register("orderId", {
                                                    maxLength: {
                                                        value: 60,
                                                        message:
                                                            "Order number is too long",
                                                    },
                                                })}
                                            />
                                        </Field>
                                    )}

                                    <Field
                                        id="contact-message"
                                        label="Message"
                                        error={errors.message?.message}
                                    >
                                        <textarea
                                            id="contact-message"
                                            rows={6}
                                            placeholder="How can we help?"
                                            aria-invalid={!!errors.message}
                                            aria-describedby={
                                                errors.message
                                                    ? "contact-message-error"
                                                    : undefined
                                            }
                                            className={`${fieldBase} resize-y px-4 py-3 ring-1 ${errors.message
                                                ? "ring-rose-400 focus:ring-rose-400/70"
                                                : "ring-slate-200 focus:ring-amber-400/70"
                                                }`}
                                            {...register("message", {
                                                required:
                                                    "Please write a message",
                                                minLength: {
                                                    value: 20,
                                                    message:
                                                        "Please add a little more detail (at least 20 characters)",
                                                },
                                                maxLength: {
                                                    value: MESSAGE_MAX,
                                                    message: `Keep it under ${MESSAGE_MAX} characters`,
                                                },
                                            })}
                                        />
                                        <p
                                            className={`mt-1.5 text-right text-xs ${messageLength > MESSAGE_MAX
                                                ? "text-rose-600"
                                                : "text-slate-500"
                                                }`}
                                            aria-live="polite"
                                        >
                                            {messageLength}/{MESSAGE_MAX}
                                        </p>
                                    </Field>

                                    {send.isError && (
                                        <p
                                            role="alert"
                                            className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
                                        >
                                            {serverError?.response?.data
                                                ?.message ??
                                                "We couldn't send your message. Please try again."}
                                        </p>
                                    )}

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs leading-relaxed text-slate-500">
                                            We only use your details to reply to
                                            this message.
                                        </p>

                                        <button
                                            type="submit"
                                            disabled={send.isPending}
                                            className={`${goldBtn} w-full sm:w-auto`}
                                        >
                                            {send.isPending
                                                ? "Sending…"
                                                : "Send message"}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>

                    {/* ---- info column ---- */}
                    <aside className="space-y-6" aria-label="Contact details">
                        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.4)] ring-1 ring-slate-900 sm:p-8">
                            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
                            <GridTexture opacity="opacity-[0.05]" />

                            <h2 className="relative text-lg font-semibold">
                                Reach us directly
                            </h2>

                            <ul className="relative mt-6 space-y-6">
                                <InfoRow
                                    label="Email"
                                    icon={
                                        <Svg>
                                            <rect
                                                x="3"
                                                y="5"
                                                width="18"
                                                height="14"
                                                rx="2"
                                            />
                                            <path d="m3.5 7 8.5 6 8.5-6" />
                                        </Svg>
                                    }
                                >
                                    <a
                                        href={`mailto:${SUPPORT_EMAIL}`}
                                        className="break-all underline-offset-4 hover:text-amber-200 hover:underline focus-visible:outline-none focus-visible:underline"
                                    >
                                        {SUPPORT_EMAIL}
                                    </a>
                                </InfoRow>

                                <InfoRow
                                    label="Phone"
                                    icon={
                                        <Svg>
                                            <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
                                        </Svg>
                                    }
                                >
                                    <a
                                        href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                                        className="underline-offset-4 hover:text-amber-200 hover:underline focus-visible:outline-none focus-visible:underline"
                                    >
                                        {SUPPORT_PHONE}
                                    </a>
                                </InfoRow>

                                <InfoRow
                                    label="Studio"
                                    icon={
                                        <Svg>
                                            <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
                                            <circle cx="12" cy="9.5" r="2.5" />
                                        </Svg>
                                    }
                                >
                                    <address className="not-italic leading-relaxed text-slate-200">
                                        {ADDRESS.map((line) => (
                                            <span key={line} className="block">
                                                {line}
                                            </span>
                                        ))}
                                    </address>
                                </InfoRow>
                            </ul>
                        </div>

                        <div className={`${cardCls} p-6 sm:p-8`}>
                            <h2 className="text-lg font-semibold text-slate-900">
                                Support hours
                            </h2>

                            <dl className="mt-4 divide-y divide-slate-100 text-sm">
                                {HOURS.map((h) => (
                                    <div
                                        key={h.days}
                                        className="flex justify-between gap-4 py-2.5"
                                    >
                                        <dt className="text-slate-600">
                                            {h.days}
                                        </dt>
                                        <dd
                                            className={`text-right font-medium ${h.time === "Closed"
                                                ? "text-slate-500"
                                                : "text-slate-900"
                                                }`}
                                        >
                                            {h.time}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    </aside>
                </div>
            </section>

            {/* ================= FAQ ================= */}
            <section
                aria-labelledby="faq-heading"
                className="mx-auto mt-16 max-w-3xl px-4 sm:px-6 lg:px-8"
            >
                <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-amber-600">
                    Quick answers
                </p>
                <h2
                    id="faq-heading"
                    className="mt-2 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
                >
                    Frequently asked questions
                </h2>

                <div className="mt-8 space-y-3">
                    {FAQS.map((f) => (
                        <details
                            key={f.q}
                            className={`${cardCls} group rounded-2xl px-5 py-4 open:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.28)] sm:px-6`}
                        >
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:text-base [&::-webkit-details-marker]:hidden">
                                {f.q}
                                <Svg
                                    className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                                    strokeWidth={2}
                                >
                                    <path d="m6 9 6 6 6-6" />
                                </Svg>
                            </summary>

                            <p className="mt-3 text-sm leading-relaxed text-slate-600">
                                {f.a}
                            </p>
                        </details>
                    ))}
                </div>
            </section>
        </div>
    );
}