// Shared visual language for every generated PDF (receipts, invoices).
// Uses @react-pdf/renderer's built-in Helvetica — no font files to bundle or
// license-check, and it renders crisply at any size.
import { StyleSheet } from "@react-pdf/renderer";

export const BRAND = {
  navy: "#161B33",
  navyDeep: "#0E1226",
  gold: "#B8862E",
  goldLight: "#D9AA53",
  goldTint: "#FBF3E7",
  ink: "#1A1A1A",
  gray: "#6B6B6B",
  border: "#D8D2C6",
  zebra: "#FAF8F3",
};

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BRAND.ink,
  },
  headerBand: {
    backgroundColor: BRAND.navy,
    marginHorizontal: -40,
    marginTop: -40,
    paddingTop: 26,
    paddingBottom: 22,
    paddingHorizontal: 40,
    marginBottom: 26,
    borderBottomWidth: 3,
    borderBottomColor: BRAND.gold,
    flexDirection: "row",
    alignItems: "center",
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.gold,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  logoBadgeText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    color: BRAND.navy,
    letterSpacing: 0.5,
  },
  academyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: 1.5,
  },
  academySub: {
    fontSize: 8.5,
    color: BRAND.goldLight,
    marginTop: 3,
    letterSpacing: 0.3,
  },
  watermark: {
    position: "absolute",
    top: "42%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 64,
    fontFamily: "Helvetica-Bold",
    color: "#EDE7D8",
    opacity: 0.55,
    letterSpacing: 4,
    transform: "rotate(-24deg)",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  docTitlePill: {
    alignSelf: "flex-start",
    backgroundColor: BRAND.navy,
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 1.5,
  },
  docNo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
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
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rowZebra: {
    backgroundColor: BRAND.zebra,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    width: 130,
    fontSize: 8,
    color: BRAND.gray,
    letterSpacing: 0.5,
  },
  value: {
    flex: 1,
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
  },
  amountBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: BRAND.goldTint,
    borderLeftWidth: 5,
    borderLeftColor: BRAND.gold,
    borderRadius: 3,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 9,
    color: BRAND.gray,
    letterSpacing: 0.5,
  },
  amountValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: BRAND.navy,
  },
  amountWords: {
    fontSize: 9,
    fontFamily: "Helvetica-Oblique",
    color: BRAND.gray,
    marginBottom: 20,
  },
  footer: {
    position: "absolute",
    bottom: -40,
    left: -40,
    right: -40,
    backgroundColor: BRAND.navy,
    borderTopWidth: 3,
    borderTopColor: BRAND.gold,
    paddingVertical: 12,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#B9BDD1",
  },
  footerBrand: {
    fontSize: 8.5,
    color: BRAND.goldLight,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
    letterSpacing: 0.5,
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
