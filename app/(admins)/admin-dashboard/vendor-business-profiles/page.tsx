"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/app/lib/axios";

type VerificationStatus =
    | "pending"
    | "under_review"
    | "verified"
    | "rejected";

interface BusinessProfile {
    vendorId: string;
    vendorName: string;
    vendorEmail: string;
    businessName: string;
    businessType: string;
    authorizedPersonName: string;
    businessEmail: string;
    businessPhone: string;
    gstRegistrationStatus: string;
    gstin: string | null;
    pan: string;
    hasGstDocument: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pinCode: string;
    country: string;
    invoiceDisplayName: string;
    invoicePrefix: string | null;
    paymentInformation: string | null;
    verificationStatus: VerificationStatus;
    rejectionReason: string | null;
    reviewMessage: string | null;
    updatedAt: string;
}

interface ProfilesResponse {
    success: boolean;
    data: BusinessProfile[];
}

const statusClass: Record<VerificationStatus, string> = {
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    under_review: "bg-sky-50 text-sky-800 ring-sky-200",
    verified: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    rejected: "bg-rose-50 text-rose-800 ring-rose-200",
};

function getErrorMessage(error: unknown) {
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

export default function VendorBusinessProfilesPage() {
    const queryClient = useQueryClient();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [reviewMessage, setReviewMessage] = useState("");
    const [notice, setNotice] = useState("");

    const profilesQuery = useQuery<ProfilesResponse>({
        queryKey: ["admin-vendor-business-profiles"],
        queryFn: async () =>
            (await api.get("/api/auth/admin/vendor-business-profiles")).data,
        retry: false,
    });

    const selected = profilesQuery.data?.data.find(
        (profile) => profile.vendorId === selectedId
    );

    const reviewMutation = useMutation({
        mutationFn: async (status: VerificationStatus) => {
            if (!selected) throw new Error("Select a business profile first");
            const response = await api.patch(
                `/api/auth/admin/vendor-business-profiles/${selected.vendorId}`,
                { status, message: reviewMessage }
            );
            return response.data;
        },
        onSuccess: async (response) => {
            setNotice(response.message ?? "Review saved");
            setReviewMessage("");
            await queryClient.invalidateQueries({
                queryKey: ["admin-vendor-business-profiles"],
            });
        },
        onError: (error) => setNotice(getErrorMessage(error)),
    });

    const openDocument = async () => {
        if (!selected) return;
        const tab = window.open("about:blank", "_blank");
        try {
            const response = await api.get(
                `/api/auth/admin/vendor-business-profiles/${selected.vendorId}/document`
            );
            const url = response.data?.data?.url;
            if (typeof url !== "string") {
                throw new Error("The document link was not returned");
            }
            if (tab) {
                tab.opener = null;
                tab.location.href = url;
            } else {
                window.location.assign(url);
            }
            setNotice("");
        } catch (error) {
            tab?.close();
            setNotice(getErrorMessage(error));
        }
    };

    const profiles = profilesQuery.data?.data ?? [];

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <header>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">
                    Vendor compliance
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-950">
                    Business &amp; Tax Verification
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                    Review vendor-submitted information and documents. Format
                    validation does not replace manual verification.
                </p>
            </header>

            {notice && (
                <p
                    role="status"
                    className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700"
                >
                    {notice}
                </p>
            )}

            {profilesQuery.isPending ? (
                <div className="rounded-3xl bg-white p-8 text-sm text-slate-600 ring-1 ring-slate-200">
                    Loading submitted profiles...
                </div>
            ) : profilesQuery.isError ? (
                <div className="rounded-3xl bg-white p-8 text-sm text-rose-700 ring-1 ring-slate-200">
                    Could not load business profiles. Refresh to try again.
                </div>
            ) : profiles.length === 0 ? (
                <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-slate-200">
                    <h2 className="font-semibold text-slate-900">
                        No business profiles submitted
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Vendor submissions will appear here for manual review.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
                    <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <h2 className="font-semibold text-slate-900">
                                Submitted profiles ({profiles.length})
                            </h2>
                        </div>
                        <ul className="divide-y divide-slate-100">
                            {profiles.map((profile) => (
                                <li key={profile.vendorId}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedId(profile.vendorId);
                                            setNotice("");
                                            setReviewMessage(
                                                profile.reviewMessage ??
                                                    profile.rejectionReason ??
                                                    ""
                                            );
                                        }}
                                        className={`flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between ${
                                            selectedId === profile.vendorId
                                                ? "bg-amber-50/60"
                                                : ""
                                        }`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium text-slate-900">
                                                {profile.businessName}
                                            </span>
                                            <span className="mt-1 block truncate text-sm text-slate-500">
                                                {profile.vendorName} ·{" "}
                                                {profile.vendorEmail}
                                            </span>
                                        </span>
                                        <span
                                            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                                                statusClass[
                                                    profile.verificationStatus
                                                ]
                                            }`}
                                        >
                                            {profile.verificationStatus.replace(
                                                "_",
                                                " "
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {selected ? (
                        <section className="space-y-5 rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    {selected.businessName}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Vendor account: {selected.vendorName} (
                                    {selected.vendorEmail})
                                </p>
                            </div>

                            <div className="grid gap-4 text-sm sm:grid-cols-2">
                                <Detail label="Business type" value={selected.businessType} />
                                <Detail
                                    label="Authorized person"
                                    value={selected.authorizedPersonName}
                                />
                                <Detail label="Business email" value={selected.businessEmail} />
                                <Detail label="Business phone" value={selected.businessPhone} />
                                <Detail
                                    label="GST registration"
                                    value={selected.gstRegistrationStatus}
                                />
                                <Detail label="GSTIN" value={selected.gstin || "Not provided"} />
                                <Detail label="PAN" value={selected.pan} />
                                <Detail
                                    label="Address"
                                    value={[
                                        selected.addressLine1,
                                        selected.addressLine2,
                                        selected.city,
                                        selected.state,
                                        selected.pinCode,
                                        selected.country,
                                    ]
                                        .filter(Boolean)
                                        .join(", ")}
                                />
                                <Detail
                                    label="Invoice display name"
                                    value={selected.invoiceDisplayName}
                                />
                                <Detail
                                    label="Invoice prefix"
                                    value={selected.invoicePrefix || "Not set"}
                                />
                                <Detail
                                    label="Payment information"
                                    value={
                                        selected.paymentInformation ||
                                        "Not provided"
                                    }
                                />
                            </div>

                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-sm font-medium text-slate-800">
                                    GST document
                                </p>
                                {selected.hasGstDocument ? (
                                    <button
                                        type="button"
                                        onClick={openDocument}
                                        className="mt-2 text-sm font-medium text-indigo-700 underline"
                                    >
                                        Open temporary secure review link
                                    </button>
                                ) : (
                                    <p className="mt-1 text-sm text-slate-500">
                                        No document uploaded
                                    </p>
                                )}
                            </div>

                            <div className="space-y-3 border-t border-slate-200 pt-5">
                                <label
                                    htmlFor="reviewMessage"
                                    className="block text-sm font-medium text-slate-700"
                                >
                                    Review note / rejection reason
                                </label>
                                <textarea
                                    id="reviewMessage"
                                    rows={3}
                                    maxLength={1000}
                                    value={reviewMessage}
                                    onChange={(event) =>
                                        setReviewMessage(event.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <ReviewButton
                                        label="Start review"
                                        disabled={reviewMutation.isPending}
                                        onClick={() =>
                                            reviewMutation.mutate("under_review")
                                        }
                                        className="bg-sky-700 hover:bg-sky-800"
                                    />
                                    <ReviewButton
                                        label="Request corrections"
                                        disabled={
                                            reviewMutation.isPending ||
                                            !reviewMessage.trim()
                                        }
                                        onClick={() =>
                                            reviewMutation.mutate("pending")
                                        }
                                        className="bg-amber-600 hover:bg-amber-700"
                                    />
                                    <ReviewButton
                                        label="Reject"
                                        disabled={
                                            reviewMutation.isPending ||
                                            !reviewMessage.trim()
                                        }
                                        onClick={() =>
                                            reviewMutation.mutate("rejected")
                                        }
                                        className="bg-rose-700 hover:bg-rose-800"
                                    />
                                    <ReviewButton
                                        label="Mark verified"
                                        disabled={reviewMutation.isPending}
                                        onClick={() =>
                                            reviewMutation.mutate("verified")
                                        }
                                        className="bg-emerald-700 hover:bg-emerald-800"
                                    />
                                </div>
                                <p className="text-xs text-slate-500">
                                    Verification is a manual admin decision and
                                    is separate from vendor account approval.
                                </p>
                            </div>
                        </section>
                    ) : (
                        <div className="grid min-h-64 place-items-center rounded-3xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
                            Select a profile to inspect its business details.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className="mt-1 break-words text-slate-800">{value}</p>
        </div>
    );
}

function ReviewButton({
    label,
    disabled,
    onClick,
    className,
}: {
    label: string;
    disabled: boolean;
    onClick: () => void;
    className: string;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`rounded-lg px-3 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
            {label}
        </button>
    );
}
