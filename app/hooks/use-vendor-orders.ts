"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import type { FulfillmentStatus, OrderI, OrderItemI } from "@/app/hooks/use-orders";

const BASE = "/api/auth/vendor/orders";

/** One row = one of this vendor's items plus its parent order. */
export interface VendorOrderRow {
    item: OrderItemI;
    order: Omit<OrderI, "items">;
}

export type VendorNextStatus = Exclude<FulfillmentStatus, "pending">;

/** Response: { success, data: VendorOrderRow[] } */
export function useVendorOrders() {
    return useQuery({
        queryKey: ["vendor-orders"],
        queryFn: async () => (await api.get(BASE)).data,
        staleTime: 30 * 1000,
        retry: false,
    });
}

/** PATCH /:itemId { status } */
export function useUpdateFulfillment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            itemId,
            status,
        }: {
            itemId: string;
            status: VendorNextStatus;
        }) => (await api.patch(`${BASE}/${itemId}`, { status })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
        },
    });
}