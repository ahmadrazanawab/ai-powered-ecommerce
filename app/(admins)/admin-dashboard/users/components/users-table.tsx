import { ActionButtons, Avatar, NotProvided, StatusBadge } from "./user-parts";
import type { DialogType, User } from "../lib/types";
import { formatDate } from "../lib/utils";

export function UsersTable({
    users,
    isSuperAdmin,
    onAction,
}: {
    users: User[];
    isSuperAdmin: boolean;
    onAction: (type: DialogType, user: User) => void;
}) {
    return (
        <div className="mt-5 hidden overflow-x-auto rounded-2xl ring-1 ring-slate-200/70 md:block">
            <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50/80">
                    <tr className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Joined</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                        <tr
                            key={u.userId}
                            className={`transition-colors hover:bg-slate-50/70 ${
                                u.isBlocked ? "bg-rose-50/30" : ""
                            }`}
                        >
                            <td className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                    <Avatar user={u} />
                                    <span className="text-sm font-medium text-slate-900">
                                        {u.name?.trim() || <NotProvided />}
                                    </span>
                                </div>
                            </td>
                            <td className="max-w-[240px] px-4 py-3.5">
                                <p className="break-words text-sm text-slate-700">
                                    {u.email || <NotProvided />}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    {u.mobileNo || "No mobile number"}
                                </p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-700">
                                {formatDate(u.createdAt)}
                                <p className="mt-0.5 text-xs text-slate-500">
                                    Last login {formatDate(u.lastLoginAt)}
                                </p>
                            </td>
                            <td className="px-4 py-3.5">
                                <StatusBadge user={u} />
                                {u.isBlocked && u.blockedReason && (
                                    <p
                                        title={u.blockedReason}
                                        className="mt-1 max-w-[180px] truncate text-xs text-slate-500"
                                    >
                                        {u.blockedReason}
                                    </p>
                                )}
                            </td>
                            <td className="px-4 py-3.5">
                                <ActionButtons
                                    user={u}
                                    isSuperAdmin={isSuperAdmin}
                                    onAction={onAction}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}