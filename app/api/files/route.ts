import { NextResponse } from "next/server";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const ANALYZABLE_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "markdown",
  "html",
  "htm",
  "json",
  "csv",
  "tsv",
  "xls",
  "xlsx",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "rtf",
]);

type OpenAIFile = {
  id?: string;
  filename?: string;
  bytes?: number;
  purpose?: string;
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
};

function extensionOf(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

function safeFileName(name: string) {
  return name.replace(/[\r\n\0]/g, "").slice(0, 180) || "file";
}

function fileLinks(id: string, name: string, mimeType: string, isImage: boolean) {
  const params = new URLSearchParams({
    name,
    type: mimeType || "application/octet-stream",
  });

  return {
    downloadUrl: `/api/files/${encodeURIComponent(id)}?${params.toString()}&disposition=attachment`,
    previewUrl: isImage
      ? `/api/files/${encodeURIComponent(id)}?${params.toString()}&disposition=inline`
      : undefined,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "AI пока не настроен: отсутствует OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать файл." }, { status: 400 });
  }

  const value = formData.get("file");

  if (!(value instanceof File)) {
    return NextResponse.json({ error: "Файл не найден в запросе." }, { status: 400 });
  }

  if (value.size === 0) {
    return NextResponse.json({ error: "Нельзя загрузить пустой файл." }, { status: 400 });
  }

  if (value.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Для текущей версии максимальный размер одного файла — 20 МБ." },
      { status: 413 },
    );
  }

  const name = safeFileName(value.name);
  const mimeType = value.type || "application/octet-stream";
  const isImage = mimeType.startsWith("image/");
  const analyzable = isImage || ANALYZABLE_EXTENSIONS.has(extensionOf(name));

  const openAIForm = new FormData();
  openAIForm.append("purpose", isImage ? "vision" : "user_data");
  openAIForm.append("file", value, name);

  try {
    const response = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAIForm,
    });

    const data = (await response.json()) as OpenAIFile;

    if (!response.ok || !data.id) {
      console.error("OpenAI file upload failed", {
        status: response.status,
        code: data.error?.code,
        type: data.error?.type,
        message: data.error?.message,
      });

      return NextResponse.json(
        {
          error:
            response.status === 429
              ? "OpenAI сейчас ограничивает загрузки или на API нет доступного баланса."
              : "Не удалось загрузить файл в AI. Попробуйте ещё раз.",
        },
        { status: 502 },
      );
    }

    const links = fileLinks(data.id, name, mimeType, isImage);

    return NextResponse.json({
      file: {
        id: data.id,
        name,
        mimeType,
        size: data.bytes ?? value.size,
        kind: isImage ? "image" : "file",
        analyzable,
        ...links,
      },
    });
  } catch (error) {
    console.error("File upload route failed", error);
    return NextResponse.json(
      { error: "Ошибка соединения при загрузке файла." },
      { status: 502 },
    );
  }
}
