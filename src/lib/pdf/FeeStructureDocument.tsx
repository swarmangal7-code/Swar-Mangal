import path from "path";
import { pathToFileURL } from "url";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { indianAmount, registerSchoolInvoiceFonts, SCHOOL_BRAND as C } from "./shared";

registerSchoolInvoiceFonts();

const ASSETS = path.join(process.cwd(), "public", "brand");
const LOGO = pathToFileURL(path.join(ASSETS, "logo-mark.png")).href;

export interface FeeRateCardPdfRow {
  instrument: string;
  name: string;
  feeAmount: number;
  billingPeriod: string;
  notes: string;
}

export interface FeeStructurePdfData {
  instruments: string[];
  generatedAt: string;
  rows: FeeRateCardPdfRow[];
}

// The bundled Inter subset has no ₹ glyph — same "Rs." fallback as every
// other generated document (receipts, invoices).
const rs = (v: number) => `Rs. ${indianAmount(v)}`;

const st = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Inter",
    fontSize: 9,
    color: C.ink,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.maroon,
    marginBottom: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 34, height: 34, marginRight: 10 },
  wordmark: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 17, color: C.maroon },
  title: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 20, color: "#161616" },
  subtitle: { fontSize: 8.5, color: C.gray, marginBottom: 14 },
  groupHeading: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: C.maroon,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 0,
    letterSpacing: 0.6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.cream,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tableHeaderCell: { fontSize: 7, fontWeight: 700, color: C.gray, letterSpacing: 0.4 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  rowZebra: { backgroundColor: C.cream },
  colName: { flex: 1.8 },
  colFee: { flex: 1.3, textAlign: "right" as const },
  colPeriod: { flex: 1, textAlign: "center" as const },
  colNotes: { flex: 2 },
  cell: { fontSize: 9, color: C.ink },
  feeCell: { fontSize: 9.5, fontWeight: 700, color: C.maroon },
  empty: { fontSize: 9, color: C.gray, marginTop: 24, textAlign: "center" as const },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: C.gray },
});

export function FeeStructureDocument({ data }: { data: FeeStructurePdfData }) {
  const byInstrument = new Map<string, FeeRateCardPdfRow[]>();
  for (const row of data.rows) {
    const list = byInstrument.get(row.instrument) ?? [];
    list.push(row);
    byInstrument.set(row.instrument, list);
  }
  const instrumentOrder = Array.from(byInstrument.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <Document title="Swar Mangal Fee Rate Card">
      <Page size="A4" style={st.page}>
        <View style={st.headerRow}>
          <View style={st.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            <Image src={LOGO} style={st.logo} />
            <Text style={st.wordmark}>Swar Mangal™</Text>
          </View>
          <Text style={st.title}>FEE RATE CARD</Text>
        </View>
        <Text style={st.subtitle}>
          {data.instruments.length ? `Instruments: ${data.instruments.join(", ")} · ` : ""}Generated {data.generatedAt}. Rates
          are indicative and may vary by enrolment — please confirm with the academy office.
        </Text>

        {data.rows.length === 0 ? (
          <Text style={st.empty}>No rate card rows match the selected instruments.</Text>
        ) : (
          instrumentOrder.map((instrument) => (
            <View key={instrument} wrap={false}>
              <Text style={st.groupHeading}>{instrument.toUpperCase()}</Text>
              <View style={st.tableHeader}>
                <Text style={[st.tableHeaderCell, st.colName]}>PLAN</Text>
                <Text style={[st.tableHeaderCell, st.colPeriod]}>BILLING</Text>
                <Text style={[st.tableHeaderCell, st.colFee]}>FEE</Text>
                <Text style={[st.tableHeaderCell, st.colNotes]}>NOTES</Text>
              </View>
              {(byInstrument.get(instrument) ?? []).map((row, i) => (
                <View key={i} style={[st.row, i % 2 === 1 ? st.rowZebra : {}]}>
                  <Text style={[st.cell, st.colName]}>{row.name || "—"}</Text>
                  <Text style={[st.cell, st.colPeriod]}>{row.billingPeriod || "Monthly"}</Text>
                  <Text style={[st.feeCell, st.colFee]}>{rs(row.feeAmount)}</Text>
                  <Text style={[st.cell, st.colNotes]}>{row.notes || "—"}</Text>
                </View>
              ))}
            </View>
          ))
        )}

        <View style={st.footer} fixed>
          <Text style={st.footerText}>Swar Mangal™ Music Academy · Branches: Goregaon | Kandivali</Text>
          <Text style={st.footerText}>+91-9769419519 | +91-8169222089</Text>
        </View>
      </Page>
    </Document>
  );
}
