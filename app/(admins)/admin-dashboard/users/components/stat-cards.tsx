import { Icon } from "./icons";
import { cardCls } from "../lib/constants";
import type { Stats } from "../lib/types";

export function StatCards({ stats }: { stats: Stats | null }) {
    const cards = [
        {
            label: "Total customers",
            value: stats?.total,
            note: "All registered accounts",
            tone: "bg-indigo-50 text-indigo-600 ring-indigo-100",
            icon: (
                <>
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
                    <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
                    <path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
                </>
            ),
        },
        {
            label: "Active",
            value: stats?.active,
            note: "Can log in",
            tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
            icon: (
                <>
                    <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
                    <path d="m9 12 2 2 4-4" />
                </>
            ),
        },
        {
            label: "Blocked",
            value: stats?.blocked,
            note: "Cannot log in",
            tone: "bg-rose-50 text-rose-600 ring-rose-100",
            icon: (
                <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="m5.6 5.6 12.8 12.8" />
                </>
            ),
        },
        {
            label: "New this week",
            value: stats?.newThisWeek,
            note: "Joined in the last 7 days",
            tone: "bg-amber-50 text-amber-600 ring-amber-100",
            icon: (
                <>
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                </>
            ),
        },
    ];

    return (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((s) => (
                <div
                    key={s.label}
                    className={`${cardCls} p-5 transition-transform hover:-translate-y-0.5`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">{s.label}</p>
                        <span
                            className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${s.tone}`}
                        >
                            <Icon>{s.icon}</Icon>
                        </span>
                    </div>
                    {s.value === undefined ? (
                        <div className="mt-4 h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
                    ) : (
                        <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                            {s.value.toLocaleString()}
                        </p>
                    )}
                    <p className="mt-1 text-sm text-slate-500">{s.note}</p>
                </div>
            ))}
        </section>
    );
}