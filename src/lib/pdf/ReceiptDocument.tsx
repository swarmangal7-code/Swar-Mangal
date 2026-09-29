import path from "path";
import { pathToFileURL } from "url";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { indianAmount, registerSchoolInvoiceFonts, SCHOOL_BRAND as C } from "./shared";

registerSchoolInvoiceFonts();

// Same letterhead assets and brand as the school invoice — one visual
// identity for every document the academy issues.
const ASSETS = path.join(process.cwd(), "public", "brand");
const LOGO = pathToFileURL(path.join(ASSETS, "logo-mark.png")).href;
const SIGNATURE_SHARVIL = pathToFileURL(path.join(ASSETS, "signature-sharvil.png")).href;
const SIGNATURE_PIYUSH = pathToFileURL(path.join(ASSETS, "signature-piyush.png")).href;

export interface ReceiptPdfData {
  receiptNo: string;
  studentName: string;
  studentId: string;
  branch: string;
  date: string;
  amount: number;
  paymentMode: string;
  reference: string;
  feePeriodFrom: string;
  feePeriodTo: string;
  status: string;
}

// The bundled Inter subset has no ₹ glyph (see shared.tsx / InvoiceDocument),
// so amounts print as "Rs." the same way the school invoice does.
const rs = (v: number) => `Rs. ${indianAmount(v)}`;

function branchLabel(raw: string): string {
  const v = (raw || "").toUpperCase();
  if (v.includes("GOR")) return "Goregaon";
  if (v.includes("KAN")) return "Kandivali";
  return raw || "—";
}

function niceDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

const st = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Inter",
    fontSize: 9,
    color: C.ink,
  },
  watermark: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 52,
    fontFamily: "Playfair Display",
    fontWeight: 700,
    color: C.borderStrong,
    opacity: 0.7,
    letterSpacing: 3,
    transform: "rotate(-22deg)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: C.maroon,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 30, height: 30, marginRight: 8 },
  wordmark: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 15, color: C.maroon },
  wordmarkSub: { fontSize: 7, color: C.gray, marginTop: 1, letterSpacing: 0.4 },
  receiptTitle: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 17, color: "#161616" },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: C.pillBg,
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  pillText: { fontSize: 7.5, fontWeight: 700, color: C.maroon },
  voidText: { fontSize: 8, color: C.maroon, marginTop: 3, fontWeight: 700 },
  docNo: { fontSize: 10.5, fontWeight: 700, color: C.maroon },
  docMeta: { fontSize: 8, color: C.gray, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  rowZebra: { backgroundColor: C.cream },
  rowLast: { borderBottomWidth: 0 },
  label: { width: 100, fontSize: 7, color: C.gray, letterSpacing: 0.4 },
  value: { flex: 1, fontSize: 9.5, fontWeight: 700, color: C.ink },
  amountBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.pillBg,
    borderLeftWidth: 4,
    borderLeftColor: C.maroon,
    borderRadius: 3,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  amountLabel: { fontSize: 7.5, color: C.gray, letterSpacing: 0.4 },
  amountValue: { fontSize: 16, fontWeight: 700, color: C.maroon },
  amountWords: { fontSize: 7.5, color: C.gray, marginBottom: 16 },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  signBlock: { alignItems: "center", width: 110 },
  signImage: { width: 78, height: 32, objectFit: "contain" },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.ink, width: 90, marginTop: 2 },
  signName: { fontSize: 8, fontWeight: 700, marginTop: 3 },
  signTitle: { fontSize: 6.5, color: C.gray },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
    alignItems: "center",
  },
  footerBrand: { fontSize: 7.5, fontWeight: 700, color: C.maroon },
  footerText: { fontSize: 6.5, color: C.gray, marginTop: 1 },
});

function Row({ label, value, last, zebra }: { label: string; value: string; last?: boolean; zebra?: boolean }) {
  return (
    <View style={[st.row, zebra ? st.rowZebra : {}, last ? st.rowLast : {}]}>
      <Text style={st.label}>{label.toUpperCase()}</Text>
      <Text style={st.value}>{value || "—"}</Text>
    </View>
  );
}

export function ReceiptDocument({ data }: { data: ReceiptPdfData }) {
  const period = data.feePeriodFrom
    ? data.feePeriodTo
      ? `${niceDate(data.feePeriodFrom)} to ${niceDate(data.feePeriodTo)}`
      : `from ${niceDate(data.feePeriodFrom)}`
    : "";
  const isVoid = data.status.toUpperCase() === "VOID";
  const rows: Array<[string, string]> = [
    ["Received from", data.studentName],
    ["Student ID", data.studentId],
    ["Payment mode", data.paymentMode],
    ...(data.reference ? [["Reference / UTR", data.reference] as [string, string]] : []),
    ...(period ? [["Fee period", period] as [string, string]] : []),
    ["Status", isVoid ? "VOID" : "PAID"],
  ];

  return (
    <Document title={`Receipt ${data.receiptNo}`}>
      <Page size="A5" style={st.page}>
        <Text style={st.watermark}>{isVoid ? "VOID" : "PAID"}</Text>

        <View style={st.headerRow}>
          <View style={st.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            <Image src={LOGO} style={st.logo} />
            <View>
              <Text style={st.wordmark}>Swar Mangal™</Text>
              <Text style={st.wordmarkSub}>MUSIC ACADEMY · {branchLabel(data.branch).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={st.receiptTitle}>RECEIPT</Text>
        </View>

        <View style={st.titleRow}>
          <View>
            <View style={st.pill}>
              <Text style={st.pillText}>FEE RECEIPT</Text>
            </View>
            {isVoid && <Text style={st.voidText}>VOID — excluded from totals</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={st.docNo}>{data.receiptNo}</Text>
            <Text style={st.docMeta}>{niceDate(data.date)}</Text>
          </View>
        </View>

        <View style={st.card}>
          {rows.map(([label, value], i) => (
            <Row key={label} label={label} value={value} zebra={i % 2 === 1} last={i === rows.length - 1} />
          ))}
        </View>

        <View style={st.amountBox}>
          <Text style={st.amountLabel}>AMOUNT RECEIVED</Text>
          <Text style={st.amountValue}>{rs(data.amount)}</Text>
        </View>
        <Text style={st.amountWords}>{"Amount received as stated above."}</Text>

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

        <View style={st.footer}>
          <Text style={st.footerBrand}>Swar Mangal™ Music Academy</Text>
          <Text style={st.footerText}>Branches: Goregaon | Kandivali · +91-9769419519 | +91-8169222089</Text>
        </View>
      </Page>
    </Document>
  );
}
