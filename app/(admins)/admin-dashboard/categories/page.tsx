"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import axios from "axios";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

/* ---------- types ---------- */
interface CategoryI {
    categoryId: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
}

/* Form rules (the backend still validates everything again).
   The image is handled separately because the API reads it from
   FormData field "image", not from a text field. */
const categoryFormSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name must be 100 characters or fewer"),
    slug: z
        .string()
        .trim()
        .min(2, "Slug must be at least 2 characters")
        .max(120, "Slug must be 120 characters or fewer")
        .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Use lowercase letters, numbers and single hyphens"
        ),
    description: z
        .string()
        .trim()
        .max(500, "Description must be 500 characters or fewer")
        .optional(),
});
type FormValues = z.infer<typeof categoryFormSchema>;

const MAX_IMAGE_MB = 5;

const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const getErrorMessage = (error: unknown, fallback: string) =>
    axios.isAxiosError(error)
        ? error.response?.data?.message ?? fallback
        : "Something went wrong. Please try again.";

/* ---------- icons ---------- */
const iconPaths = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </>
    ),
    edit: (
        <>
            <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
            <path d="m13.5 6.5 4 4" />
        </>
    ),
    trash: (
        <>
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M6 7l1 13h10l1-13" />
            <path d="M10 11v5M14 11v5" />
        </>
    ),
    image: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="m4 18 5-5 4 4 3-3 4 4" />
        </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    warn: (
        <>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17v.5" />
        </>
    ),
    grid: (
        <>
            <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
            <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
            <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
            <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
        </>
    ),
};

const Icon = ({
    name,
    className = "h-5 w-5",
}: {
    name: keyof typeof iconPaths;
    className?: string;
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {iconPaths[name]}
    </svg>
);

const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";
const primaryBtn =
    "btn h-11 rounded-xl border-0 bg-slate-900 px-5 font-medium text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:bg-slate-400 disabled:text-white";
const ghostBtn =
    "btn h-11 rounded-xl border border-slate-300 bg-white px-5 font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
const fieldCls = (hasError: boolean) =>
    `input input-bordered h-12 w-full rounded-xl bg-slate-50 focus:bg-white ${hasError ? "input-error" : ""
    }`;
const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";

/* ---------- modal shell (esc to close, locks page scroll) ---------- */
const Modal = ({
    onClose,
    locked,
    children,
    size = "max-w-2xl",
}: {
    onClose: () => void;
    locked: boolean;
    children: ReactNode;
    size?: string;
}) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !locked) onClose();
        };
        window.addEventListener("keydown", onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = previous;
        };
    }, [onClose, locked]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
        >
            <div
                onClick={() => !locked && onClose()}
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            />
            <div
                className={`relative flex max-h-[92vh] w-full ${size} flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200/70 sm:rounded-3xl`}
            >
                {children}
            </div>
        </div>
    );
};

