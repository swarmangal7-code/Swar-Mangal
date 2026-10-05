import path from "path";
import { pathToFileURL } from "url";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { registerSchoolInvoiceFonts, SCHOOL_BRAND as C } from "./shared";

registerSchoolInvoiceFonts();

// Same letterhead assets and brand as every other issued document (receipts,
// invoices) — one visual identity for everything the academy exports.
const ASSETS = path.join(process.cwd(), "public", "brand");
const LOGO = pathToFileURL(path.join(ASSETS, "logo-mark.png")).href;

export interface TimetablePdfRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  className: string;
  instrument: string;
  teacherName: string;
  branch: string;
  status: string;
}

export interface TimetablePdfData {
  branch: string;
  instruments: string[];
  generatedAt: string;
  rows: TimetablePdfRow[];
}

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function fmt12(time: string): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

function branchLabel(raw: string): string {
  const v = (raw || "").toUpperCase();
  if (v.includes("GOR")) return "Goregaon";
  if (v.includes("KAN")) return "Kandivali";
  return raw || "All branches";
}

const st = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Inter",
    fontSize: 8.5,
    color: C.ink,
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
  title: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 18, color: "#161616" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  metaLabel: { fontSize: 7, color: C.gray, letterSpacing: 0.4 },
  metaValue: { fontSize: 9, fontWeight: 700, color: C.ink, marginTop: 1 },
  dayHeading: {
    fontSize: 9,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: C.maroon,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 0.6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.cream,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableHeaderCell: { fontSize: 6.5, fontWeight: 700, color: C.gray, letterSpacing: 0.4 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  rowZebra: { backgroundColor: C.cream },
  cell: { fontSize: 8.5, color: C.ink },
  colTime: { flex: 1.3 },
  colClass: { flex: 1.6 },
  colInstrument: { flex: 1.3 },
  colTeacher: { flex: 1.5 },
  colBranch: { flex: 1 },
  colStatus: { flex: 0.9, textAlign: "right" as const },
  empty: { fontSize: 9, color: C.gray, marginTop: 20, textAlign: "center" as const },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 6.5, color: C.gray },
});

export function TimetableDocument({ data }: { data: TimetablePdfData }) {
  const byDay = new Map<number, TimetablePdfRow[]>();
  for (const row of data.rows) {
    const list = byDay.get(row.dayOfWeek) ?? [];
    list.push(row);
    byDay.set(row.dayOfWeek, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <Document title="Swar Mangal Timetable">
      <Page size="A4" style={st.page}>
        <View style={st.headerRow}>
          <View style={st.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            <Image src={LOGO} style={st.logo} />
            <Text style={st.wordmark}>Swar Mangal™</Text>
          </View>
          <Text style={st.title}>TIMETABLE</Text>
        </View>

        <View style={st.metaRow}>
          <View>
            <Text style={st.metaLabel}>BRANCH</Text>
            <Text style={st.metaValue}>{branchLabel(data.branch)}</Text>
          </View>
          <View>
            <Text style={st.metaLabel}>INSTRUMENTS</Text>
            <Text style={st.metaValue}>{data.instruments.length ? data.instruments.join(", ") : "All instruments"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={st.metaLabel}>GENERATED</Text>
            <Text style={st.metaValue}>{data.generatedAt}</Text>
          </View>
        </View>

        {data.rows.length === 0 ? (
          <Text style={st.empty}>No classes match the selected instruments.</Text>
        ) : (
          DAY_LABELS.map((label, dayIndex) => {
            const rows = byDay.get(dayIndex);
            if (!rows || !rows.length) return null;
            return (
              <View key={label} wrap={false}>
                <Text style={st.dayHeading}>{label.toUpperCase()}</Text>
                <View style={st.tableHeader}>
                  <Text style={[st.tableHeaderCell, st.colTime]}>TIME</Text>
                  <Text style={[st.tableHeaderCell, st.colClass]}>CLASS</Text>
                  <Text style={[st.tableHeaderCell, st.colInstrument]}>INSTRUMENT</Text>
                  <Text style={[st.tableHeaderCell, st.colTeacher]}>TEACHER</Text>
                  <Text style={[st.tableHeaderCell, st.colBranch]}>BRANCH</Text>
                  <Text style={[st.tableHeaderCell, st.colStatus]}>STATUS</Text>
                </View>
                {rows.map((row, i) => (
                  <View key={i} style={[st.row, i % 2 === 1 ? st.rowZebra : {}]}>
                    <Text style={[st.cell, st.colTime]}>
                      {fmt12(row.startTime)} – {fmt12(row.endTime)}
                    </Text>
                    <Text style={[st.cell, st.colClass]}>{row.className || "—"}</Text>
                    <Text style={[st.cell, st.colInstrument]}>{row.instrument || "—"}</Text>
                    <Text style={[st.cell, st.colTeacher]}>{row.teacherName || "—"}</Text>
                    <Text style={[st.cell, st.colBranch]}>{branchLabel(row.branch)}</Text>
                    <Text style={[st.cell, st.colStatus]}>{row.status === "ENABLED" ? "Active" : "Disabled"}</Text>
                  </View>
                ))}
              </View>
            );
          })
        )}

        <View style={st.footer} fixed>
          <Text style={st.footerText}>Swar Mangal™ Music Academy · Branches: Goregaon | Kandivali</Text>
          <Text style={st.footerText}>+91-9769419519 | +91-8169222089</Text>
        </View>
      </Page>
    </Document>
  );
}
