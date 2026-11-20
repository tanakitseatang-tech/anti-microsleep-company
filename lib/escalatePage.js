// Run the "driver did not respond" LINE check when a page is opened (covers a board that
// lost its connection right after the alarm). Never breaks the page.
import { headers } from "next/headers";
import { escalateOverdue } from "./escalate";

export async function escalateFromPage() {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    const proto = h.get("x-forwarded-proto") || "https";
    await escalateOverdue({ origin: host ? `${proto}://${host}` : "" });
  } catch (err) {
    console.error("LINE escalate (page) error:", err?.message);
  }
}