/* ---------- create / edit modal ---------- */
const CategoryFormModal = ({
    category,
    onClose,
    onSaved,
}: {
    category: CategoryI | null;
    onClose: () => void;
    onSaved: (message: string) => void;
}) => {
    const queryClient = useQueryClient();
    const isEdit = Boolean(category);

    const {
        register,
        handleSubmit,
        setValue,
        setError,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(categoryFormSchema),
        defaultValues: {
            name: category?.name ?? "",
            slug: category?.slug ?? "",
            description: category?.description ?? "",
        },
    });

    // slug follows the name until the admin edits the slug manually
    const [slugTouched, setSlugTouched] = useState(isEdit);

    const [image, setImage] = useState<File | null>(null);
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [imageError, setImageError] = useState("");
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!image) {
            setLocalPreview(null);
            return;
        }
        const url = URL.createObjectURL(image);
        setLocalPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [image]);

    const preview = localPreview ?? (isEdit ? category?.imageUrl ?? null : null);

    const handleFile = (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setImageError("Please choose an image file (JPG, PNG or WebP).");
            return;
        }
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
            setImageError(`Image must be ${MAX_IMAGE_MB} MB or smaller.`);
            return;
        }
        setImageError("");
        setImage(file);
    };

    const saveMutation = useMutation({
        mutationFn: async (values: FormValues) => {
            // Update: the API expects JSON (image cannot be changed here)
            if (category) {
                const res = await api.put(
                    `/api/categories/${category.categoryId}`,
                    {
                        name: values.name,
                        slug: values.slug,
                        ...(values.description
                            ? { description: values.description }
                            : {}),
                        ...(category.imageUrl
                            ? { imageUrl: category.imageUrl }
                            : {}),
                    }
                );
                return res.data;
            }

            // Create: the API expects FormData with the file in "image"
            const formData = new FormData();
            formData.append("name", values.name);
            formData.append("slug", values.slug);

            if (values.description?.trim()) {
                formData.append("description", values.description.trim());
            }

            if (image) {
                formData.append("image", image);
            }

            const res = await api.post("/api/categories", formData);
            return res.data;
        },

        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ["categories"] });
            onSaved(
                data?.message ??
                (isEdit
                    ? "Category updated successfully"
                    : "Category created successfully")
            );
        },

        onError: (error) => {
            if (axios.isAxiosError(error)) {
                console.error(error.response?.data ?? error.message);

                // show backend field errors under the matching inputs
                const fieldErrors = error.response?.data?.errors;
                if (fieldErrors && typeof fieldErrors === "object") {
                    (["name", "slug", "description"] as const).forEach((key) => {
                        const msg = fieldErrors[key]?.[0];
                        if (msg) setError(key, { message: msg });
                    });
                    const imgMsg = fieldErrors.imageUrl?.[0];
                    if (imgMsg) setImageError(imgMsg);
                }
            } else {
                console.error(error);
            }
        },
    });

    const onSubmit = (values: FormValues) => {
        saveMutation.mutate(values);
    };

    const pending = saveMutation.isPending;
    const nameField = register("name");
    const slugField = register("slug");

    return (
        <Modal onClose={onClose} locked={pending}>
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-6 text-white sm:px-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/25 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                            {isEdit ? "Edit category" : "Add category"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-300">
                            {isEdit
                                ? "Update the details of this category."
                                : "Create a new category for your store."}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={pending}
                        aria-label="Close"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                        <Icon name="close" />
                    </button>
                </div>
            </div>

            {/* Form */}
            <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="flex min-h-0 flex-1 flex-col"
            >
                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label htmlFor="name" className={labelCls}>
                                Category name
                            </label>
                            <input
                                id="name"
                                type="text"
                                placeholder="e.g. Fresh Fruit"
                                {...nameField}
                                onChange={(e) => {
                                    nameField.onChange(e);
                                    if (!slugTouched) {
                                        setValue("slug", slugify(e.target.value));
                                    }
                                }}
                                className={fieldCls(!!errors.name)}
                            />
                            {errors.name && (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.name.message}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="slug" className={labelCls}>
                                Slug
                            </label>
                            <input
                                id="slug"
                                type="text"
                                placeholder="fresh-fruit"
                                {...slugField}
                                onChange={(e) => {
                                    setSlugTouched(true);
                                    slugField.onChange(e);
                                }}
                                className={fieldCls(!!errors.slug)}
                            />
                            {errors.slug ? (
                                <p className="mt-1.5 text-sm text-error">
                                    {errors.slug.message}
                                </p>
                            ) : (
                                <p className="mt-1.5 text-xs text-slate-400">
                                    Lowercase letters, numbers and hyphens.
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="description" className={labelCls}>
                            Description{" "}
                            <span className="font-normal text-slate-400">
                                (optional)
                            </span>
                        </label>
                        <textarea
                            id="description"
                            rows={3}
                            placeholder="Describe this category..."
                            {...register("description")}
                            className={`textarea textarea-bordered w-full rounded-xl bg-slate-50 text-sm focus:bg-white ${errors.description ? "textarea-error" : ""
                                }`}
                        />
                        {errors.description && (
                            <p className="mt-1.5 text-sm text-error">
                                {errors.description.message}
                            </p>
                        )}
                    </div>

                    {/* Image */}
                    <div>
                        <span className={labelCls}>
                            Category image{" "}
                            <span className="font-normal text-slate-400">
                                (optional)
                            </span>
                        </span>

                        {isEdit ? (
                            <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-200">
                                    {preview ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={preview}
                                            alt={category?.name ?? "Category"}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="grid h-full w-full place-items-center text-slate-400">
                                            <Icon name="image" className="h-6 w-6" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">
                                    The current image is kept. Image changes are
                                    not supported when editing.
                                </p>
                            </div>
                        ) : (
                            <>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        handleFile(e.target.files?.[0]);
                                        e.target.value = "";
                                    }}
                                />

                                {preview ? (
                                    <div className="relative overflow-hidden rounded-2xl ring-1 ring-slate-200/70">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={preview}
                                            alt="Selected preview"
                                            className="h-48 w-full object-cover"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-950/70 to-transparent p-3">
                                            <span className="truncate text-xs text-white/90">
                                                {image?.name}
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        fileRef.current?.click()
                                                    }
                                                    className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white"
                                                >
                                                    Change
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setImage(null)}
                                                    className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-white"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileRef.current?.click()}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setDragging(true);
                                        }}
                                        onDragLeave={() => setDragging(false)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setDragging(false);
                                            handleFile(e.dataTransfer.files?.[0]);
                                        }}
                                        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${dragging
                                            ? "border-indigo-400 bg-indigo-50"
                                            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white"
                                            }`}
                                    >
                                        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-500 ring-1 ring-slate-200">
                                            <Icon name="image" className="h-6 w-6" />
                                        </span>
                                        <span className="text-sm font-medium text-slate-700">
                                            Click to upload or drag and drop
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB
                                        </span>
                                    </button>
                                )}
                            </>
                        )}

                        {imageError && (
                            <p className="mt-1.5 text-sm text-error">
                                {imageError}
                            </p>
                        )}
                    </div>

                    {saveMutation.isError && (
                        <div
                            role="alert"
                            className="alert alert-error alert-soft rounded-xl"
                        >
                            <span>
                                {getErrorMessage(
                                    saveMutation.error,
                                    isEdit
                                        ? "Failed to update category."
                                        : "Failed to create category."
                                )}
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={pending}
                        className={ghostBtn}
                    >
                        Cancel
                    </button>
                    <button type="submit" disabled={pending} className={primaryBtn}>
                        {pending ? (
                            <>
                                <span className="loading loading-spinner loading-sm" />
                                {isEdit ? "Saving..." : "Creating..."}
                            </>
                        ) : isEdit ? (
                            "Save changes"
                        ) : (
                            "Create category"
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

/* ---------- delete modal ---------- */
const DeleteModal = ({
    category,
    onClose,
    onDeleted,
}: {
    category: CategoryI;
    onClose: () => void;
    onDeleted: (message: string) => void;
}) => {
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const res = await api.delete(`/api/categories/${category.categoryId}`);
            return res.data;
        },
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ["categories"] });
            onDeleted(data?.message ?? "Category deleted successfully");
        },
        onError: (error) => {
            if (axios.isAxiosError(error)) {
                console.error(error.response?.data ?? error.message);
            } else {
                console.error(error);
            }
        },
    });

    return (
        <Modal
            onClose={onClose}
            locked={deleteMutation.isPending}
            size="max-w-md"
        >
            <div className="p-6 text-center sm:p-8">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                    <Icon name="warn" className="h-7 w-7" />
                </span>
                <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
                    Delete this category?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    <span className="font-medium text-slate-700">
                        {category.name}
                    </span>{" "}
                    will be permanently removed. This action cannot be undone.
                </p>

                {deleteMutation.isError && (
                    <div
                        role="alert"
                        className="alert alert-error alert-soft mt-5 rounded-xl text-left"
                    >
                        <span>
                            {getErrorMessage(
                                deleteMutation.error,
                                "Failed to delete category."
                            )}
                        </span>
                    </div>
                )}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deleteMutation.isPending}
                        className={ghostBtn}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                        className="btn h-11 rounded-xl border-0 bg-rose-600 px-5 font-medium text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700 disabled:bg-slate-400 disabled:text-white"
                    >
                        {deleteMutation.isPending ? (
                            <>
                                <span className="loading loading-spinner loading-sm" />
                                Deleting...
                            </>
                        ) : (
                            "Delete category"
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

/* ---------- page ---------- */
const Page = () => {
    const [allowed, setAllowed] = useState(false);
    const [checkingRole, setCheckingRole] = useState(true);

    const [search, setSearch] = useState("");
    // null = closed, "new" = create, otherwise the category being edited
    const [formTarget, setFormTarget] = useState<CategoryI | "new" | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CategoryI | null>(null);
    const [feedback, setFeedback] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("admin_token");
        const role = localStorage.getItem("admin_role");
        setAllowed(
            Boolean(token) && (role === "admin" || role === "super_admin")
        );
        setCheckingRole(false);
    }, []);

    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey: ["categories"],
        queryFn: async () => {
            const res = await api.get("/api/categories");
            return res.data;
        },
        enabled: allowed && !checkingRole,
    });

    const categories: CategoryI[] = Array.isArray(data?.data) ? data.data : [];

    const term = search.trim().toLowerCase();
    const visible = term
        ? categories.filter(
            (c) =>
                c.name.toLowerCase().includes(term) ||
                c.slug.toLowerCase().includes(term)
        )
        : categories;

    const stateCard = (content: ReactNode) => (
        <div className={`${cardCls} mx-auto max-w-6xl p-8 text-center sm:p-10`}>
            {content}
        </div>
    );

    if (checkingRole) {
        return stateCard(
            <>
                <span className="loading loading-spinner loading-md text-slate-400" />
                <p className="mt-3 text-sm text-slate-500">
                    Checking permissions...
                </p>
            </>
        );
    }

    if (!allowed) {
        return stateCard(
            <>
                <h2 className="text-xl font-semibold text-slate-900">
                    Access Denied
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                    Only admins can manage categories.
                </p>
            </>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* Banner */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white sm:p-10">
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                        backgroundSize: "44px 44px",
                    }}
                />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                    <div className="max-w-xl">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/15">
                            <Icon name="grid" className="h-3.5 w-3.5" />
                            {categories.length}{" "}
                            {categories.length === 1 ? "category" : "categories"}
                        </span>
                        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">
                            Categories
                        </h1>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                            Organize your catalog. Add, edit and remove the
                            categories vendors list their products under.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFormTarget("new")}
                        className="btn h-11 shrink-0 rounded-xl border-0 bg-white px-5 font-medium text-slate-900 hover:bg-slate-100"
                    >
                        <Icon name="plus" className="h-4 w-4" />
                        Add category
                    </button>
                </div>
            </section>

            {/* Search */}
            <div className={`${cardCls} p-2`}>
                <label className="input input-bordered flex h-12 w-full items-center gap-3 rounded-2xl border-0 bg-transparent focus-within:outline-none">
                    <span className="text-slate-400">
                        <Icon name="search" className="h-[18px] w-[18px]" />
                    </span>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or slug"
                        className="grow"
                        aria-label="Search categories"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            aria-label="Clear search"
                            className="text-slate-400 hover:text-slate-700"
                        >
                            <Icon name="close" className="h-4 w-4" />
                        </button>
                    )}
                </label>
            </div>

            {/* Feedback */}
            {feedback && (
                <div
                    role="status"
                    className="alert alert-success alert-soft flex justify-between rounded-xl"
                >
                    <span>{feedback}</span>
                    <button
                        type="button"
                        onClick={() => setFeedback("")}
                        aria-label="Dismiss"
                        className="text-emerald-700 hover:text-emerald-900"
                    >
                        <Icon name="close" className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Content */}
            {isPending ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={`${cardCls} overflow-hidden`}>
                            <div className="h-44 animate-pulse bg-slate-100" />
                            <div className="space-y-3 p-5">
                                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                                <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : isError ? (
                stateCard(
                    <>
                        <p className="text-sm font-medium text-rose-600">
                            Failed to fetch categories: {error.message}
                        </p>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className={`${ghostBtn} mt-4`}
                        >
                            Try again
                        </button>
                    </>
                )
            ) : visible.length === 0 ? (
                stateCard(
                    <>
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                            <Icon name="grid" className="h-7 w-7" />
                        </span>
                        <h2 className="mt-4 text-lg font-semibold text-slate-900">
                            {term ? "No matching categories" : "No categories yet"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {term
                                ? "Try a different search term."
                                : "Create your first category to get started."}
                        </p>
                        {!term && (
                            <button
                                type="button"
                                onClick={() => setFormTarget("new")}
                                className={`${primaryBtn} mt-5`}
                            >
                                <Icon name="plus" className="h-4 w-4" />
                                Add category
                            </button>
                        )}
                    </>
                )
            ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {visible.map((category) => (
                        <article
                            key={category.categoryId}
                            className={`${cardCls} group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-20px_rgba(15,23,42,0.28)]`}
                        >
                            <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-900">
                                {category.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={category.imageUrl}
                                        alt={category.name}
                                        loading="lazy"
                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="grid h-full w-full place-items-center text-5xl font-semibold uppercase text-white/30">
                                        {category.name.charAt(0)}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />
                                <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 font-mono text-xs text-slate-700 backdrop-blur">
                                    /{category.slug}
                                </span>
                            </div>

                            <div className="flex flex-1 flex-col p-5">
                                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                                    {category.name}
                                </h2>
                                <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-500">
                                    {category.description || "No description added."}
                                </p>

                                <div className="mt-5 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormTarget(category)}
                                        className="btn h-10 rounded-xl border border-slate-300 bg-white font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                                    >
                                        <Icon name="edit" className="h-4 w-4" />
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTarget(category)}
                                        className="btn h-10 rounded-xl border border-rose-300 bg-white font-medium text-rose-600 hover:border-rose-400 hover:bg-rose-50"
                                    >
                                        <Icon name="trash" className="h-4 w-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Modals (keyed so the form resets for each category) */}
            {formTarget && (
                <CategoryFormModal
                    key={formTarget === "new" ? "new" : formTarget.categoryId}
                    category={formTarget === "new" ? null : formTarget}
                    onClose={() => setFormTarget(null)}
                    onSaved={(message) => {
                        setFormTarget(null);
                        setFeedback(message);
                    }}
                />
            )}

            {deleteTarget && (
                <DeleteModal
                    category={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={(message) => {
                        setDeleteTarget(null);
                        setFeedback(message);
                    }}
                />
            )}
        </div>
    );
};

export default Page;