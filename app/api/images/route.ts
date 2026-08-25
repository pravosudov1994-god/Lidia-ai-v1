import { NextResponse } from "next/server";
import {
  arrayBufferToBase64,
  runCloudflareModel,
} from "../../../lib/cloudflare-ai";

type SourceImage = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

type CloudflareImageEnvelope = {
  success?: boolean;
  result?:
    | string
    | {
        image?: string;
      };
  errors?: Array<{
    code?: number;
    message?: string;
  }>;
};

function isSourceImage(value: unknown): value is SourceImage {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.name === "string" &&
    typeof item.mimeType === "string" &&
    item.mimeType.startsWith("image/") &&
    typeof item.dataUrl === "string" &&
    item.dataUrl.startsWith("data:image/")
  );
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9а-яА-Я._-]+/g, "-").slice(0, 120) || "lidia-image.jpg";
}

function stripDataUrl(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function marketplacePrompt(userPrompt: string) {
  const isMarketplace = /ozon|wildberries|вайлдберриз|маркетплейс|карточк[аи] товар/i.test(userPrompt);

  if (!isMarketplace) {
    return `Professional commercial marketing visual. Preserve the identity and recognizability of the source product when a reference image is supplied. Clean composition, realistic lighting, strong focal point, premium advertising quality. Do not invent labels, certifications, discounts, numeric claims, or product features. User request: ${userPrompt}`;
  }

  return `Create a premium marketplace product-card visual suitable for Ozon or Wildberries. Preserve the source product shape, package, logo and distinctive details when a reference is supplied. Make the product large and clearly readable, with clean commercial lighting, clear visual hierarchy and modern e-commerce styling. Do not invent benefits, prices, discounts, certificates, dimensions or claims that were not supplied by the user. Avoid tiny unreadable text; unless explicit copy is requested, prefer a visual without text. User request: ${userPrompt}`;
}

async function readCloudflareImage(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = (await response.json()) as CloudflareImageEnvelope;

    if (!response.ok || data.success === false) {
      const detail = data.errors?.map((item) => item.message).filter(Boolean).join("; ");
      throw new Error(detail || `Cloudflare AI вернул ошибку ${response.status}.`);
    }

    const result = data.result;
    const base64 =
      typeof result === "string"
        ? result
        : result && typeof result === "object"
          ? result.image
          : undefined;

    if (!base64) {
      throw new Error("Cloudflare AI не вернул изображение.");
    }

    return {
      base64,
      mimeType: "image/jpeg",
    };
  }

  if (!response.ok) {
    throw new Error(`Cloudflare AI вернул ошибку ${response.status}.`);
  }

  const buffer = await response.arrayBuffer();
  return {
    base64: arrayBufferToBase64(buffer),
    mimeType: contentType.startsWith("image/") ? contentType.split(";")[0] : "image/png",
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const sources = Array.isArray(input.sourceImages)
    ? input.sourceImages.filter(isSourceImage).slice(0, 1)
    : [];

  if (!prompt) {
    return NextResponse.json({ error: "Опишите, какое изображение нужно создать." }, { status: 400 });
  }

  if (prompt.length > 2_000) {
    return NextResponse.json({ error: "Описание изображения слишком длинное." }, { status: 413 });
  }

  if (sources.some((source) => source.dataUrl.length > 16_000_000)) {
    return NextResponse.json({ error: "Исходное изображение слишком большое." }, { status: 413 });
  }

  const enrichedPrompt = marketplacePrompt(prompt);

  try {
    let response: Response;

    if (sources.length) {
      response = await runCloudflareModel(
        "@cf/runwayml/stable-diffusion-v1-5-img2img",
        {
          prompt: enrichedPrompt,
          negative_prompt:
            "blurry, unreadable text, distorted packaging, duplicate product, deformed product, fake labels, watermark, low quality",
          image_b64: stripDataUrl(sources[0].dataUrl),
          num_steps: 20,
          strength: 0.58,
          guidance: 7.5,
        },
      );
    } else {
      response = await runCloudflareModel(
        "@cf/black-forest-labs/flux-1-schnell",
        {
          prompt: enrichedPrompt,
          steps: 6,
          seed: Math.floor(Math.random() * 2_147_483_647),
        },
      );
    }

    const generated = await readCloudflareImage(response);
    const extension = generated.mimeType.includes("png") ? "png" : "jpg";
    const filename = safeFileName(`lidia-${Date.now()}.${extension}`);
    const dataUrl = `data:${generated.mimeType};base64,${generated.base64}`;
    const approximateBytes = Math.floor((generated.base64.length * 3) / 4);

    return NextResponse.json({
      reply: sources.length
        ? "Готово — я создала новый вариант на основе Вашего изображения через бесплатный Cloudflare Workers AI. Его можно скачать и дорабатывать дальше."
        : "Готово — я создала изображение через Cloudflare Workers AI. Его можно скачать и использовать в следующей итерации.",
      image: {
        id: `cf-image-${Date.now()}`,
        name: filename,
        mimeType: generated.mimeType,
        size: approximateBytes,
        kind: "image",
        analyzable: true,
        generated: true,
        local: true,
        dataUrl,
        downloadUrl: dataUrl,
        previewUrl: dataUrl,
      },
    });
  } catch (error) {
    console.error("Cloudflare image generation route failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось создать изображение через Cloudflare AI.",
      },
      { status: 502 },
    );
  }
}
