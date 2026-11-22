"use client";

import Image from "next/image";
import { useState } from "react";

interface Props {
    src: string | null | undefined;
    alt: string;
    sizes: string;
    priority?: boolean;
    className?: string;
}

export default function ProductImageDisplay({
    src,
    alt,
    sizes,
    priority = false,
    className = "object-cover",
}: Props) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    if (!src || failedSrc === src) {
        return (
            <div
                role="img"
                aria-label={`${alt} image unavailable`}
                className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-900 to-indigo-900 text-amber-200/50"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-16 w-16"
                    aria-hidden="true"
                >
                    <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
                    <path d="M3 9h18M9 4l3 5 3-5M12 9v11" />
                </svg>
            </div>
        );
    }

    return (
        <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            preload={priority}
            className={className}
            onError={() => setFailedSrc(src)}
        />
    );
}
