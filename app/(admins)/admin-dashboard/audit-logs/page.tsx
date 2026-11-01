"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import { useEffect, useState } from "react";
type auditLogsI = {
    userId: string,
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    resean: string,
    createdAt: string
}
const page = () => {
    const [isAdmin, setIsAdmin] = useState(true);
    useEffect(() => {
        const saveToken = localStorage.getItem("admin_token");
        setIsAdmin(Boolean(saveToken));
    }, []);

    const { data, isPending, isError, error } = useQuery({
        queryKey: ["getAdminAuditLogs"],
        queryFn: async () => {
            const response = await api.get("/api/auth/admin/admin-audit-logs");
            return response.data;
        },
        enabled: isAdmin
    })
    //  const Vendors: VendorI[] = data?.vendorDetails
    //     ? (Array.isArray(data.vendorDetails) ? data.vendorDetails : [data.vendorDetails])
    //     : [];
    const AdminAuditLog: auditLogsI[] = data?.getAuditLogs
        ? (Array.isArray(data.getAuditLogs) ? data.getAuditLogs : [data.getAuditLogs]) : [];

    console.log("admin data : ", AdminAuditLog);
    console.log("isPending: ", isPending);
    return (
        <div className="m-auto">
            <div className="p-10">
                {AdminAuditLog.map((a) => {
                    return <div key={a.userId} className="my-2 shadow-md bg-slate-200 rounded-2xl">
                        <p className="my-2 text-xl">{a.userId}</p>
                        <p className="my-2 text-xl">{a.action}</p>
                        <p className="my-2 text-xl">{a.resean}</p>
                        <p className="my-2 text-xl">{a.adminId}</p>
                        <p className="my-2 text-xl">{a.targetType}</p>
                        <p className="my-2 text-xl">{a.targetId}</p>
                        <p className="my-2 text-xl">{a.createdAt}</p>                        
                    </div>
                })}
            </div>
        </div>
    )
}

export default page
