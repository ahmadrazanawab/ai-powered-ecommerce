"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

export interface ContactInput {
    fullName: string;
    email: string;
    phone?: string;
    subject: string;
    orderId?: string;
    message: string;
}

/** POST /api/contact → { success, message } */
export function useSendContact() {
    return useMutation({
        mutationFn: async (input: ContactInput) =>
            (await api.post("/api/contact", input)).data,
    });
}