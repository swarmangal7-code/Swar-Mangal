import { Document, Page, Text, View } from "@react-pdf/renderer";
import { branchLabel, indianAmount, styles } from "./shared";

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

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last ? styles.rowLast : {}]}>
      <Text style={styles.label}>{label}</Text>
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

  return (
    <Document title={`Receipt ${data.receiptNo}`}>
      <Page size="A5" style={styles.page}>
        <View style={styles.headerBand}>
          <Text style={styles.academyName}>SWAR MANGAL</Text>
          <Text style={styles.academySub}>Music Academy · {branchLabel(data.branch)}</Text>
        </View>

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.docTitle}>FEE RECEIPT</Text>
            {isVoid && <Text style={{ fontSize: 9, color: "#B4231C", marginTop: 2 }}>VOID — excluded from totals</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docNo}>{data.receiptNo}</Text>
            <Text style={styles.docMeta}>{data.date}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row label="Received from" value={data.studentName} />
          <Row label="Student ID" value={data.studentId} />
          <Row label="Payment mode" value={data.paymentMode} />
          {data.reference ? <Row label="Reference / UTR" value={data.reference} /> : null}
          {period ? <Row label="Fee period" value={period} /> : null}
          <Row label="Status" value={isVoid ? "VOID" : "PAID"} last />
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount received</Text>
          <Text style={styles.amountValue}>{"₹"} {indianAmount(data.amount)}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>This is a computer-generated receipt and needs no signature.</Text>
          <Text style={styles.footerBrand}>Swar Mangal Music Academy</Text>
        </View>
      </Page>
    </Document>
  );
}
