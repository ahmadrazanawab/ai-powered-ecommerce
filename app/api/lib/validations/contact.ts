// file : app/lib/validations/contact.ts
// Shared by the API route (server) and, optionally, the contact form (client).
import { z } from "zod";

export const CONTACT_SUBJECTS = [
  "order",
  "returns",
  "product",
  "vendor",
  "feedback",
  "other",
] as const;

export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 1000;

const PHONE_RE = /^[0-9+\-()\s]{7,20}$/;

export const contactSchema = z.object({
  fullName: z
    .string({ message: "Please enter your name" })
    .trim()
    .min(2, "Please enter your name (at least 2 characters)")
    .max(80, "Name must be 80 characters or fewer"),

  email: z
    .string({ message: "Please enter your email" })
    .trim()
    .toLowerCase()
    .max(254, "Email is too long")
    .email("Enter a valid email address"),

  // optional; blank → undefined
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE_RE.test(v), "Enter a valid phone number")
    .optional()
    .transform((v) => v || undefined),

  subject: z.enum(CONTACT_SUBJECTS, { message: "Please choose a topic" }),

  // optional order number as typed, e.g. "#A1B2C3D4"; blank → undefined
  orderId: z
    .string()
    .trim()
    .max(60, "Order number is too long")
    .optional()
    .transform((v) => v || undefined),

  message: z
    .string({ message: "Please write a message" })
    .trim()
    .min(
      MESSAGE_MIN,
      `Please add a little more detail (at least ${MESSAGE_MIN} characters)`
    )
    .max(MESSAGE_MAX, `Message must be ${MESSAGE_MAX} characters or fewer`),
});

export type ContactPayload = z.output<typeof contactSchema>;
export type ContactFormInput = z.input<typeof contactSchema>;