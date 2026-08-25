import { NextResponse } from "next/server";
import { getCloudflareAiStatus } from "../../../lib/cloudflare-ai";

export async function GET() {
  return NextResponse.json(getCloudflareAiStatus(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
