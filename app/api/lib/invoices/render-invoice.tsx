import {
    Document,
    Page,
    StyleSheet,
    Text,
    View,
    renderToBuffer,
} from "@react-pdf/renderer";

import type {
    InvoiceCustomerSnapshot,
    InvoiceSellerSnapshot,
    InvoiceTotalsSnapshot,
} from "@/app/api/lib/schema/invoice-schema";

export interface InvoicePdfItem {
    productName: string;
    hsnCode: string | null;
    quantity: number;
    unitPrice: string;
    discountAmount: string;
    taxableAmount: string;
    gstRate: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    totalTax: string;
    lineTotal: string;
}

export interface InvoicePdfSnapshot {
    invoiceNumber: string;
    invoiceDate: string;
    orderId: string;
    invoiceType: "tax_invoice" | "bill_of_supply" | "commercial_invoice";
    seller: InvoiceSellerSnapshot;
    customer: InvoiceCustomerSnapshot;
    totals: InvoiceTotalsSnapshot;
    items: InvoicePdfItem[];
}

const styles = StyleSheet.create({
    page: {
        paddingTop: 32,
        paddingBottom: 38,
        paddingHorizontal: 32,
        fontFamily: "Helvetica",
        fontSize: 8,
        color: "#1e293b",
    },
    header: {
        borderBottomWidth: 1,
        borderBottomColor: "#cbd5e1",
        paddingBottom: 12,
        marginBottom: 14,
        flexDirection: "row",
        justifyContent: "space-between",
    },
    title: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#0f172a" },
    muted: { color: "#64748b", marginTop: 3 },
    sectionRow: { flexDirection: "row", gap: 16, marginBottom: 14 },
    section: { flexGrow: 1, flexBasis: 0 },
    sectionTitle: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
        color: "#334155",
        marginBottom: 4,
        textTransform: "uppercase",
    },
    body: { lineHeight: 1.35 },
    table: { width: "100%", marginTop: 4 },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f1f5f9",
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#cbd5e1",
        paddingVertical: 6,
        paddingHorizontal: 4,
        fontFamily: "Helvetica-Bold",
        color: "#334155",
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: "#e2e8f0",
        paddingVertical: 5,
        paddingHorizontal: 4,
        alignItems: "flex-start",
    },
    product: { width: "19%", paddingRight: 4 },
    qty: { width: "4%", textAlign: "right" },
    hsn: { width: "7%", textAlign: "center" },
    unitPrice: { width: "9%", textAlign: "right" },
    discount: { width: "9%", textAlign: "right" },
    taxable: { width: "10%", textAlign: "right" },
    rate: { width: "6%", textAlign: "right" },
    tax: { width: "8%", textAlign: "right" },
    total: { width: "12%", textAlign: "right" },
    totals: {
        width: 230,
        alignSelf: "flex-end",
        marginTop: 14,
        padding: 10,
        backgroundColor: "#f8fafc",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    grandTotal: {
        borderTopWidth: 1,
        borderTopColor: "#94a3b8",
        paddingTop: 6,
        marginTop: 3,
        fontFamily: "Helvetica-Bold",
        fontSize: 10,
    },
    footer: {
        position: "absolute",
        bottom: 18,
        left: 32,
        right: 32,
        borderTopWidth: 0.5,
        borderTopColor: "#cbd5e1",
        paddingTop: 5,
        color: "#64748b",
        fontSize: 7,
        flexDirection: "row",
        justifyContent: "space-between",
    },
});

function money(value: string) {
    return `INR ${value}`;
}

function addressLines(
    address: InvoiceCustomerSnapshot["shippingAddress"] |
        InvoiceSellerSnapshot["address"]
) {
    return [
        address.addressLine1,
        address.addressLine2,
        [address.city, address.state, "postalCode" in address ? address.postalCode : null]
            .filter(Boolean)
            .join(", "),
        address.country,
    ].filter(Boolean);
}

