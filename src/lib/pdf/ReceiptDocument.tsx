import { Document, Page, Text, View } from "@react-pdf/renderer";
import { amountInWords, BRAND, branchLabel, indianAmount, styles } from "./shared";

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

function Row({ label, value, last, zebra }: { label: string; value: string; last?: boolean; zebra?: boolean }) {
  return (
    <View style={[styles.row, zebra ? styles.rowZebra : {}, last ? styles.rowLast : {}]}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

export function ReceiptDocument({ data }: { data: ReceiptPdfData }) {
  const period = data.feePeriodFrom
    ? data.feePeriodTo
      ? `${data.feePeriodFrom} to ${data.feePeriodTo}`
      : `from ${data.feePeriodFrom}`
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
      <Page size="A5" style={styles.page}>
        <Text style={styles.watermark}>{isVoid ? "VOID" : "PAID"}</Text>

        <View style={styles.headerBand}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>SM</Text>
          </View>
          <View>
            <Text style={styles.academyName}>SWAR MANGAL</Text>
            <Text style={styles.academySub}>MUSIC ACADEMY · {branchLabel(data.branch).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <View>
            <View style={styles.docTitlePill}>
              <Text style={styles.docTitle}>FEE RECEIPT</Text>
            </View>
            {isVoid && <Text style={{ fontSize: 9, color: "#B4231C", marginTop: 2 }}>VOID — excluded from totals</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docNo}>{data.receiptNo}</Text>
            <Text style={styles.docMeta}>{data.date}</Text>
          </View>
        </View>

        <View style={styles.card}>
          {rows.map(([label, value], i) => (
            <Row key={label} label={label} value={value} zebra={i % 2 === 1} last={i === rows.length - 1} />
          ))}
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>AMOUNT RECEIVED</Text>
          <Text style={styles.amountValue}>Rs. {indianAmount(data.amount)}</Text>
        </View>
        <Text style={styles.amountWords}>({amountInWords(data.amount)})</Text>

        <Text style={{ fontSize: 9, color: BRAND.gray, marginTop: 30 }}>Thank you for your payment.</Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>This is a computer-generated receipt and needs no signature.</Text>
          <Text style={styles.footerBrand}>SWAR MANGAL MUSIC ACADEMY</Text>
        </View>
      </Page>
    </Document>
  );
}
