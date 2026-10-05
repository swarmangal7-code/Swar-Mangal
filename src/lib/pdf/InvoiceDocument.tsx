import path from "path";
import { pathToFileURL } from "url";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { indianAmount, registerSchoolInvoiceFonts, SCHOOL_BRAND as C } from "./shared";

registerSchoolInvoiceFonts();

// react-pdf loads Image sources with fetch() even under the Node renderer —
// a bare Windows/POSIX filesystem path is not a valid fetch target, so this
// must be a file:// URL.
const ASSETS = path.join(process.cwd(), "public", "brand");
const LOGO = pathToFileURL(path.join(ASSETS, "logo-mark.png")).href;
const SIGNATURE_SHARVIL = pathToFileURL(path.join(ASSETS, "signature-sharvil.png")).href;
const SIGNATURE_PIYUSH = pathToFileURL(path.join(ASSETS, "signature-piyush.png")).href;

export interface InvoiceBeneficiary {
  name: string;
  amount: number;
  bankName: string;
  accountNo: string;
  ifsc: string;
  upi: string;
}

export interface InvoiceCharge {
  description: string;
  amount: number;
}

export interface InvoicePdfData {
  invoiceNo: string;
  invoiceDate: string;
  billingPeriodFrom: string;
  billingPeriodTo: string;
  branch: string;
  schoolCode: string;
  schoolName: string;
  schoolAddress: string;
  attn: string;
  billingBasis: string;
  serviceDescription: string;
  amount: number;
  /** Optional "Other charges" on top of `amount` (the fixed/base amount) —
   *  e.g. "Diwali decoration — ₹500". Empty/undefined for every invoice
   *  issued before this existed, which keeps printing exactly as before. */
  charges?: InvoiceCharge[];
  /** "FINAL" (default/omitted) prints exactly as before. "VOID" stamps a
   *  watermark so a voided invoice is never mistaken for a live one if it's
   *  already been downloaded/shared — mirrors ReceiptDocument's VOID stamp. */
  status?: string;
}

// The bundled Inter subset (assets/fonts/Inter-400.ttf, 230 glyphs — the
// app's UI subset) has no ₹ glyph, so it renders invisibly. "Rs." is the
// same fallback already used for receipts for the identical reason.
const rs = (v: number) => `Rs. ${indianAmount(v)}`;

/** The number actually printed on the letterhead is the short series number
 *  (e.g. "SMI-26-27-005") — the "_SCH_<CODE>" suffix exists only to make the
 *  PDF filename/invoice id unique across schools sharing one sequence. */
function displayInvoiceNo(invoiceNo: string): string {
  return invoiceNo.replace(/_SCH_[A-Za-z0-9_-]+$/, "");
}

const st = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Inter",
    fontSize: 9.5,
    color: C.ink,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.maroon,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 38, height: 38, marginRight: 10 },
  wordmark: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 20, color: C.maroon },
  invoiceTitle: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 24, color: "#161616" },
  infoBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    backgroundColor: C.cream,
    padding: 10,
    marginBottom: 10,
  },
  infoDivider: {
    width: 1,
    backgroundColor: C.border,
    marginHorizontal: 12,
  },
  label: { fontSize: 7.5, color: C.gray, letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 10, fontWeight: 700, color: C.ink },
  small: { fontSize: 8.5, color: C.gray, marginTop: 1 },
  sectionHeading: {
    fontSize: 8.5,
    fontWeight: 700,
    color: C.maroon,
    letterSpacing: 0.8,
    marginTop: 7,
    marginBottom: 4,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: C.pillBg,
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginTop: 5,
    marginBottom: 2,
  },
  pillText: { fontSize: 8.5, fontWeight: 700, color: C.maroon },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.maroon,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tableHeaderCell: { fontSize: 7.5, fontWeight: 700, color: "#FFFFFF", letterSpacing: 0.5 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: C.border,
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colRate: { flex: 1.4, textAlign: "right" },
  colAmount: { flex: 1.4, textAlign: "right" },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: C.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.maroon,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  totalLabel: { fontSize: 10, fontWeight: 700, color: "#FFFFFF" },
  totalValue: { fontSize: 10, fontWeight: 700, color: "#FFFFFF" },
  beneficiaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.maroon,
    borderRadius: 2,
    padding: 7,
  },
  beneficiaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.borderStrong,
    paddingVertical: 2,
  },
  beneficiaryLabel: { fontSize: 7.5, color: C.gray },
  beneficiaryValue: { fontSize: 8.5, fontWeight: 700, color: C.ink, textAlign: "right" },
  note: { fontSize: 8, color: C.ink, marginBottom: 2, lineHeight: 1.3 },
  signRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 36,
    marginTop: 14,
  },
  signBlock: { alignItems: "center", width: 130 },
  signImage: { width: 90, height: 38, objectFit: "contain" },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.ink, width: 110, marginTop: 2 },
  signName: { fontSize: 9, fontWeight: 700, marginTop: 4 },
  signTitle: { fontSize: 7.5, color: C.gray },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  footerLeft: { fontSize: 7.5, color: C.gray },
  footerLeftBrand: { fontSize: 8, fontWeight: 700, color: C.maroon, marginBottom: 1 },
  footerRight: { fontSize: 7.5, color: C.gray, textAlign: "right" },
  watermark: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 64,
    fontFamily: "Playfair Display",
    fontWeight: 700,
    color: C.borderStrong,
    opacity: 0.7,
    letterSpacing: 3,
    transform: "rotate(-22deg)",
  },
});

