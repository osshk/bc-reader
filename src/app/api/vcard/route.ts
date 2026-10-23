import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// iPhone path for Add to phone: a real https response with text/vcard
// makes iOS open its own contact screen (Create New Contact).
export function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("d") ?? "";
  return respond(d, req.nextUrl.searchParams.get("n") ?? "contact");
}

function respond(d: string, filename: string) {
  const name = filename.replace(/[^\w .-]/g, "").slice(0, 60) || "contact";
  if (!d || d.length > 2_000_000) return new Response("Bad request", { status: 400 });
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

// Multipart contacts use POST so a whole batch does not have to fit in a URL.
export async function POST(req: NextRequest) {
  const body = await req.text();
  if (body.length > 2_100_000) return new Response("Batch too large", { status: 413 });
  const fields = new URLSearchParams(body);
  return respond(fields.get("d") ?? "", fields.get("n") ?? "contacts");
}
