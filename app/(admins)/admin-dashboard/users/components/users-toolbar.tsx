import { Icon } from "./icons";
import { filters } from "../lib/constants";
import type { Stats, StatusFilter } from "../lib/types";

export function UsersToolbar({
    searchInput,
    onSearchChange,
    status,
    onStatusChange,
    stats,
}: {
    searchInput: string;
    onSearchChange: (value: string) => void;
    status: StatusFilter;
    onStatusChange: (value: StatusFilter) => void;
    stats: Stats | null;
}) {
    const counts: Record<StatusFilter, number | undefined> = {
        all: stats?.total,
        active: stats?.active,
        blocked: stats?.blocked,
    };

    return (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
                <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                </Icon>
                <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search name, email or mobile"
                    aria-label="Search customers"
                    className="h-11 w-full rounded-xl border-0 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <div
                className="inline-flex w-full rounded-xl bg-slate-100 p-1 lg:w-auto"
                role="tablist"
                aria-label="Filter by status"
            >
                {filters.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        role="tab"
                        aria-selected={status === f.key}
                        onClick={() => onStatusChange(f.key)}
                        className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:flex-none ${
                            status === f.key
                                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        {f.label}
                        {counts[f.key] !== undefined && (
                            <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">
                                {counts[f.key]!.toLocaleString()}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}