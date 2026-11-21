import { sql } from "drizzle-orm";

import { productSchema } from "@/app/api/lib/schema/product-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";

// Vendor description if non-empty, otherwise the admin description
export const effectiveDescription = sql<string | null>`
    COALESCE(
        NULLIF(BTRIM(${vendorProductSchema.description}), ''),
        ${productSchema.description}
    )
`;