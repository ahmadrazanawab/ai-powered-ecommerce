"use client";

import { useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import Link from "next/link";
import {
    adminLoginSchema,
    type AdminLoginI
} from "@/app/api/lib/validations/admin";

import { useRouter } from 'next/navigation'; 


/* ---------- inline icons (no extra dependency) ---------- */
const svgBase = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

const UserIcon = () => (
    <svg {...svgBase} className="h-[18px] w-[18px] shrink-0 text-slate-400">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
);
const LockIcon = () => (
    <svg {...svgBase} className="h-[18px] w-[18px] shrink-0 text-slate-400">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
);
const EyeIcon = ({ off }: { off: boolean }) => (
    <svg {...svgBase} className="h-[18px] w-[18px]">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {off && <path d="m4 4 16 16" />}
    </svg>
);
const ShieldIcon = () => (
    <svg {...svgBase} strokeWidth={1.6} className="h-6 w-6">
        <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const Page = () => {
    // UI-only state: toggles password visibility
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<AdminLoginI>({
        resolver: zodResolver(adminLoginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const loginMutation = useMutation({
        mutationFn: async (data: AdminLoginI) => {
            const res = await api.post(
                "/api/auth/admin/login",
                data
            );

            const admin = res.data?.admin;

            if (!admin?.token) {
                throw new Error("Token not found");
            }

            localStorage.setItem("admin_token", admin.token);
            localStorage.setItem("admin_role", admin.role);
            localStorage.setItem("admin_id", admin.id);

            console.log("Admin token saved");
            router.push('/admin-dashboard'); 
            return res.data;
        },

        onSuccess: (data) => {
            console.log("Login successful:", data);
        },

        onError: (error) => {
            if (axios.isAxiosError(error)) {
                console.error(
                    error.response?.data ?? error.message
                );
            } else {
                console.error(error);
            }
        },
    });

    const handleAdminLogin = (data: AdminLoginI) => {
        loginMutation.mutate(data);
    };

    return (
        <main
            data-theme="light"
            className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2"
        >
            {/* ---------- Brand panel ---------- */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                        backgroundSize: "44px 44px",
                    }}
                />

                <div className="relative flex h-full flex-col justify-between gap-10 px-6 py-8 sm:px-10 lg:min-h-screen lg:px-16 lg:py-14">
                    <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                            <ShieldIcon />
                        </span>
                        <span className="text-lg font-semibold tracking-tight">
                            Admin Console
                        </span>
                    </div>

                    <div className="max-w-md">
                        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                            Welcome back to your dashboard
                        </h1>
                        <p className="mt-4 hidden text-base leading-relaxed text-slate-300 sm:block">
                            Sign in to manage users, review activity and keep
                            everything running smoothly.
                        </p>
                    </div>

                    <p className="hidden text-sm text-slate-400 lg:block">
                        Restricted area. Only authorized administrators can
                        sign in.
                    </p>
                </div>
            </section>

            {/* ---------- Form panel ---------- */}
            <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:py-14">
                <form
                    onSubmit={handleSubmit(handleAdminLogin)}
                    className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70 sm:p-10"
                    noValidate
                >
                    <header className="mb-8">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                            Admin login
                        </h2>
                        <p className="mt-1.5 text-sm text-slate-500">
                            Sign in to access your admin dashboard
                        </p>
                    </header>

                    <div className="space-y-5">
                        {/* Email / phone */}
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-1.5 block text-sm font-medium text-slate-700"
                            >
                                Email or phone number
                            </label>
                            <label
                                className={`input input-bordered flex h-12 w-full items-center gap-3 rounded-xl bg-slate-50 focus-within:bg-white ${
                                    errors.email ? "input-error" : ""
                                }`}
                            >
                                <UserIcon />
                                <input
                                    id="email"
                                    type="text"
                                    autoComplete="username"
                                    placeholder="Enter email or phone number"
                                    className="grow"
                                    {...register("email")}
                                />
                            </label>
                            {errors.email && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.email.message}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="mb-1.5 block text-sm font-medium text-slate-700"
                            >
                                Password
                            </label>
                            <label
                                className={`input input-bordered flex h-12 w-full items-center gap-3 rounded-xl bg-slate-50 focus-within:bg-white ${
                                    errors.password ? "input-error" : ""
                                }`}
                            >
                                <LockIcon />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="Enter password"
                                    className="grow"
                                    {...register("password")}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    className="text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:text-slate-900"
                                >
                                    <EyeIcon off={showPassword} />
                                </button>
                            </label>
                            {errors.password && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.password.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {loginMutation.isError && (
                        <div
                            role="alert"
                            className="alert alert-error alert-soft mt-5 rounded-xl"
                        >
                            <span>
                                {axios.isAxiosError(loginMutation.error)
                                    ? loginMutation.error.response?.data?.message ??
                                      "Login failed. Please check your credentials."
                                    : "Something went wrong. Please try again."}
                            </span>
                        </div>
                    )}

                    {loginMutation.isSuccess && (
                        <div
                            role="status"
                            className="alert alert-success alert-soft mt-5 rounded-xl"
                        >
                            <span>Login request successful!</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loginMutation.isPending}
                        className="btn mt-7 h-12 w-full rounded-xl border-0 bg-slate-900 text-base font-medium text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:bg-slate-400 disabled:text-white"
                    >
                        {loginMutation.isPending ? (
                            <>
                                <span className="loading loading-spinner loading-sm" />
                                Logging in...
                            </>
                        ) : (
                            "Login"
                        )}
                    </button>
                    <p className="mt-6 text-center text-sm text-slate-500">
                            Don&apos;t have an account?{" "}
                    <Link
                        href="/admin/signup"
                        className="font-medium text-slate-900 underline-offset-4 hover:underline"
                        >
        Sign up
    </Link>
</p>
                </form>
            </section>
        </main>
    );
};

export default Page;


// "use client";

// import axios from "axios";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { useMutation } from "@tanstack/react-query";
// import { api } from "@/app/lib/axios";
// import {
//     adminLoginSchema,
//     type AdminLoginI
// } from "@/app/api/lib/validations/admin";


// const Page = () => {
//     const {
//         register,
//         handleSubmit,
//         formState: { errors },
//     } = useForm<AdminLoginI>({
//         resolver: zodResolver(adminLoginSchema),
//         defaultValues: {
//             email: "",
//             password: "",
//         },
//     });

//     const loginMutation = useMutation({
//         mutationFn: async (data: AdminLoginI) => {
//             const res = await api.post(
//                 "/api/auth/admin/login",
//                 data
//             );

//             const admin = res.data?.admin;

//             if (!admin?.token) {
//                 throw new Error("Token not found");
//             }
            
//             localStorage.setItem("admin_token", admin.token);
//             localStorage.setItem("admin_role", admin.role);
//             localStorage.setItem("admin_id", admin.id);

//             console.log("Admin token saved");
//             return res.data;
//         },

//         onSuccess: (data) => {
//             console.log("Login successful:", data);
//         },

//         onError: (error) => {
//             if (axios.isAxiosError(error)) {
//                 console.error(
//                     error.response?.data ?? error.message
//                 );
//             } else {
//                 console.error(error);
//             }
//         },
//     });

//     const handleAdminLogin = (data: AdminLoginI) => {
//         loginMutation.mutate(data);
//     };

//     return (
//         <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
//             <form
//                 onSubmit={handleSubmit(handleAdminLogin)}
//                 className="card w-full max-w-md bg-base-100 shadow-xl"
//             >
//                 <div className="card-body">
//                     <h1 className="card-title text-2xl justify-center mb-2">
//                         Admin Login
//                     </h1>

//                     <p className="text-center text-base-content/60 mb-4">
//                         Sign in to access your admin dashboard
//                     </p>

//                     <fieldset className="fieldset">
//                         <legend className="fieldset-legend">
//                             Email or Phone Number
//                         </legend>

//                         <input
//                             type="text"
//                             autoComplete="username"
//                             placeholder="Enter email or phone number"
//                             className={`input input-bordered w-full ${errors.email ? "input-error" : ""
//                                 }`}
//                             {...register("email")}
//                         />

//                         {errors.email && (
//                             <p className="text-error text-sm">
//                                 {errors.email.message}
//                             </p>
//                         )}
//                     </fieldset>

//                     <fieldset className="fieldset">
//                         <legend className="fieldset-legend">
//                             Password
//                         </legend>

//                         <input
//                             type="password"
//                             autoComplete="current-password"
//                             placeholder="Enter password"
//                             className={`input input-bordered w-full ${errors.password ? "input-error" : ""
//                                 }`}
//                             {...register("password")}
//                         />

//                         {errors.password && (
//                             <p className="text-error text-sm">
//                                 {errors.password.message}
//                             </p>
//                         )}
//                     </fieldset>

//                     {loginMutation.isError && (
//                         <div role="alert" className="alert alert-error mt-2">
//                             <span>
//                                 {axios.isAxiosError(loginMutation.error)
//                                     ? loginMutation.error.response?.data?.message ??
//                                     "Login failed. Please check your credentials."
//                                     : "Something went wrong. Please try again."}
//                             </span>
//                         </div>
//                     )}

//                     {loginMutation.isSuccess && (
//                         <div role="status" className="alert alert-success mt-2">
//                             <span>Login request successful!</span>
//                         </div>
//                     )}

//                     <button
//                         type="submit"
//                         disabled={loginMutation.isPending}
//                         className="btn btn-neutral w-full mt-4"
//                     >
//                         {loginMutation.isPending ? (
//                             <>
//                                 <span className="loading loading-spinner loading-sm" />
//                                 Logging in...
//                             </>
//                         ) : (
//                             "Login"
//                         )}
//                     </button>
//                 </div>
//             </form>
//         </div>
//     );
// };

// export default Page;
