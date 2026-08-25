import { NextResponse } from "next/server";

type SourceImage = {
  id: string;
  name: string;
  mimeType: string;
};

type ImagesResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
};

type OpenAIFile = {
  id?: string;
  bytes?: number;
  error?: {
    message?: string;
    code?: string;
  };
};

const ALLOWED_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);
const ALLOWED_QUALITIES = new Set(["low", "medium", "high"]);

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9а-яА-Я._-]+/g, "-").slice(0, 120) || "lidia-image.png";
}

function isSourceImage(value: unknown): value is SourceImage {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.mimeType === "string" &&
    item.mimeType.startsWith("image/")
  );
}

function marketplacePrompt(userPrompt: string) {
  const isMarketplace = /ozon|wildberries|вайлдберриз|маркетплейс|карточк[аи] товар/i.test(userPrompt);

  if (!isMarketplace) {
    return `Создайте профессиональный маркетинговый визуал высокого качества. Сохраняйте узнаваемость исходного товара, если он приложен. Не добавляйте недостоверные характеристики или обещания. Инструкция пользователя: ${userPrompt}`;
  }

  return `Создайте премиальную продающую карточку товара для маркетплейса Ozon/Wildberries на основе исходного товара, если он приложен. Товар должен оставаться визуально узнаваемым: не менять форму, упаковку, логотип и ключевые детали без прямой просьбы пользователя. Композиция должна быть чистой, современной, коммерческой, с ясным визуальным фокусом на товаре. Не придумывайте характеристики, скидки, сертификаты, цифры или преимущества, которых пользователь не сообщил. Не добавляйте мелкий нечитаемый текст. Если пользователь не попросил конкретный текст на изображении, лучше сделать визуал без текста. Инструкция пользователя: ${userPrompt}`;
}

function responseError(status: number, data: ImagesResponse) {
  const code = data.error?.code || data.error?.type || `http_${status}`;
  if (status === 401) return `OpenAI отклонил API-ключ (${code}).`;
  if (status === 403) return `У API-аккаунта нет доступа к генерации изображений (${code}).`;
  if (status === 429) {
    if (data.error?.code === "insufficient_quota") {
      return `Для генерации изображений нужен доступный баланс OpenAI API (${code}).`;
    }
    return `OpenAI временно ограничил генерацию изображений (${code}).`;
  }
  return `Не удалось создать изображение: OpenAI вернул ошибку ${status} (${code}).`;
}

async function uploadGeneratedImage(
  apiKey: string,
  blob: Blob,
  filename: string,
) {
  const form = new FormData();
  form.append("purpose", "vision");
  form.append("file", blob, filename);

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const data = (await response.json()) as OpenAIFile;
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "Generated image upload failed");
  }

  return { id: data.id, bytes: data.bytes ?? blob.size };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY не настроен." }, { status: 503 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const requestedSize = typeof input.size === "string" ? input.size : "";
  const requestedQuality = typeof input.quality === "string" ? input.quality : "";
  const sources = Array.isArray(input.sourceImages)
    ? input.sourceImages.filter(isSourceImage).slice(0, 1)
    : [];

  if (!prompt) {
    return NextResponse.json({ error: "Опишите, какое изображение нужно создать." }, { status: 400 });
  }

  if (prompt.length > 3_000) {
    return NextResponse.json({ error: "Описание изображения слишком длинное." }, { status: 413 });
  }

  const size = ALLOWED_SIZES.has(requestedSize)
    ? requestedSize
    : /ozon|wildberries|вайлдберриз|маркетплейс/i.test(prompt)
      ? "1024x1536"
      : "1024x1024";
  const quality = ALLOWED_QUALITIES.has(requestedQuality) ? requestedQuality : "medium";
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const enrichedPrompt = marketplacePrompt(prompt);

  try {
    let imageResponse: Response;

    if (sources.length) {
      const source = sources[0];
      const contentResponse = await fetch(
        `https://api.openai.com/v1/files/${encodeURIComponent(source.id)}/content`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      if (!contentResponse.ok) {
        return NextResponse.json(
          { error: "Не удалось прочитать исходное изображение для редактирования." },
          { status: 502 },
        );
      }

      const sourceBlob = await contentResponse.blob();
      const editForm = new FormData();
      editForm.append("model", model);
      editForm.append("prompt", enrichedPrompt);
      editForm.append("image", sourceBlob, safeFileName(source.name));
      editForm.append("size", size);
      editForm.append("quality", quality);
      editForm.append("output_format", "png");
      editForm.append("n", "1");

      imageResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: editForm,
      });
    } else {
      imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: enrichedPrompt,
          n: 1,
          size,
          quality,
          output_format: "png",
        }),
      });
    }

    const data = (await imageResponse.json()) as ImagesResponse;

    if (!imageResponse.ok) {
      console.error("OpenAI image API error", {
        status: imageResponse.status,
        model,
        code: data.error?.code,
        type: data.error?.type,
        message: data.error?.message,
      });
      return NextResponse.json(
        { error: responseError(imageResponse.status, data) },
        { status: 502 },
      );
    }

    const base64 = data.data?.[0]?.b64_json;
    if (!base64) {
      return NextResponse.json(
        { error: "OpenAI не вернул готовое изображение." },
        { status: 502 },
      );
    }

    const binary = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const blob = new Blob([binary], { type: "image/png" });
    const filename = safeFileName(`lidia-${Date.now()}.png`);
    const stored = await uploadGeneratedImage(apiKey, blob, filename);
    const params = new URLSearchParams({ name: filename, type: "image/png" });

    return NextResponse.json({
      reply: sources.length
        ? "Готово — я создала новый вариант на основе Вашего изображения. Его можно скачать или использовать как источник для следующей правки."
        : "Готово — я создала изображение по Вашему запросу. Его можно скачать или использовать как источник для следующей версии.",
      image: {
        id: stored.id,
        name: filename,
        mimeType: "image/png",
        size: stored.bytes,
        kind: "image",
        analyzable: true,
        generated: true,
        downloadUrl: `/api/files/${encodeURIComponent(stored.id)}?${params.toString()}&disposition=attachment`,
        previewUrl: `/api/files/${encodeURIComponent(stored.id)}?${params.toString()}&disposition=inline`,
      },
    });
  } catch (error) {
    console.error("Image generation route failed", error);
    return NextResponse.json(
      { error: "Ошибка соединения при создании изображения." },
      { status: 502 },
    );
  }
}
