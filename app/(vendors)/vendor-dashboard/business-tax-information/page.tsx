"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch, type UseFormRegister } from "react-hook-form";
import type { z } from "zod";

import { api } from "@/app/lib/axios";
import { cardCls, fieldCls, goldBtn } from "@/app/components/Shop-ui";
import {
    vendorBusinessProfileSchema,
    type VendorBusinessProfileData,
    type VendorBusinessProfileInput,
} from "@/app/api/lib/validations/vendor-business-profile";

interface BusinessProfileResponse
    extends Omit<
        VendorBusinessProfileData,
        "gstin" | "addressLine2" | "invoicePrefix" | "paymentInformation"
    > {
    vendorId: string;
    gstin: string | null;
    addressLine2: string | null;
    invoicePrefix: string | null;
    paymentInformation: string | null;
    verificationStatus: "pending" | "under_review" | "verified" | "rejected";
    rejectionReason: string | null;
    reviewMessage: string | null;
    hasGstDocument: boolean;
}

interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data: T;
}

const emptyValues: VendorBusinessProfileInput = {
    businessName: "",
    businessType: "proprietorship",
    authorizedPersonName: "",
    businessEmail: "",
    businessPhone: "",
    gstRegistrationStatus: "unregistered",
    gstin: "",
    pan: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pinCode: "",
    country: "India",
    invoiceDisplayName: "",
    invoicePrefix: "",
    paymentInformation: "",
};

const businessTypes = [
    ["proprietorship", "Proprietorship"],
    ["partnership", "Partnership"],
    ["llp", "LLP"],
    ["private_limited", "Private Limited"],
    ["public_limited", "Public Limited"],
    ["other", "Other"],
] as const;

const statusLabels: Record<BusinessProfileResponse["verificationStatus"], string> =
    {
        pending: "Pending review",
        under_review: "Under review",
        verified: "Verified",
        rejected: "Rejected",
    };

function messageFromError(error: unknown) {
    if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response &&
        typeof error.response.data === "object" &&
        error.response.data !== null &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
    ) {
        return error.response.data.message;
    }
    return error instanceof Error ? error.message : "Something went wrong";
}

