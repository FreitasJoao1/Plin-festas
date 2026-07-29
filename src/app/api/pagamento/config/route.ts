import { NextResponse } from "next/server";
import { isInfinitePayConfigured } from "@/lib/infinitepay";

export async function GET() {
  return NextResponse.json({ available: isInfinitePayConfigured() });
}
