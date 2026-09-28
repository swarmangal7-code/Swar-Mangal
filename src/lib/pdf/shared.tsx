// Shared visual language for every generated PDF (receipts, invoices).
// Uses @react-pdf/renderer's built-in Helvetica — no font files to bundle or
// license-check, and it renders crisply at any size.
import { StyleSheet } from "@react-pdf/renderer";

export const BRAND = {
  gold: "#B8862E",
  goldTint: "#FBF3E7",
  ink: "#1A1A1A",
  gray: "#6B6B6B",
  border: "#D8D2C6",
};

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BRAND.ink,
  },
  headerBand: {
    backgroundColor: BRAND.gold,
    marginHorizontal: -40,
    marginTop: -40,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 40,
    marginBottom: 22,
    alignItems: "center",
  },
  academyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  academySub: {
    fontSize: 9,
    color: "#FFF3DF",
    marginTop: 2,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    color: BRAND.ink,
    letterSpacing: 0.5,
  },
  docNo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: BRAND.gold,
  },
  docMeta: {
    fontSize: 9,
    color: BRAND.gray,
    marginTop: 2,
  },
  card: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 4,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    width: 130,
    fontSize: 9,
    color: BRAND.gray,
  },
  value: {
    flex: 1,
    fontSize: 10.5,
    color: BRAND.ink,
  },
  amountBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: BRAND.goldTint,
    borderWidth: 1,
    borderColor: BRAND.gold,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 11,
    color: BRAND.ink,
  },
  amountValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: BRAND.gold,
  },
  amountWords: {
    fontSize: 9,
    fontFamily: "Helvetica-Oblique",
    color: BRAND.gray,
    marginBottom: 20,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 10,
    alignItems: "center",
  },
  footerText: {
    fontSize: 8.5,
    color: BRAND.gray,
  },
  footerBrand: {
    fontSize: 8.5,
    color: BRAND.gold,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
});

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

function threeDigitsToWords(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

/** 184500 -> "One Lakh Eighty-Four Thousand Five Hundred Rupees Only" (Indian numbering). */
export function amountInWords(value: number): string {
  const whole = Math.trunc(Math.abs(value));
  if (whole === 0) return "Zero Rupees Only";
  const crore = Math.floor(whole / 1e7);
  const lakh = Math.floor((whole % 1e7) / 1e5);
  const thousand = Math.floor((whole % 1e5) / 1e3);
  const hundred = whole % 1e3;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));
  return `${parts.join(" ")} Rupees Only`;
}

/** 184500 -> "1,84,500"; keeps paise only when non-zero. */
export function indianAmount(value: number): string {
  const whole = Math.trunc(value);
  const paise = Math.round((value - whole) * 100);
  const sign = value < 0 ? "-" : "";
  const digits = Math.abs(whole).toString();
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    let rest = digits.slice(0, -3);
    const parts: string[] = [];
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest) parts.unshift(rest);
    grouped = `${parts.join(",")},${last3}`;
  }
  return paise === 0 ? `${sign}${grouped}` : `${sign}${grouped}.${String(Math.abs(paise)).padStart(2, "0")}`;
}

export function branchLabel(raw: string): string {
  const v = (raw || "").toUpperCase();
  if (v.includes("GOR")) return "Goregaon";
  if (v.includes("KAN")) return "Kandivali";
  return raw || "—";
}
