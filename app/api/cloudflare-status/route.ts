import { NextResponse } from "next/server";

export async function GET() {
  const hasAccountId = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID);
  const hasAiToken = Boolean(process.env.CLOUDFLARE_AI_TOKEN);

  return NextResponse.json(
    {
      configured: hasAccountId && hasAiToken,
      accountId: hasAccountId,
      aiToken: hasAiToken,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