// Abbreviated month ("02 Oct 2026") — the invoice date sits in a narrow
// half-column next to the invoice number, where a full month name
// ("October") wraps the year onto its own line.
function niceDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

function ddmmyyyy(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function InvoiceDocument({ data, beneficiaries }: { data: InvoicePdfData; beneficiaries: InvoiceBeneficiary[] }) {
  const billingPeriod = data.billingPeriodFrom && data.billingPeriodTo ? `${ddmmyyyy(data.billingPeriodFrom)} to ${ddmmyyyy(data.billingPeriodTo)}` : "";
  const split = beneficiaries.length > 1;
  const splitTotal = beneficiaries.reduce((sum, b) => sum + b.amount, 0);
  const charges = data.charges ?? [];
  const hasCharges = charges.length > 0;
  const total = data.amount + charges.reduce((sum, c) => sum + c.amount, 0);

  return (
    <Document title={`Invoice ${data.invoiceNo}`}>
      <Page size="A4" style={st.page}>
        <View style={st.headerRow}>
          <View style={st.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            <Image src={LOGO} style={st.logo} />
            <Text style={st.wordmark}>Swar Mangal™</Text>
          </View>
          <Text style={st.invoiceTitle}>INVOICE</Text>
        </View>

        <View style={st.infoBox}>
          <View style={{ flex: 1.5 }}>
            <Text style={st.label}>BILLED TO</Text>
            <Text style={st.value}>{data.schoolName || "—"}</Text>
            {!!data.schoolAddress && <Text style={st.small}>{data.schoolAddress}</Text>}
            <Text style={st.small}>Attn: {data.attn || "The Principal"}</Text>
          </View>
          <View style={st.infoDivider} />
          <View style={{ flex: 1.3 }}>
            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>INVOICE NO.</Text>
                <Text style={st.value}>{displayInvoiceNo(data.invoiceNo)}</Text>
              </View>
              <View style={{ flex: 1.1 }}>
                <Text style={st.label}>INVOICE DATE</Text>
                <Text style={st.value}>{niceDate(data.invoiceDate)}</Text>
              </View>
            </View>
            {!!billingPeriod && (
              <View style={{ marginTop: 8 }}>
                <Text style={st.label}>BILLING PERIOD</Text>
                <Text style={st.value}>{billingPeriod}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={{ fontSize: 9.5, marginBottom: 4 }}>Dear Sir/Madam,</Text>
        <Text style={{ fontSize: 9.5, marginBottom: 4 }}>
          Please find below our invoice for the monthly school music education programme services for the billing period stated above.
        </Text>

        <View style={st.pill}>
          <Text style={st.pillText}>Billing Basis: {data.billingBasis || "Fixed Monthly"}</Text>
        </View>

        <Text style={st.sectionHeading}>SERVICE SUMMARY</Text>
        <Text style={{ fontSize: 9, lineHeight: 1.4 }}>
          Monthly music education services for the school programme
          {billingPeriod ? ` (${billingPeriod}, fixed monthly billing)` : ""}. Instruments covered: {data.serviceDescription || "Music education"}.
        </Text>

        <Text style={st.sectionHeading}>PARTICULARS</Text>
        <View>
          <View style={st.tableHeader}>
            <Text style={[st.tableHeaderCell, st.colDesc]}>DESCRIPTION</Text>
            <Text style={[st.tableHeaderCell, st.colQty]}>QTY</Text>
            <Text style={[st.tableHeaderCell, st.colRate]}>RATE</Text>
            <Text style={[st.tableHeaderCell, st.colAmount]}>AMOUNT</Text>
          </View>
          <View style={st.tableRow}>
            <Text style={[{ fontSize: 9 }, st.colDesc]}>
              {hasCharges ? "Fixed amount" : `Monthly Music Education Services — ${data.serviceDescription || "Music education"}`}
            </Text>
            <Text style={[{ fontSize: 9 }, st.colQty]}>1</Text>
            <Text style={[{ fontSize: 9 }, st.colRate]}>{rs(data.amount)}</Text>
            <Text style={[{ fontSize: 9, fontWeight: 700 }, st.colAmount]}>{rs(data.amount)}</Text>
          </View>
          {charges.map((c, i) => (
            <View key={i} style={st.tableRow}>
              <Text style={[{ fontSize: 9 }, st.colDesc]}>{c.description}</Text>
              <Text style={[{ fontSize: 9 }, st.colQty]}>1</Text>
              <Text style={[{ fontSize: 9 }, st.colRate]}>{rs(c.amount)}</Text>
              <Text style={[{ fontSize: 9, fontWeight: 700 }, st.colAmount]}>{rs(c.amount)}</Text>
            </View>
          ))}
          <View style={st.subtotalRow}>
            <Text style={{ fontSize: 9, color: C.gray, marginRight: 24 }}>Subtotal</Text>
            <Text style={{ fontSize: 9, fontWeight: 700 }}>{rs(total)}</Text>
          </View>
          <View style={st.totalRow}>
            <Text style={st.totalLabel}>Total due</Text>
            <Text style={st.totalValue}>{rs(total)}</Text>
          </View>
        </View>

        <Text style={st.sectionHeading}>PAYMENT INSTRUCTIONS</Text>
        <Text style={{ fontSize: 9, marginBottom: 8 }}>
          {split ? "Payment split as per authorised collection instruction." : `Payable to the ${beneficiaries[0]?.name || "Swar Mangal"} account below.`}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {beneficiaries.map((b, i) => (
            <View key={i} style={st.beneficiaryBox}>
              <View style={st.beneficiaryRow}>
                <Text style={st.beneficiaryLabel}>Beneficiary</Text>
                <Text style={st.beneficiaryValue}>{b.name}</Text>
              </View>
              <View style={st.beneficiaryRow}>
                <Text style={st.beneficiaryLabel}>Amount payable</Text>
                <Text style={[st.beneficiaryValue, { color: C.maroon }]}>{rs(b.amount)}</Text>
              </View>
              <View style={st.beneficiaryRow}>
                <Text style={st.beneficiaryLabel}>Bank</Text>
                <Text style={st.beneficiaryValue}>{b.bankName || "—"}</Text>
              </View>
              <View style={st.beneficiaryRow}>
                <Text style={st.beneficiaryLabel}>Account no.</Text>
                <Text style={st.beneficiaryValue}>{b.accountNo || "—"}</Text>
              </View>
              <View style={st.beneficiaryRow}>
                <Text style={st.beneficiaryLabel}>IFSC</Text>
                <Text style={st.beneficiaryValue}>{b.ifsc || "—"}</Text>
              </View>
              <View style={[st.beneficiaryRow, { borderBottomWidth: 0 }]}>
                <Text style={st.beneficiaryLabel}>UPI</Text>
                <Text style={st.beneficiaryValue}>{b.upi || "—"}</Text>
              </View>
            </View>
          ))}
        </View>
        {split && (
          <Text style={{ fontSize: 8.5, marginTop: 8 }}>
            Total invoice amount <Text style={{ fontWeight: 700 }}>{rs(data.amount)}</Text>{"   "}
            Split total <Text style={{ fontWeight: 700 }}>{rs(splitTotal)}</Text>{"   "}
            <Text style={{ color: Math.abs(splitTotal - data.amount) < 0.01 ? "#2E7D32" : C.maroon, fontWeight: 700 }}>
              {Math.abs(splitTotal - data.amount) < 0.01 ? "Split reconciles to the total." : "Split does not reconcile — check beneficiary shares."}
            </Text>
          </Text>
        )}

        <Text style={[st.sectionHeading, { marginTop: 14 }]}>NOTES</Text>
        <Text style={st.note}>
          1. This is a finalised tax-neutral service invoice. Kindly remit the total due by the due date and quote the invoice number on your payment reference.
        </Text>
        <Text style={st.note}>2. GST, if applicable, will be added as per prevailing rates and the agreed billing arrangement.</Text>

        <Text style={{ fontSize: 7.5, fontWeight: 700, color: C.gray, textAlign: "right", letterSpacing: 0.5, marginTop: 12 }}>
          AUTHORISED SIGNATORIES · FOR SWAR MANGAL™
        </Text>
        <View style={st.signRow}>
          <View style={st.signBlock}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            <Image src={SIGNATURE_SHARVIL} style={st.signImage} />
            <View style={st.signLine} />
            <Text style={st.signName}>Sharvil Vaidya</Text>
            <Text style={st.signTitle}>Authorised Signatory</Text>
          </View>
          <View style={st.signBlock}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            <Image src={SIGNATURE_PIYUSH} style={st.signImage} />
            <View style={st.signLine} />
            <Text style={st.signName}>Piyush Kashyap</Text>
            <Text style={st.signTitle}>Authorised Signatory</Text>
          </View>
        </View>

        <View style={st.footer} fixed>
          <View>
            <Text style={st.footerLeftBrand}>Swar Mangal™</Text>
            <Text style={st.footerLeft}>Registered name: Swar Mangal™</Text>
            <Text style={st.footerLeft}>Swar Mangal Music Academy · Branches: Goregaon | Kandivali</Text>
          </View>
          <View>
            <Text style={st.footerRight}>Contact: +91-9769419519 | +91-8169222089</Text>
            <Text style={st.footerRight}>swarmangal.com | @Swarmangal</Text>
          </View>
        </View>

        {(data.status ?? "").toUpperCase() === "VOID" && <Text style={st.watermark}>VOID</Text>}
      </Page>
    </Document>
  );
}
