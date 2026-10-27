import { Icon } from "./icons";

export function UsersSkeleton() {
    return (
        <ul className="mt-5 divide-y divide-slate-100" aria-busy="true" aria-label="Loading customers">
            {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 py-4">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-40 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-56 animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="hidden h-6 w-20 animate-pulse rounded-full bg-slate-100 sm:block" />
                </li>
            ))}
        </ul>
    );
}

export function UsersEmpty({
    hasFilters,
    onClear,
}: {
    hasFilters: boolean;
    onClear: () => void;
}) {
    return (
        <div className="mt-5 rounded-2xl bg-slate-50 px-6 py-12 text-center ring-1 ring-slate-200/70">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-500 ring-1 ring-slate-200">
                <Icon>
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
                </Icon>
            </span>
            <p className="mt-4 text-sm font-medium text-slate-900">
                {hasFilters ? "No customers match your search" : "No customers yet"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
                {hasFilters
                    ? "Try a different name, email or mobile number, or clear the filter."
                    : "New customer accounts will appear here once they sign up."}
            </p>
            {hasFilters && (
                <button
                    type="button"
                    onClick={onClear}
                    className="mt-4 h-10 rounded-xl bg-white px-4 text-sm font-medium text-slate-900 ring-1 ring-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                    Clear search and filter
                </button>
            )}
        </div>
    );
}

export function UsersError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div
            role="alert"
            className="mt-5 flex flex-col gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200 sm:flex-row sm:items-center sm:justify-between"
        >
            <div>
                <p className="text-sm font-medium text-rose-800">Could not load customers</p>
                <p className="mt-0.5 text-sm text-rose-700">{message}</p>
            </div>
            <button
                type="button"
                onClick={onRetry}
                className="h-10 rounded-xl bg-white px-4 text-sm font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
                Try again
            </button>
        </div>
    );
}