export default function VendorBusinessTaxInformationPage() {
    const queryClient = useQueryClient();
    const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
    const [notice, setNotice] = useState("");

    const profileQuery = useQuery<ApiResponse<BusinessProfileResponse | null>>({
        queryKey: ["vendor-business-profile"],
        queryFn: async () =>
            (await api.get("/api/auth/vendor/business-profile")).data,
        retry: false,
    });

    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<
        VendorBusinessProfileInput,
        unknown,
        VendorBusinessProfileData
    >({
        resolver: zodResolver(vendorBusinessProfileSchema),
        defaultValues: emptyValues,
    });

    const gstStatus = useWatch({
        control,
        name: "gstRegistrationStatus",
    });
    const profile = profileQuery.data?.data ?? null;

    useEffect(() => {
        if (profile) {
            reset({
                ...emptyValues,
                ...profile,
                gstin: profile.gstin ?? "",
                addressLine2: profile.addressLine2 ?? "",
                invoicePrefix: profile.invoicePrefix ?? "",
                paymentInformation: profile.paymentInformation ?? "",
            });
        }
    }, [profile, reset]);

    const saveMutation = useMutation({
        mutationFn: async (values: VendorBusinessProfileData) => {
            const response = profile
                ? await api.patch<ApiResponse<BusinessProfileResponse>>(
                      "/api/auth/vendor/business-profile",
                      values
                  )
                : await api.post<ApiResponse<BusinessProfileResponse>>(
                      "/api/auth/vendor/business-profile",
                      values
                  );

            await queryClient.invalidateQueries({
                queryKey: ["vendor-business-profile"],
            });

            if (selectedDocument) {
                const formData = new FormData();
                formData.append("document", selectedDocument);
                await api.post(
                    "/api/auth/vendor/business-profile/document",
                    formData
                );
            }
            return response.data;
        },
        onSuccess: async (response) => {
            setSelectedDocument(null);
            setNotice(response.message ?? "Business information saved");
            await queryClient.invalidateQueries({
                queryKey: ["vendor-business-profile"],
            });
        },
        onError: (error) => {
            setNotice(messageFromError(error));
            void queryClient.invalidateQueries({
                queryKey: ["vendor-business-profile"],
            });
        },
    });

    const documentMutation = useMutation({
        mutationFn: async () => {
            await api.delete("/api/auth/vendor/business-profile/document");
        },
        onSuccess: async () => {
            setNotice("GST document removed");
            await queryClient.invalidateQueries({
                queryKey: ["vendor-business-profile"],
            });
        },
        onError: (error) => setNotice(messageFromError(error)),
    });

    const onSubmit = (values: VendorBusinessProfileData) => {
        setNotice("");
        saveMutation.mutate(values);
    };

    const inputClass = `${fieldCls} px-4`;
    const labelClass = "mb-2 block text-sm font-medium text-slate-700";

    if (profileQuery.isPending) {
        return (
            <div className={`${cardCls} p-8 text-sm text-slate-600`}>
                Loading business information...
            </div>
        );
    }

    if (profileQuery.isError) {
        return (
            <div className={`${cardCls} p-8`}>
                <h1 className="text-xl font-semibold text-slate-900">
                    Business &amp; Tax Information
                </h1>
                <p className="mt-3 text-sm text-rose-700">
                    Could not load your information. Refresh the page to try again.
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">
                    Vendor settings
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-950">
                    Business &amp; Tax Information
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                    Maintain the business details used to identify your store.
                    This information is not used to generate invoices in this phase.
                </p>
            </div>

            {profile && (
                <div className="flex flex-col gap-2 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-700">
                        Verification status:{" "}
                        <strong>{statusLabels[profile.verificationStatus]}</strong>
                    </p>
                    {profile.reviewMessage && (
                        <p className="text-sm text-amber-800">
                            Admin note: {profile.reviewMessage}
                        </p>
                    )}
                    {profile.rejectionReason && (
                        <p className="text-sm text-rose-700">
                            Rejection reason: {profile.rejectionReason}
                        </p>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <section className={`${cardCls} space-y-5 p-5 sm:p-7`}>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            Business Details
                        </h2>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className={labelClass} htmlFor="businessName">
                                Business / Shop Name
                            </label>
                            <input
                                id="businessName"
                                className={inputClass}
                                {...register("businessName")}
                            />
                            {errors.businessName && (
                                <p className="mt-1 text-xs text-rose-600">
                                    {errors.businessName.message}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="businessType">
                                Business Type
                            </label>
                            <select
                                id="businessType"
                                className={inputClass}
                                {...register("businessType")}
                            >
                                {businessTypes.map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <TextField
                            label="Owner / Authorized Person Name"
                            name="authorizedPersonName"
                            register={register}
                            error={errors.authorizedPersonName?.message}
                            inputClass={inputClass}
                        />
                        <TextField
                            label="Business Email"
                            name="businessEmail"
                            type="email"
                            register={register}
                            error={errors.businessEmail?.message}
                            inputClass={inputClass}
                        />
                        <TextField
                            label="Business Phone Number"
                            name="businessPhone"
                            register={register}
                            error={errors.businessPhone?.message}
                            inputClass={inputClass}
                            placeholder="10-digit Indian mobile number"
                        />
                    </div>
                </section>

                <section className={`${cardCls} space-y-5 p-5 sm:p-7`}>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            GST Information
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            PAN and GSTIN formats are checked; they do not
                            establish tax registration or verification.
                        </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label
                                className={labelClass}
                                htmlFor="gstRegistrationStatus"
                            >
                                GST Registration Status
                            </label>
                            <select
                                id="gstRegistrationStatus"
                                className={inputClass}
                                {...register("gstRegistrationStatus", {
                                    onChange: (event) => {
                                        if (event.target.value === "unregistered") {
                                            setSelectedDocument(null);
                                            setValue("gstin", "");
                                        }
                                    },
                                })}
                            >
                                <option value="regular">Regular</option>
                                <option value="composition">Composition</option>
                                <option value="unregistered">Unregistered</option>
                            </select>
                        </div>
                        <TextField
                            label="PAN"
                            name="pan"
                            register={register}
                            error={errors.pan?.message}
                            inputClass={inputClass}
                            placeholder="ABCDE1234F"
                        />
                        {gstStatus !== "unregistered" && (
                            <>
                                <TextField
                                    label="GSTIN"
                                    name="gstin"
                                    register={register}
                                    error={errors.gstin?.message}
                                    inputClass={inputClass}
                                    placeholder="15-character GSTIN"
                                />
                                <div>
                                    <label className={labelClass} htmlFor="gstDocument">
                                        {gstStatus === "composition"
                                            ? "GST registration document (optional)"
                                            : "GST certificate"}
                                    </label>
                                    <input
                                        id="gstDocument"
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                        onChange={(event) =>
                                            setSelectedDocument(
                                                event.target.files?.[0] ?? null
                                            )
                                        }
                                        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium file:text-slate-700"
                                    />
                                    <p className="mt-1 text-xs text-slate-500">
                                        PDF, JPEG, or PNG, up to 5 MB. Stored privately.
                                    </p>
                                    {profile?.hasGstDocument && !selectedDocument && (
                                        <div className="mt-2 flex items-center gap-3 text-sm">
                                            <span className="text-emerald-700">
                                                Document uploaded
                                            </span>
                                            <button
                                                type="button"
                                                className="text-rose-700 underline disabled:opacity-50"
                                                disabled={documentMutation.isPending}
                                                onClick={() =>
                                                    documentMutation.mutate()
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                    {selectedDocument && (
                                        <p className="mt-2 text-xs text-slate-600">
                                            Selected: {selectedDocument.name}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                        {gstStatus === "composition" && (
                            <p className="text-sm text-slate-600 sm:col-span-2">
                                Composition registration is recorded separately
                                from regular GST registration. Do not select
                                Regular unless that is your actual status.
                            </p>
                        )}
                    </div>
                </section>

                <section className={`${cardCls} space-y-5 p-5 sm:p-7`}>
                    <h2 className="text-lg font-semibold text-slate-900">
                        Business Address
                    </h2>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                            label="Address Line 1"
                            name="addressLine1"
                            register={register}
                            error={errors.addressLine1?.message}
                            inputClass={inputClass}
                        />
                        <TextField
                            label="Address Line 2"
                            name="addressLine2"
                            register={register}
                            error={errors.addressLine2?.message}
                            inputClass={inputClass}
                        />
                        <TextField
                            label="City"
                            name="city"
                            register={register}
                            error={errors.city?.message}
                            inputClass={inputClass}
                        />
                        <TextField
                            label="State"
                            name="state"
                            register={register}
                            error={errors.state?.message}
                            inputClass={inputClass}
                        />
                        <TextField
                            label="PIN Code"
                            name="pinCode"
                            register={register}
                            error={errors.pinCode?.message}
                            inputClass={inputClass}
                            placeholder="6-digit Indian PIN code"
                        />
                        <TextField
                            label="Country"
                            name="country"
                            register={register}
                            error={errors.country?.message}
                            inputClass={inputClass}
                        />
                    </div>
                </section>

                <section className={`${cardCls} space-y-5 p-5 sm:p-7`}>
                    <h2 className="text-lg font-semibold text-slate-900">
                        Invoice Preferences
                    </h2>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                            label="Invoice Display Name"
                            name="invoiceDisplayName"
                            register={register}
                            error={errors.invoiceDisplayName?.message}
                            inputClass={inputClass}
                        />
                        <TextField
                            label="Invoice Prefix (optional)"
                            name="invoicePrefix"
                            register={register}
                            error={errors.invoicePrefix?.message}
                            inputClass={inputClass}
                        />
                        <div className="sm:col-span-2">
                            <label
                                className={labelClass}
                                htmlFor="paymentInformation"
                            >
                                Business Payment Information (optional)
                            </label>
                            <textarea
                                id="paymentInformation"
                                rows={3}
                                className="w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/70"
                                {...register("paymentInformation")}
                            />
                            {errors.paymentInformation && (
                                <p className="mt-1 text-xs text-rose-600">
                                    {errors.paymentInformation.message}
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {notice && (
                    <p
                        role="status"
                        className={`rounded-xl px-4 py-3 text-sm ${
                            saveMutation.isError || documentMutation.isError
                                ? "bg-rose-50 text-rose-700"
                                : "bg-emerald-50 text-emerald-700"
                        }`}
                    >
                        {notice}
                    </p>
                )}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <button
                        type="submit"
                        className={goldBtn}
                        disabled={saveMutation.isPending}
                    >
                        {saveMutation.isPending
                            ? "Saving..."
                            : profile
                              ? "Save changes"
                              : "Save business information"}
                    </button>
                    {profile?.verificationStatus === "verified" && (
                        <p className="text-sm text-slate-600">
                            Saving changes sends this profile back for manual review.
                        </p>
                    )}
                </div>
            </form>
        </div>
    );
}

type FieldName =
    | "authorizedPersonName"
    | "businessEmail"
    | "businessPhone"
    | "gstin"
    | "pan"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "state"
    | "pinCode"
    | "country"
    | "invoiceDisplayName"
    | "invoicePrefix";

function TextField({
    label,
    name,
    register,
    error,
    inputClass,
    placeholder,
    type = "text",
}: {
    label: string;
    name: FieldName;
    register: UseFormRegister<z.input<typeof vendorBusinessProfileSchema>>;
    error?: string;
    inputClass: string;
    placeholder?: string;
    type?: string;
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={name}>
                {label}
            </label>
            <input
                id={name}
                type={type}
                className={inputClass}
                placeholder={placeholder}
                {...register(name)}
            />
            {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
    );
}
