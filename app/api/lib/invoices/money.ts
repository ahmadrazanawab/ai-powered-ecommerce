export function decimalToMinorUnits(value: string): bigint {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) {
        throw new Error("INVALID_MONEY_VALUE");
    }

    const sign = match[1] === "-" ? -1n : 1n;
    const whole = BigInt(match[2]);
    const fraction = BigInt((match[3] ?? "").padEnd(2, "0"));
    return sign * (whole * 100n + fraction);
}

export function minorUnitsToDecimal(value: bigint): string {
    const sign = value < 0n ? "-" : "";
    const absolute = value < 0n ? -value : value;
    return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function gstRateToBasisPoints(value: string): bigint {
    const match = /^(100(?:\.0{1,2})?|(?:\d{1,2})(?:\.\d{1,2})?)$/.exec(
        value
    );
    if (!match) throw new Error("INVALID_GST_RATE");

    const [whole, fraction = ""] = value.split(".");
    const basisPoints = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    if (basisPoints > 10000n) throw new Error("INVALID_GST_RATE");
    return basisPoints;
}

const indianStates = new Set([
    "andhra pradesh",
    "arunachal pradesh",
    "assam",
    "bihar",
    "chhattisgarh",
    "goa",
    "gujarat",
    "haryana",
    "himachal pradesh",
    "jharkhand",
    "karnataka",
    "kerala",
    "madhya pradesh",
    "maharashtra",
    "manipur",
    "meghalaya",
    "mizoram",
    "nagaland",
    "odisha",
    "punjab",
    "rajasthan",
    "sikkim",
    "tamil nadu",
    "telangana",
    "tripura",
    "uttar pradesh",
    "uttarakhand",
    "west bengal",
    "andaman and nicobar islands",
    "chandigarh",
    "dadra and nagar haveli and daman and diu",
    "delhi",
    "jammu and kashmir",
    "ladakh",
    "lakshadweep",
    "puducherry",
]);

const stateAliases: Record<string, string> = {
    "andaman & nicobar islands": "andaman and nicobar islands",
    "dadra and nagar haveli": "dadra and nagar haveli and daman and diu",
    "dadra & nagar haveli": "dadra and nagar haveli and daman and diu",
    "daman and diu": "dadra and nagar haveli and daman and diu",
    "jammu & kashmir": "jammu and kashmir",
    "nct of delhi": "delhi",
    orissa: "odisha",
    pondicherry: "puducherry",
    uttaranchal: "uttarakhand",
};

function normalizedIndianState(value: string): string | null {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[.,]/g, "")
        .replace(/\s+/g, " ");
    const canonical = stateAliases[normalized] ?? normalized;
    return indianStates.has(canonical) ? canonical : null;
}

export function isInterstateIndianSupply(
    sellerState: string,
    placeOfSupplyState: string
): boolean | null {
    const seller = normalizedIndianState(sellerState);
    const placeOfSupply = normalizedIndianState(placeOfSupplyState);
    if (!seller || !placeOfSupply) return null;
    return seller !== placeOfSupply;
}

export function calculateInclusiveTax(
    totalPaise: bigint,
    gstRate: string,
    interstate: boolean
) {
    const rateBasisPoints = gstRateToBasisPoints(gstRate);
    const denominator = 10000n + rateBasisPoints;
    const numerator = totalPaise * rateBasisPoints;
    const totalTaxPaise =
        rateBasisPoints === 0n
            ? 0n
            : (numerator * 2n + denominator) / (denominator * 2n);
    const taxablePaise = totalPaise - totalTaxPaise;
    const cgstPaise = interstate ? 0n : totalTaxPaise / 2n;
    const sgstPaise = interstate ? 0n : totalTaxPaise - cgstPaise;
    const igstPaise = interstate ? totalTaxPaise : 0n;

    return {
        taxableAmount: minorUnitsToDecimal(taxablePaise),
        cgstAmount: minorUnitsToDecimal(cgstPaise),
        sgstAmount: minorUnitsToDecimal(sgstPaise),
        igstAmount: minorUnitsToDecimal(igstPaise),
        totalTax: minorUnitsToDecimal(totalTaxPaise),
    };
}
