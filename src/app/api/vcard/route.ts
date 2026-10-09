import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// iPhone path for Add to phone: a real https response with text/vcard
// makes iOS open its own contact screen (Create New Contact).
export function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("d") ?? "";
  const name = (req.nextUrl.searchParams.get("n") ?? "contact").replace(/[^\w .-]/g, "").slice(0, 60) || "contact";
  if (!d || d.length > 60_000) return new Response("Bad request", { status: 400 });
  let vcf: string;
  try {
    vcf = Buffer.from(d, "base64url").toString("utf8");
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!vcf.startsWith("BEGIN:VCARD")) return new Response("Bad request", { status: 400 });
  return new Response(vcf, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${name}.vcf"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
