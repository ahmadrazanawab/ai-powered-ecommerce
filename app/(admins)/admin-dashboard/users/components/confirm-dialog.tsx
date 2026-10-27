import { useEffect } from "react";
import { Icon } from "./icons";
import { cardCls, dialogCopy } from "../lib/constants";
import type { DialogState, DialogType } from "../lib/types";
import { displayName } from "../lib/utils";

const iconByType: Record<DialogType, { tone: string; icon: React.ReactNode }> = {
    block: {
        tone: "bg-rose-50 text-rose-600 ring-rose-100",
        icon: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="m5.6 5.6 12.8 12.8" />
            </>
        ),
    },
    unblock: {
        tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
        icon: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="m9 12 2 2 4-4" />
            </>
        ),
    },
    delete: {
        tone: "bg-slate-100 text-slate-700 ring-slate-200",
        icon: (
            <>
                <path d="M4 7h16" />
                <path d="M10 11v6M14 11v6" />
                <path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                <path d="M9 7V4h6v3" />
            </>
        ),
    },
};

export function ConfirmDialog({
    dialog,
    reason,
    onReasonChange,
    error,
    busy,
    onClose,
    onConfirm,
}: {
    dialog: NonNullable<DialogState>;
    reason: string;
    onReasonChange: (value: string) => void;
    error: string | null;
    busy: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    const copy = dialogCopy[dialog.type];
    const visual = iconByType[dialog.type];

    // close with Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !busy) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [busy, onClose]);

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                className={`${cardCls} w-full max-w-md p-6`}
            >
                <div className="flex items-start gap-4">
                    <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ${visual.tone}`}
                    >
                        <Icon>{visual.icon}</Icon>
                    </span>
                    <div>
                        <h2 id="dialog-title" className="text-lg font-semibold text-slate-900">
                            {copy.title}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {copy.body(displayName(dialog.user))}
                        </p>
                    </div>
                </div>

                {dialog.type === "unblock" && dialog.user.blockedReason && (
                    <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200/70">
                        Blocked for: {dialog.user.blockedReason}
                    </p>
                )}

                {dialog.type === "block" && (
                    <div className="mt-4">
                        <label htmlFor="block-reason" className="text-sm font-medium text-slate-700">
                            Reason
                        </label>
                        <textarea
                            id="block-reason"
                            autoFocus
                            rows={3}
                            maxLength={300}
                            value={reason}
                            onChange={(e) => onReasonChange(e.target.value)}
                            placeholder="For example: multiple failed payment attempts"
                            className="mt-1.5 w-full rounded-xl border-0 bg-slate-50 p-3 text-sm text-slate-900 ring-1 ring-slate-200/70 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                )}

                {error && (
                    <p role="alert" className="mt-3 text-sm text-rose-700">
                        {error}
                    </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="h-10 rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={`h-10 rounded-xl px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${copy.tone}`}
                    >
                        {busy ? "Saving" : copy.confirm}
                    </button>
                </div>
            </div>
        </div>
    );
}