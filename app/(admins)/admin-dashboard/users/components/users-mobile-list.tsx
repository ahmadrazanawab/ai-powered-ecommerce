import { ActionButtons, Avatar, NotProvided, StatusBadge } from "./user-parts";
import type { DialogType, User } from "../lib/types";
import { formatDate } from "../lib/utils";

export function UsersMobileList({
    users,
    isSuperAdmin,
    onAction,
}: {
    users: User[];
    isSuperAdmin: boolean;
    onAction: (type: DialogType, user: User) => void;
}) {
    return (
        <ul className="mt-5 space-y-3 md:hidden">
            {users.map((u) => (
                <li key={u.userId} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                    <div className="flex items-start gap-3">
                        <Avatar user={u} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-slate-900">
                                    {u.name?.trim() || <NotProvided />}
                                </p>
                                <StatusBadge user={u} />
                            </div>
                            <p className="mt-1 break-words text-sm text-slate-500">
                                {u.email || "No email"}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-500">
                                {u.mobileNo || "No mobile number"}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-500">
                                Joined {formatDate(u.createdAt)}
                            </p>
                            <div className="mt-3">
                                <ActionButtons
                                    user={u}
                                    isSuperAdmin={isSuperAdmin}
                                    onAction={onAction}
                                />
                            </div>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}