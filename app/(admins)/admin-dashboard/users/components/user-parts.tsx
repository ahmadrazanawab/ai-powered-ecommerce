import { Icon } from "./icons";
import type { DialogType, User } from "../lib/types";
import { initials } from "../lib/utils";

export function NotProvided() {
    return <span className="text-slate-400">Not provided</span>;
}

export function Avatar({ user }: { user: User }) {
    return (
        <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ring-1 ${
                user.isBlocked
                    ? "bg-slate-100 text-slate-500 ring-slate-200"
                    : "bg-indigo-50 text-indigo-600 ring-indigo-100"
            }`}
        >
            {initials(user)}
        </span>
    );
}

export function StatusBadge({ user }: { user: User }) {
    return user.isBlocked ? (
        <span
            title={user.blockedReason ? `Reason: ${user.blockedReason}` : undefined}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200"
        >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Blocked
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
        </span>
    );
}

export function ActionButtons({
    user,
    isSuperAdmin,
    onAction,
}: {
    user: User;
    isSuperAdmin: boolean;
    onAction: (type: DialogType, user: User) => void;
}) {
    const base =
        "inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium ring-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
    return (
        <div className="flex flex-wrap items-center gap-2">
            {user.isBlocked ? (
                <button
                    type="button"
                    onClick={() => onAction("unblock", user)}
                    className={`${base} text-emerald-700 ring-emerald-200 hover:bg-emerald-50`}
                >
                    <Icon className="h-4 w-4">
                        <circle cx="12" cy="12" r="9" />
                        <path d="m9 12 2 2 4-4" />
                    </Icon>
                    Unblock
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onAction("block", user)}
                    className={`${base} text-rose-700 ring-rose-200 hover:bg-rose-50`}
                >
                    <Icon className="h-4 w-4">
                        <circle cx="12" cy="12" r="9" />
                        <path d="m5.6 5.6 12.8 12.8" />
                    </Icon>
                    Block
                </button>
            )}
            {isSuperAdmin && (
                <button
                    type="button"
                    onClick={() => onAction("delete", user)}
                    className={`${base} text-slate-700 ring-slate-200 hover:bg-slate-50`}
                >
                    <Icon className="h-4 w-4">
                        <path d="M4 7h16" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                        <path d="M9 7V4h6v3" />
                    </Icon>
                    Delete
                </button>
            )}
        </div>
    );
}