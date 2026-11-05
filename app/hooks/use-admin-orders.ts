"use client";

import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import type {
    OrderI,
    OrderStatus,
    PaymentStatus,
} from "@/app/hooks/use-orders";

const BASE = "/api/auth/admin/orders";

export interface AdminOrderFilters {
    status?: OrderStatus | "";
    paymentStatus?: PaymentStatus | "";
}

export type AdminOrderAction = "cancel" | "collect_cod" | "update_status";

export type AdminNextStatus =
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered";

/** Admin list. Response: { success, data: Omit<OrderI,"items">[] } (latest 100) */
export function useAdminOrders(filters: AdminOrderFilters) {
    return useQuery({
        queryKey: ["admin-orders", filters],
        queryFn: async () =>
            (
                await api.get(BASE, {
                    params: {
                        status: filters.status || undefined,
                        paymentStatus: filters.paymentStatus || undefined,
                    },
                })
            ).data,
        placeholderData: keepPreviousData,
        retry: false,
    });
}

/** Single order with items. Response: { success, data: OrderI } */
export function useAdminOrder(orderId: string | null) {
    return useQuery({
        queryKey: ["admin-orders", "detail", orderId],
        queryFn: async () => (await api.get(`${BASE}/${orderId}`)).data,
        enabled: !!orderId,
        retry: false,
    });
}

/** PATCH { action: "cancel" | "collect_cod" | "update_status", status? } */
export function useAdminOrderAction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            orderId,
            action,
            status,
        }: {
            orderId: string;
            action: AdminOrderAction;
            status?: AdminNextStatus;
        }) =>
            (await api.patch(`${BASE}/${orderId}`, { action, status })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
        },
    });
}

export type AdminOrderRow = Omit<OrderI, "items"> & { items?: OrderI["items"] };

// "use client";

// import {
//     keepPreviousData,
//     useMutation,
//     useQuery,
//     useQueryClient,
// } from "@tanstack/react-query";
// import { api } from "@/app/lib/axios";
// import type {
//     OrderI,
//     OrderStatus,
//     PaymentStatus,
// } from "@/app/hooks/use-orders";

// const BASE = "/api/auth/admin/orders";

// export interface AdminOrderFilters {
//     status?: OrderStatus | "";
//     paymentStatus?: PaymentStatus | "";
// }

// export type AdminOrderAction = "cancel" | "collect_cod";

// /** Admin list. Response: { success, data: Omit<OrderI,"items">[] } (latest 100) */
// export function useAdminOrders(filters: AdminOrderFilters) {
//     return useQuery({
//         queryKey: ["admin-orders", filters],
//         queryFn: async () =>
//             (
//                 await api.get(BASE, {
//                     params: {
//                         status: filters.status || undefined,
//                         paymentStatus: filters.paymentStatus || undefined,
//                     },
//                 })
//             ).data,
//         placeholderData: keepPreviousData,
//         retry: false,
//     });
// }

// /** Single order with items. Response: { success, data: OrderI } */
// export function useAdminOrder(orderId: string | null) {
//     return useQuery({
//         queryKey: ["admin-orders", "detail", orderId],
//         queryFn: async () => (await api.get(`${BASE}/${orderId}`)).data,
//         enabled: !!orderId,
//         retry: false,
//     });
// }

// /** PATCH { action: "cancel" | "collect_cod" } */
// export function useAdminOrderAction() {
//     const queryClient = useQueryClient();

//     return useMutation({
//         mutationFn: async ({
//             orderId,
//             action,
//         }: {
//             orderId: string;
//             action: AdminOrderAction;
//         }) => (await api.patch(`${BASE}/${orderId}`, { action })).data,
//         onSuccess: () => {
//             queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
//         },
//     });
// }

// export type AdminOrderRow = Omit<OrderI, "items"> & { items?: OrderI["items"] };