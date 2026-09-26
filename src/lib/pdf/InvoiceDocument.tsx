import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { BRAND, branchLabel, indianAmount, styles } from "./shared";

export interface InvoiceOwner {
  name: string;
  title: string;
}

export interface InvoicePdfData {
  invoiceNo: string;
  invoiceDate: string;
  branch: string;
  className: string;
  amount: number;
  tenure: string;
  owner1: InvoiceOwner;
  owner2: InvoiceOwner;
}

const inv = StyleSheet.create({
  billedToLabel: {
    fontSize: 8.5,
    color: BRAND.gray,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  billedToValue: {
    fontSize: 11,
    color: BRAND.ink,
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND.goldTint,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: BRAND.border,
  },
  tableHeaderCell: {
    fontSize: 8.5,
    color: BRAND.gray,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: BRAND.border,
  },
  colDesc: { flex: 3 },
  colTenure: { flex: 1, textAlign: "center" },
  colAmount: { flex: 1, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  totalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginRight: 16,
  },
  totalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    color: BRAND.gold,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
    marginBottom: 20,
  },
  signBlock: { width: "45%" },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: BRAND.ink,
    marginBottom: 6,
    height: 28,
  },
  signName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
  },
  signTitle: {
    fontSize: 9,
    color: BRAND.gray,
  },
});

function SignatureBlock({ owner }: { owner: InvoiceOwner }) {
  return (
    <View style={inv.signBlock}>
      <View style={inv.signLine} />
      <Text style={inv.signName}>{owner.name || "Owner"}</Text>
      <Text style={inv.signTitle}>{owner.title || owner.name || "Owner"}</Text>
    </View>
  );
}

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document title={`Invoice ${data.invoiceNo}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <Text style={styles.academyName}>SWAR MANGAL</Text>
          <Text style={styles.academySub}>Music Academy</Text>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.docTitle}>SCHOOL INVOICE</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docNo}>{data.invoiceNo}</Text>
            <Text style={styles.docMeta}>{data.invoiceDate}</Text>
          </View>
        </View>

        <View style={[styles.card, { padding: 14, marginBottom: 18 }]}>
          <Text style={inv.billedToLabel}>BILLED TO</Text>
          <Text style={inv.billedToValue}>{data.className || "Music Classes"}</Text>
          <Text style={{ fontSize: 10, color: BRAND.gray }}>{branchLabel(data.branch)} branch</Text>
        </View>

        <View style={[styles.card, { marginBottom: 0 }]}>
          <View style={inv.tableHeader}>
            <Text style={[inv.tableHeaderCell, inv.colDesc]}>DESCRIPTION</Text>
            <Text style={[inv.tableHeaderCell, inv.colTenure]}>TENURE</Text>
            <Text style={[inv.tableHeaderCell, inv.colAmount]}>AMOUNT</Text>
          </View>
          <View style={inv.tableRow}>
            <Text style={[{ fontSize: 11 }, inv.colDesc]}>{data.className || "Music Classes"}</Text>
            <Text style={[{ fontSize: 11 }, inv.colTenure]}>{data.tenure || "—"}</Text>
            <Text style={[{ fontSize: 11, fontFamily: "Helvetica-Bold" }, inv.colAmount]}>
              {"₹"} {indianAmount(data.amount)}
            </Text>
          </View>
          <View style={inv.totalRow}>
            <Text style={inv.totalLabel}>TOTAL</Text>
            <Text style={inv.totalValue}>{"₹"} {indianAmount(data.amount)}</Text>
          </View>
        </View>

        <View style={inv.signRow}>
          <SignatureBlock owner={data.owner1} />
          <SignatureBlock owner={data.owner2} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Swar Mangal Music Academy</Text>
        </View>
      </Page>
    </Document>
  );
}
