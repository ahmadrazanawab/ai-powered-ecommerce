

import { and, eq, gt } from "drizzle-orm";

import { vendors } from "./vendor";
import { vendorProductSchema } from "./vendor-product-schema";
import { productSchema } from "./product-schema";

// Assumes approvedAt is a timestamp and a non-null value
// means the vendor has been approved.
// Verify the vendor schema before relying on this rule.
export function eligibleOfferConditions() {
  return and(
    eq(productSchema.isActive, true),
    eq(vendorProductSchema.isActive, true),
    gt(vendorProductSchema.stock, 0),
  );
}
