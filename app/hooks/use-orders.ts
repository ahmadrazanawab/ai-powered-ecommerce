"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

export type OrderStatus =
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled";

export type PaymentStatus =
    | "pending"
    | "processing"
    | "paid"
    | "succeeded"
    | "failed"
    | "refunded"
    | "cancelled";

export type FulfillmentStatus =
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled";

export interface OrderItemI {
    id: string;
    orderId: string;
    vendorId: string;
    listingId: string;
    productId: string;
    productName: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    fulfillmentStatus: FulfillmentStatus;
    stockRestored: boolean;
    createdAt: string;
}

export interface ShippingAddressI {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string | null;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}

export interface OrderI {
    id: string;
    userId: string;
    addressId: string | null;
    shippingAddress: ShippingAddressI;
    subtotal: string;
    currency: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentIntentId: string | null;
    paymentMethod: "cod" | "online";
    createdAt: string;
    updatedAt: string;
    items: OrderItemI[];
}

/** Customer orders. Response: { success, data: OrderI[] } */
export function useOrders() {
    return useQuery({
        queryKey: ["orders"],
        queryFn: async () => (await api.get("/api/orders")).data,
        staleTime: 30 * 1000,
        retry: false,
    });
}

/** Single order. Response: { success, data: OrderI } */
export function useOrder(orderId: string | undefined) {
    return useQuery({
        queryKey: ["orders", orderId],
        queryFn: async () => (await api.get(`/api/orders/${orderId}`)).data,
        enabled: !!orderId,
        retry: false,
    });
}

export function useCancelOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderId: string) =>
            (await api.post(`/api/orders/${orderId}/cancel`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
    });
}