"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

export interface WishlistItemI {
    wishlistItemId: string;
    listingId: string;
    available: boolean; // false when the vendor offer was removed
    message?: string;
    productId?: string;
    name?: string;
    slug?: string;
    description?: string | null;
    imageUrl?: string | null;
    categoryName?: string;
    vendorId?: string;
    vendorName?: string;
    price?: string | number;
    stock?: number;
    addedAt?: string;
}

/** Response: { success, data: { items: WishlistItemI[], totalItems: number } } */
export function useWishlist() {
    return useQuery({
        queryKey: ["wishlist"],
        queryFn: async () => (await api.get("/api/wishlist")).data,
        staleTime: 60 * 1000,
        retry: false,
    });
}

/** POST { listingId } — use this for heart buttons on product cards. */
export function useAddToWishlist() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (listingId: string) =>
            (await api.post("/api/wishlist/items", { listingId })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wishlist"] });
        },
    });
}

/** DELETE /api/wishlist/items/:wishlistItemId */
export function useRemoveFromWishlist() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (wishlistItemId: string) =>
            (await api.delete(`/api/wishlist/items/${wishlistItemId}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wishlist"] });
        },
    });
}