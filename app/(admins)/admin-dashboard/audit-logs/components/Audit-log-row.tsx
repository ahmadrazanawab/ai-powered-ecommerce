// FILE: app/components/admin/audit-log-row.tsx
"use client";

import { useState } from "react";
import { Svg, cardCls } from "@/app/components/Shop-ui";

/* the API returns `userId` for the log's own id and `resean` for the reason */
export interface AuditLogI {
    userId: string; // log id
    adminId: string;
    action: string;
    targetType: string;
    targetId: string;
    resean: string | null; // reason
    createdAt: string;
}

/* ---------- helpers (also used by the page) ---------- */
export function actionLabel(action: string) {
    const text = action.replace(/[_-]+/g, " ").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

type Tone = "positive" | "negative" | "info" | "neutral";

function toneOf(action: string): Tone {
    const a = action.toLowerCase();
    // negative first: "deactivate" contains "activate"
    if (/(reject|delete|remove|suspend|block|deactivate|disable|ban|revoke)/.test(a)) return "negative";
    if (/(approve|activate|enable|create|add|verify|restore)/.test(a)) return "positive";
    if (/(update|edit|change|modify)/.test(a)) return "info";
    return "neutral";
}

const TONES: Record<Tone, { badge: string; icon: string; path: React.ReactNode }> = {
    positive: {
        badge: "bg-emerald-50 text-emerald-700",
        icon: "bg-emerald-50 text-emerald-700",
        path: <path d="m5 12 5 5 9-10" />,
    },
    negative: {
        badge: "bg-rose-50 text-rose-700",
        icon: "bg-rose-50 text-rose-700",
        path: <path d="M6 6l12 12M18 6 6 18" />,
    },
    info: {
        badge: "bg-indigo-50 text-indigo-700",
        icon: "bg-indigo-50 text-indigo-700",
        path: (
            <>
                <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
                <path d="m13.5 6.5 4 4" />
            </>
        ),
    },
    neutral: {
        badge: "bg-slate-100 text-slate-600",
        icon: "bg-slate-900 text-amber-300",
        path: (
            <>
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4l3 2" />
            </>
        ),
    },
};

const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id);

function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diff)) return "";
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fullDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/* ---------- copy button ---------- */
function CopyId({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard blocked: ignore */
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            title={`Copy ${label.toLowerCase()}`}
            aria-label={`Copy ${label.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
            <span className="font-sans font-medium text-slate-500">{label}</span>
            {copied ? "Copied" : shortId(value)}
            <Svg className="h-3.5 w-3.5 text-slate-500" strokeWidth={2}>
                {copied ? (
                    <path d="m5 12 5 5 9-10" />
                ) : (
                    <>
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
                    </>
                )}
            </Svg>
        </button>
    );
}

/* ---------- row ---------- */
export default function AuditLogRow({ log }: { log: AuditLogI }) {
    const [open, setOpen] = useState(false);
    const tone = TONES[toneOf(log.action)];
    const hasReason = Boolean(log.resean && log.resean.trim());

    return (
        <article className={`${cardCls} p-4 sm:p-5`}>
            <div className="flex items-start gap-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone.icon}`}>
                    <Svg className="h-5 w-5" strokeWidth={2}>
                        {tone.path}
                    </Svg>
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
                            {actionLabel(log.action)}
                        </h3>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone.badge}`}>
                            {log.targetType}
                        </span>
                    </div>

                    <p
                        className={`mt-1.5 text-sm leading-relaxed ${hasReason ? "text-slate-600" : "italic text-slate-500"
                            } ${open ? "" : "line-clamp-2"}`}
                    >
                        {hasReason ? log.resean : "No reason provided"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <CopyId label="Target" value={log.targetId} />
                        <CopyId label="Admin" value={log.adminId} />
                        <span className="text-xs text-slate-500 sm:hidden" title={fullDate(log.createdAt)}>
                            {relativeTime(log.createdAt)}
                        </span>
                    </div>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-medium text-slate-900">{relativeTime(log.createdAt)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{fullDate(log.createdAt)}</p>
                </div>
            </div>

            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
                {open ? "Hide details" : "Show details"}
                <Svg className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2}>
                    <path d="m6 9 6 6 6-6" />
                </Svg>
            </button>

            {open && (
                <dl className="mt-4 grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                    {[
                        ["Log ID", log.userId],
                        ["Admin ID", log.adminId],
                        ["Target type", log.targetType],
                        ["Target ID", log.targetId],
                        ["Date and time", fullDate(log.createdAt)],
                    ].map(([term, value]) => (
                        <div key={term} className="min-w-0">
                            <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                                {term}
                            </dt>
                            <dd className="mt-1 break-all font-medium text-slate-900">{value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </article>
    );
}