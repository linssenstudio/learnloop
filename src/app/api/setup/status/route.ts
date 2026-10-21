import { NextResponse } from "next/server";
import { setupStatus } from "@/lib/setup";

export async function GET() {
  return NextResponse.json(setupStatus());
}
