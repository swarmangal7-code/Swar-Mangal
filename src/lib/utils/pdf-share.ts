// Shared by every "fetch a server-rendered PDF, then base64 it for a
// WhatsApp document send" flow (receipts, and now Timetable/Fee Rate Card
// export+share) — one implementation instead of copy-pasting the chunked
// btoa loop at each call site.
export async function fileToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch PDF (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
