import { NextResponse } from "next/server";

function cleanName(value: string | null) {
  return (value || "file").replace(/[\r\n\0]/g, "").slice(0, 180) || "file";
}

function encodedDisposition(name: string, disposition: "inline" | "attachment") {
  return `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY не настроен." }, { status: 503 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const name = cleanName(url.searchParams.get("name"));
  const mimeType = url.searchParams.get("type") || "application/octet-stream";
  const disposition =
    url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

  try {
    const upstream = await fetch(
      `https://api.openai.com/v1/files/${encodeURIComponent(id)}/content`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Файл недоступен или уже удалён." },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": encodedDisposition(name, disposition),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("File content proxy failed", error);
    return NextResponse.json({ error: "Не удалось скачать файл." }, { status: 502 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY не настроен." }, { status: 503 });
  }

  const { id } = await context.params;

  try {
    const upstream = await fetch(
      `https://api.openai.com/v1/files/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!upstream.ok && upstream.status !== 404) {
      return NextResponse.json({ error: "Не удалось удалить файл." }, { status: 502 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("File delete proxy failed", error);
    return NextResponse.json({ error: "Не удалось удалить файл." }, { status: 502 });
  }
}
