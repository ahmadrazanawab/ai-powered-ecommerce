"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

export interface OrderInvoice {
    id: string;
    invoiceNumber: string | null;
    sellerName: string;
    invoiceType: "tax_invoice" | "bill_of_supply" | "commercial_invoice" | null;
    status: "ready" | "generating" | "failed" | "unavailable";
}

interface OrderInvoicesResponse {
    state: "locked" | "generating" | "failed" | "ready" | "unavailable";
    invoices: OrderInvoice[];
}

export function useOrderInvoices(orderId: string, enabled: boolean) {
    return useQuery({
        queryKey: ["order-invoices", orderId],
        queryFn: async () =>
            (
                await api.get<{ data: OrderInvoicesResponse }>(
                    `/api/orders/${orderId}/invoices`
                )
            ).data.data,
        enabled,
        retry: false,
        refetchInterval: (query) =>
            query.state.data?.state === "generating" ? 3000 : false,
    });
}
