import { geminiModel } from "@/lib/gemini";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    model: geminiModel(),
  });
}
