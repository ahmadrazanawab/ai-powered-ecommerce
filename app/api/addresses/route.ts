

import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { addresses } from "@/app/api/lib/schema/checkout-schema";
import { requireCustomer } from "@/app/api/lib/customer-auth";

export async function GET() {
    try {
        const auth = await requireCustomer();

        if (!auth.customerId) {
            return auth.response;
        }

        const data = await db
            .select()
            .from(addresses)
            .where(eq(addresses.userId, auth.customerId))
            .orderBy(desc(addresses.createdAt));

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("GET_ADDRESSES_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch addresses",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireCustomer();

        if (!auth.customerId) {
            return auth.response;
        }

        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid JSON request body",
                },
                { status: 400 }
            );
        }

        if (
            typeof body !== "object" ||
            body === null ||
            Array.isArray(body)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Request body must be a JSON object",
                },
                { status: 400 }
            );
        }

        const input = body as Record<string, unknown>;

        const requiredFields = [
            "fullName",
            "phone",
            "addressLine1",
            "city",
            "state",
            "postalCode",
        ] as const;

        for (const field of requiredFields) {
            if (
                typeof input[field] !== "string" ||
                !input[field].trim()
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${field} is required`,
                    },
                    { status: 400 }
                );
            }
        }

        if (
            input.addressLine2 !== undefined &&
            input.addressLine2 !== null &&
            typeof input.addressLine2 !== "string"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "addressLine2 must be a string",
                },
                { status: 400 }
            );
        }

        if (
            input.country !== undefined &&
            input.country !== null &&
            typeof input.country !== "string"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "country must be a string",
                },
                { status: 400 }
            );
        }

        const [address] = await db
            .insert(addresses)
            .values({
                userId: auth.customerId,
                fullName: (input.fullName as string).trim(),
                phone: (input.phone as string).trim(),
                addressLine1: (input.addressLine1 as string).trim(),
                addressLine2:
                    typeof input.addressLine2 === "string"
                        ? input.addressLine2.trim() || null
                        : null,
                city: (input.city as string).trim(),
                state: (input.state as string).trim(),
                postalCode: (input.postalCode as string).trim(),
                country:
                    typeof input.country === "string" && input.country.trim()
                        ? input.country.trim()
                        : "India",
            })
            .returning();

        return NextResponse.json(
            {
                success: true,
                data: address,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("CREATE_ADDRESS_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create address",
            },
            { status: 500 }
        );
    }
}





// import { NextRequest, NextResponse } from "next/server";
// import { and, desc, eq } from "drizzle-orm";
// import { db } from "@/app/api/lib/db";
// import { addresses } from "@/app/api/lib/schema/checkout-schema";
// import { requireCustomer } from "@/app/api/lib/customer-auth";

// export async function GET() {
//   try {
//     const auth = await requireCustomer();
//     if (!auth.customerId) return auth.response;

//     const data = await db
//       .select()
//       .from(addresses)
//       .where(eq(addresses.userId, auth.customerId))
//       .orderBy(desc(addresses.createdAt));

//     return NextResponse.json({ success: true, data });
//   } catch (error) {
//     console.error("GET_ADDRESSES_ERROR", error);
//     return NextResponse.json(
//       { success: false, message: "Failed to fetch addresses" },
//       { status: 500 }
//     );
//   }
// }

// export async function POST(request: NextRequest) {
//   try {
//     const auth = await requireCustomer();
//     if (!auth.customerId) return auth.response;

//     const body = await request.json();

//     const required = [
//       "fullName",
//       "phone",
//       "addressLine1",
//       "city",
//       "state",
//       "postalCode",
//     ];

//     if (
//       required.some(
//         (key) =>
//           typeof body[key] !== "string" ||
//           !body[key].trim()
//       )
//     ) {
//       return NextResponse.json(
//         { success: false, message: "All required address fields must be provided" },
//         { status: 400 }
//       );
//     }

//     const [address] = await db
//       .insert(addresses)
//       .values({
//         userId: auth.customerId,
//         fullName: body.fullName.trim(),
//         phone: body.phone.trim(),
//         addressLine1: body.addressLine1.trim(),
//         addressLine2:
//           typeof body.addressLine2 === "string"
//             ? body.addressLine2.trim() || null
//             : null,
//         city: body.city.trim(),
//         state: body.state.trim(),
//         postalCode: body.postalCode.trim(),
//         country:
//           typeof body.country === "string" && body.country.trim()
//             ? body.country.trim()
//             : "India",
//       })
//       .returning();

//     return NextResponse.json(
//       { success: true, data: address },
//       { status: 201 }
//     );
//   } catch (error) {
//     console.error("CREATE_ADDRESS_ERROR", error);
//     return NextResponse.json(
//       { success: false, message: "Failed to create address" },
//       { status: 500 }
//     );
//   }
// }