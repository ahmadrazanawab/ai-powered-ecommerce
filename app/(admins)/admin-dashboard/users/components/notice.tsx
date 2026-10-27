import { Icon } from "./icons";

export function Notice({ message }: { message: string }) {
    return (
        <div
            role="status"
            className="fixed inset-x-4 bottom-4 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.5)] sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-6"
        >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
                <Icon className="h-4 w-4">
                    <path d="m5 12 5 5 9-10" />
                </Icon>
            </span>
            {message}
        </div>
    );
}