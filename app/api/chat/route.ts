import { NextResponse } from "next/server";
import { LIDIA_SYSTEM_PROMPT } from "../../../lib/lidia-prompt";

type ChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "file";
  analyzable: boolean;
};

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
  attachments?: ChatAttachment[];
};

type OpenAIResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
    code?: string;
    type?: string;
    param?: string | null;
  };
};

function isAttachment(value: unknown): value is ChatAttachment {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.mimeType === "string" &&
    typeof item.size === "number" &&
    (item.kind === "image" || item.kind === "file") &&
    typeof item.analyzable === "boolean"
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "assistant" || message.role === "user") &&
    typeof message.content === "string" &&
    (message.attachments === undefined || Array.isArray(message.attachments))
  );
}

function extractText(response: OpenAIResponse) {
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function openAIErrorMessage(status: number, error?: OpenAIResponse["error"]) {
  const code = error?.code || error?.type || `http_${status}`;

  if (status === 401) {
    return `OpenAI отклонил API-ключ (${code}). Проверьте OPENAI_API_KEY или создайте новый ключ.`;
  }

  if (status === 403) {
    return `У API-аккаунта нет доступа к выбранной модели (${code}).`;
  }

  if (status === 429) {
    if (error?.code === "insufficient_quota") {
      return `На OpenAI API закончился баланс или не подключён биллинг (${code}).`;
    }
    return `OpenAI временно ограничил запросы (${code}). Попробуйте ещё раз через минуту.`;
  }

  if (status === 400) {
    return `OpenAI отклонил параметры запроса (${code}). Возможно, формат одного из вложений пока не поддерживается.`;
  }

  return `OpenAI вернул ошибку ${status} (${code}). Попробуйте ещё раз.`;
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  return {
    role: message.role,
    content: message.content.slice(0, 4_000),
    attachments: Array.isArray(message.attachments)
      ? message.attachments.filter(isAttachment).slice(0, 6)
      : undefined,
  };
}

function buildInput(messages: ChatMessage[]) {
  return messages.map((message) => {
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content,
      };
    }

    const attachments = message.attachments ?? [];
    const unsupported = attachments.filter((attachment) => !attachment.analyzable);
    const text = [
      message.content || "Пользователь отправил вложения без дополнительного текста.",
      unsupported.length
        ? `\nПримечание системы: приложены файлы, содержимое которых сейчас нельзя передать модели: ${unsupported.map((item) => item.name).join(", ")}. Не утверждайте, что прочитали их содержимое.`
        : "",
    ].join("");

    const content: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text,
      },
    ];

    for (const attachment of attachments) {
      if (!attachment.analyzable) continue;

      if (attachment.kind === "image") {
        content.push({
          type: "input_image",
          file_id: attachment.id,
          detail: "auto",
        });
      } else {
        content.push({
          type: "input_file",
          file_id: attachment.id,
        });
      }
    }

    return {
      role: "user",
      content,
    };
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "AI пока не настроен. Добавьте OPENAI_API_KEY в переменные окружения." },
      { status: 503 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  const rawMessages =
    body && typeof body === "object" && "messages" in body
      ? (body as { messages?: unknown }).messages
      : undefined;

  if (!Array.isArray(rawMessages)) {
    return NextResponse.json({ error: "Нужен массив messages." }, { status: 400 });
  }

  const messages = rawMessages
    .filter(isChatMessage)
    .slice(-20)
    .map(normalizeMessage);

  if (!messages.length) {
    return NextResponse.json({ error: "Диалог пуст." }, { status: 400 });
  }

  const hasUsefulInput = messages.some(
    (message) => message.content.trim() || (message.attachments?.length ?? 0) > 0,
  );

  if (!hasUsefulInput) {
    return NextResponse.json({ error: "Диалог пуст." }, { status: 400 });
  }

  const totalCharacters = messages.reduce(
    (sum, message) => sum + message.content.length,
    0,
  );

  if (totalCharacters > 16_000) {
    return NextResponse.json(
      { error: "Диалог слишком длинный. Начните новый разбор." },
      { status: 413 },
    );
  }

  try {
    const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: LIDIA_SYSTEM_PROMPT,
        input: buildInput(messages),
        max_output_tokens: 1400,
        store: false,
      }),
    });

    const data = (await openAIResponse.json()) as OpenAIResponse;

    if (!openAIResponse.ok) {
      console.error("OpenAI API error", {
        status: openAIResponse.status,
        model,
        code: data.error?.code,
        type: data.error?.type,
        param: data.error?.param,
        message: data.error?.message,
      });

      return NextResponse.json(
        { error: openAIErrorMessage(openAIResponse.status, data.error) },
        { status: 502 },
      );
    }

    const reply = extractText(data);

    if (!reply) {
      return NextResponse.json(
        { error: "Лидия не получила текстовый ответ. Попробуйте ещё раз." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { reply },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Chat route failed", error);
    return NextResponse.json(
      { error: "Ошибка соединения с AI. Попробуйте ещё раз." },
      { status: 502 },
    );
  }
}