function InvoiceDocument({ invoice }: { invoice: InvoicePdfSnapshot }) {
    const typeLabel = {
        tax_invoice: "Tax Invoice",
        bill_of_supply: "Bill of Supply",
        commercial_invoice: "Commercial Invoice",
    }[invoice.invoiceType];

    return (
        <Document title={invoice.invoiceNumber} author={invoice.seller.businessName}>
            <Page size="A4" orientation="landscape" style={styles.page} wrap>
                <View style={styles.header} fixed>
                    <View>
                        <Text style={styles.title}>{typeLabel}</Text>
                        <Text style={styles.muted}>
                            {invoice.seller.invoiceDisplayName}
                        </Text>
                    </View>
                    <View>
                        <Text>Invoice: {invoice.invoiceNumber}</Text>
                        <Text style={styles.muted}>
                            Date: {invoice.invoiceDate}
                        </Text>
                        <Text style={styles.muted}>
                            Order: {invoice.orderId}
                        </Text>
                    </View>
                </View>

                <View style={styles.sectionRow}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Seller</Text>
                        <Text style={styles.body}>
                            {invoice.seller.businessName}
                        </Text>
                        {addressLines(invoice.seller.address).map((line, index) => (
                            <Text key={`seller-${index}`} style={styles.body}>
                                {line}
                            </Text>
                        ))}
                        <Text style={styles.body}>
                            {invoice.seller.email} · {invoice.seller.phone}
                        </Text>
                        {invoice.seller.gstin && (
                            <Text style={styles.body}>
                                GSTIN: {invoice.seller.gstin}
                            </Text>
                        )}
                    </View>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Bill to</Text>
                        <Text style={styles.body}>{invoice.customer.name}</Text>
                        {invoice.customer.email && (
                            <Text style={styles.body}>
                                {invoice.customer.email}
                            </Text>
                        )}
                        <Text style={styles.body}>
                            {invoice.customer.phone}
                        </Text>
                        {addressLines(invoice.customer.billingAddress).map(
                            (line, index) => (
                                <Text key={`billing-${index}`} style={styles.body}>
                                    {line}
                                </Text>
                            )
                        )}
                    </View>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Ship to</Text>
                        <Text style={styles.body}>
                            {invoice.customer.shippingAddress.fullName}
                        </Text>
                        {addressLines(invoice.customer.shippingAddress).map(
                            (line, index) => (
                                <Text key={`shipping-${index}`} style={styles.body}>
                                    {line}
                                </Text>
                            )
                        )}
                    </View>
                </View>

                <View style={styles.sectionRow}>
                    <Text style={styles.body}>
                        Payment method: {invoice.totals.paymentMethod.toUpperCase()}
                    </Text>
                    <Text style={styles.body}>
                        Payment status at issue:{" "}
                        {invoice.totals.paymentStatusAtIssue.toUpperCase()}
                    </Text>
                </View>

                <View style={styles.table}>
                    <View style={styles.tableHeader} fixed>
                        <Text style={styles.product}>Product</Text>
                        <Text style={styles.qty}>Qty</Text>
                        <Text style={styles.hsn}>HSN</Text>
                        <Text style={styles.unitPrice}>Unit price</Text>
                        <Text style={styles.discount}>Discount</Text>
                        <Text style={styles.taxable}>Taxable value</Text>
                        <Text style={styles.rate}>GST %</Text>
                        <Text style={styles.tax}>CGST</Text>
                        <Text style={styles.tax}>SGST</Text>
                        <Text style={styles.tax}>IGST</Text>
                        <Text style={styles.total}>Line total</Text>
                    </View>
                    {invoice.items.map((item, index) => (
                        <View
                            key={`${invoice.invoiceNumber}-${index}`}
                            style={styles.tableRow}
                            wrap={false}
                        >
                            <Text style={styles.product}>{item.productName}</Text>
                            <Text style={styles.qty}>{item.quantity}</Text>
                            <Text style={styles.hsn}>{item.hsnCode ?? "—"}</Text>
                            <Text style={styles.unitPrice}>
                                {money(item.unitPrice)}
                            </Text>
                            <Text style={styles.discount}>
                                {money(item.discountAmount)}
                            </Text>
                            <Text style={styles.taxable}>
                                {money(item.taxableAmount)}
                            </Text>
                            <Text style={styles.rate}>{item.gstRate}%</Text>
                            <Text style={styles.tax}>
                                {money(item.cgstAmount)}
                            </Text>
                            <Text style={styles.tax}>
                                {money(item.sgstAmount)}
                            </Text>
                            <Text style={styles.tax}>
                                {money(item.igstAmount)}
                            </Text>
                            <Text style={styles.total}>
                                {money(item.lineTotal)}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.totals} wrap={false}>
                    <Total label="Subtotal (taxable)" value={invoice.totals.subtotal} />
                    <Total label="Discount" value={invoice.totals.discountAmount} />
                    <Total label="Shipping" value={invoice.totals.shippingCharges} />
                    <Total label="CGST" value={invoice.totals.cgstAmount} />
                    <Total label="SGST" value={invoice.totals.sgstAmount} />
                    <Total label="IGST" value={invoice.totals.igstAmount} />
                    <Total label="Total GST" value={invoice.totals.taxTotal} />
                    <View style={[styles.totalRow, styles.grandTotal]}>
                        <Text>Grand total</Text>
                        <Text>{money(invoice.totals.grandTotal)}</Text>
                    </View>
                    <Total label="Amount paid at issue" value={invoice.totals.amountPaid} />
                    <Total
                        label="Outstanding at issue"
                        value={invoice.totals.outstandingAmount}
                    />
                </View>

                <View style={styles.footer} fixed>
                    <Text>
                        Payment state and amounts are captured as of invoice issue.
                    </Text>
                    <Text
                        render={({ pageNumber, totalPages }) =>
                            `Page ${pageNumber} of ${totalPages}`
                        }
                    />
                </View>
            </Page>
        </Document>
    );
}

function Total({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.totalRow}>
            <Text>{label}</Text>
            <Text>{money(value)}</Text>
        </View>
    );
}

export async function renderInvoicePdf(
    invoice: InvoicePdfSnapshot
): Promise<Buffer> {
    return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}
