import path from "path";
import { pathToFileURL } from "url";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { registerSchoolInvoiceFonts, SCHOOL_BRAND as C } from "./shared";

registerSchoolInvoiceFonts();

// Same letterhead assets and brand as receipts/invoices — one visual
// identity for every document the academy issues.
const ASSETS = path.join(process.cwd(), "public", "brand");
const LOGO = pathToFileURL(path.join(ASSETS, "logo-mark.png")).href;

export interface EnrollmentConfirmationPdfData {
  studentName: string;
  guardianName: string;
  phone: string;
  email: string;
  instrument: string;
  branch: string;
  submittedAt: string; // ISO timestamp
}

function branchLabel(raw: string): string {
  const v = (raw || "").toUpperCase();
  if (v.includes("GOR")) return "Goregaon";
  if (v.includes("KAN")) return "Kandivali";
  return raw || "—";
}

function niceDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
}

const st = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Inter",
    fontSize: 9,
    color: C.ink,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: C.maroon,
    marginBottom: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 30, height: 30, marginRight: 8 },
  wordmark: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 15, color: C.maroon },
  wordmarkSub: { fontSize: 7, color: C.gray, marginTop: 1, letterSpacing: 0.4 },
  title: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 17, color: "#161616" },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: C.pillBg,
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 9,
    marginBottom: 14,
  },
  pillText: { fontSize: 7.5, fontWeight: 700, color: C.maroon },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  rowZebra: { backgroundColor: C.cream },
  rowLast: { borderBottomWidth: 0 },
  label: { width: 110, fontSize: 7, color: C.gray, letterSpacing: 0.4 },
  value: { flex: 1, fontSize: 9.5, fontWeight: 700, color: C.ink },
  acceptBox: {
    backgroundColor: C.pillBg,
    borderLeftWidth: 4,
    borderLeftColor: C.maroon,
    borderRadius: 3,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  acceptLabel: { fontSize: 7.5, color: C.gray, letterSpacing: 0.4, marginBottom: 3 },
  acceptValue: { fontSize: 10, fontWeight: 700, color: C.maroon },
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

export function EnrollmentConfirmationDocument({ data }: { data: EnrollmentConfirmationPdfData }) {
  const rows: Array<[string, string]> = [
    ["Student name", data.studentName],
    ["Guardian name", data.guardianName],
    ["Contact number", data.phone],
    ...(data.email ? [["Email", data.email] as [string, string]] : []),
    ["Preferred instrument", data.instrument],
    ["Branch", branchLabel(data.branch)],
  ];

  return (
    <Document title={`Enrollment — ${data.studentName}`}>
      <Page size="A5" style={st.page}>
        <View style={st.headerRow}>
          <View style={st.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            <Image src={LOGO} style={st.logo} />
            <View>
              <Text style={st.wordmark}>Swar Mangal™</Text>
              <Text style={st.wordmarkSub}>MUSIC ACADEMY</Text>
            </View>
          </View>
          <Text style={st.title}>ENROLLMENT</Text>
        </View>

        <View style={st.pill}>
          <Text style={st.pillText}>ENROLLMENT RECEIVED</Text>
        </View>

        <View style={st.card}>
          {rows.map(([label, value], i) => (
            <Row key={label} label={label} value={value} zebra={i % 2 === 1} last={i === rows.length - 1} />
          ))}
        </View>

        <View style={st.acceptBox}>
          <Text style={st.acceptLabel}>TERMS &amp; CONDITIONS</Text>
          <Text style={st.acceptValue}>Accepted on {niceDateTime(data.submittedAt)}</Text>
        </View>

        <View style={st.footer}>
          <Text style={st.footerBrand}>Swar Mangal™ Music Academy</Text>
          <Text style={st.footerText}>Branches: Goregaon | Kandivali · +91-9769419519 | +91-8169222089</Text>
        </View>
      </Page>
    </Document>
  );
}
