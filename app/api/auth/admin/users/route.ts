
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { adminAccounts } from "@/app/api/lib/schema/admin-schema";
import { users } from "@/app/api/lib/schema/users";

type AdminRole = "admin" | "super_admin";

const ALLOWED_ADMIN_ROLES: readonly AdminRole[] = [
  "admin",
  "super_admin",
];

type AdminJwtPayload = {
  adminId: string;
  role: string;
};

export async function GET(request: NextRequest) {
  try {
    // 1. Read admin authentication cookie
    const token = request.cookies.get("admin_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Validate JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured");

      return NextResponse.json(
        { success: false, message: "Server configuration error" },
        { status: 500 }
      );
    }

    // 3. Verify JWT
    let payload: AdminJwtPayload;

    try {
      const { payload: verifiedPayload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        { algorithms: ["HS256"] }
      );

      if (
        typeof verifiedPayload.adminId !== "string" ||
        !verifiedPayload.adminId.trim() ||
        typeof verifiedPayload.role !== "string" ||
        !verifiedPayload.role.trim()
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid admin token payload" },
          { status: 401 }
        );
      }

      payload = {
        adminId: verifiedPayload.adminId,
        role: verifiedPayload.role,
      };
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired authentication token",
        },
        { status: 401 }
      );
    }

    // 4. Fetch current admin account from the database
    const [currentAdmin] = await db
      .select({
        id: adminAccounts.id,
        role: adminAccounts.role,
        isActive: adminAccounts.isActive,
      })
      .from(adminAccounts)
      .where(eq(adminAccounts.id, payload.adminId))
      .limit(1);

    // 5. Check account status and JWT role consistency
    if (
      !currentAdmin ||
      !currentAdmin.isActive ||
      currentAdmin.role !== payload.role
    ) {
      return NextResponse.json(
        { success: false, message: "Admin account is not authorized" },
        { status: 403 }
      );
    }

    // 6. Allow admin and super_admin only
    if (
      !ALLOWED_ADMIN_ROLES.includes(
        currentAdmin.role as AdminRole
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Only admin or super_admin can access users",
        },
        { status: 403 }
      );
    }

    // 7. Read pagination and search filters
    const searchParams = request.nextUrl.searchParams;

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1
    );

    const requestedLimit = Number.parseInt(
      searchParams.get("limit") ?? "10",
      10
    );

    const limit = Math.min(
      100,
      Math.max(1, requestedLimit || 10)
    );

    const status = searchParams.get("status") ?? "all";
    const search = (searchParams.get("search") ?? "").trim();

    const offset = (page - 1) * limit;

    // 8. Build filters
    const conditions = [];

    if (status === "blocked") {
      conditions.push(eq(users.isBlocked, true));
    } else if (status === "active") {
      conditions.push(eq(users.isBlocked, false));
    }

    if (search) {
      conditions.push(
        sql`(
          ${users.name} ILIKE ${`%${search}%`}
          OR ${users.email} ILIKE ${`%${search}%`}
          OR ${users.mobileNo} ILIKE ${`%${search}%`}
        )`
      );
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    // 9. Fetch filtered users and total count
    const [userList, countResult] = await Promise.all([
      db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          mobileNo: users.mobileNo,
          isVerified: users.isVerified,
          isBlocked: users.isBlocked,
          blockedReason: users.blockedReason,
          blockedAt: users.blockedAt,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(whereCondition)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .where(whereCondition),
    ]);

    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // 10. Fetch dashboard statistics
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [statsResult] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (
          where ${users.isBlocked} = false
        )::int`,
        blocked: sql<number>`count(*) filter (
          where ${users.isBlocked} = true
        )::int`,
        newThisWeek: sql<number>`count(*) filter (
          where ${users.createdAt} >= ${weekAgo}
        )::int`,
      })
      .from(users);

    // 11. Return the response expected by the frontend
    return NextResponse.json({
      success: true,
      message: "Users fetched successfully",
      users: userList,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats: {
        total: statsResult?.total ?? 0,
        active: statsResult?.active ?? 0,
        blocked: statsResult?.blocked ?? 0,
        newThisWeek: statsResult?.newThisWeek ?? 0,
      },
    });
  } catch (error) {
    console.error("GET_ADMIN_USERS_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}


// import { NextResponse, NextRequest } from "next/server";
// import { jwtVerify } from "jose";
// import { db } from "@/app/api/lib/db";
// import { eq, desc } from "drizzle-orm";
// import { adminAccounts } from "@/app/api/lib/schema/admin-schema";
// import { users } from "@/app/api/lib/schema/users";


// type AdminRole = "admin" | "super_admin";

// const ALLOWED_ADMIN_ROLES: readonly AdminRole[] = [
//     "admin",
//     "super_admin",
// ];


// type AdminJwtPayload = {
//     adminId: string;
//     role: string;
// };

// export async function GET(request: NextRequest) {
//     try {
//         // 1. Read admin authentication cookie
//         const token = request.cookies.get("admin_token")?.value;

//         if (!token) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Authentication required",
//                 },
//                 { status: 401 }
//             );
//         }

//         // 2. Validate server configuration
//         const secret = process.env.JWT_SECRET;

//         if (!secret) {
//             console.error("JWT_SECRET is not configured");

//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Server configuration error",
//                 },
//                 { status: 500 }
//             );
//         }

//         // 3. Verify JWT signature and validate payload
//         let payload: AdminJwtPayload;

//         try {
//             const { payload: verifiedPayload } = await jwtVerify(
//                 token,
//                 new TextEncoder().encode(secret),
//                 {
//                     algorithms: ["HS256"],
//                 }
//             );

//             if (
//                 typeof verifiedPayload.adminId !== "string" ||
//                 !verifiedPayload.adminId.trim() ||
//                 typeof verifiedPayload.role !== "string" ||
//                 !verifiedPayload.role.trim()
//             ) {
//                 return NextResponse.json(
//                     {
//                         success: false,
//                         message: "Invalid admin token payload",
//                     },
//                     { status: 401 }
//                 );
//             }

//             payload = {
//                 adminId: verifiedPayload.adminId,
//                 role: verifiedPayload.role,
//             };
//         } catch {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Invalid or expired authentication token",
//                 },
//                 { status: 401 }
//             );
//         }

//         // 4. Fetch the current admin account
//         const [currentAdmin] = await db
//             .select({
//                 id: adminAccounts.id,
//                 role: adminAccounts.role,
//                 isActive: adminAccounts.isActive,
//             })
//             .from(adminAccounts)
//             .where(eq(adminAccounts.id, payload.adminId))
//             .limit(1);

//         // 5. Verify account status and token consistency
//         if (
//             !currentAdmin ||
//             !currentAdmin.isActive ||
//             currentAdmin.role !== payload.role
//         ) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Admin account is not authorized",
//                 },
//                 { status: 403 }
//             );
//         }

//         // 6. Authorize admin roles
//         if (
//             !ALLOWED_ADMIN_ROLES.includes(
//                 currentAdmin.role as (typeof ALLOWED_ADMIN_ROLES)[number]
//             )
//         ) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Only admin or super_admin can access vendors",
//                 },
//                 { status: 403 }
//             );
//         }

//         const getAllUser = await db
//             .select({
//                 userId: users.id,
//                 name: users.name,
//                 email: users.email,
//                 mobileNo: users.mobileNo,
//                 isVerified: users.isVerified,
//                 createdAt: users.createdAt,
//             })
//             .from(users)
//             .orderBy(desc(users.createdAt));

//         // 8. Return successful response
//         return NextResponse.json({
//             success: true,
//             message: "All user fetched successfully",
//             users: getAllUser,
//         });

//     } catch (error) {
//         console.error("GET_VENDOR_ERROR:", error);

//         return NextResponse.json(
//             {
//                 success: false,
//                 message: "Internal server error",
//             },
//             { status: 500 }
//         );
//     }
// }