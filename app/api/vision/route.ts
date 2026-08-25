import { NextResponse } from "next/server";
import {
  cloudflareToMarkdown,
  dataUrlToBlob,
  runCloudflareText,
} from "../../../lib/cloudflare-ai";

type ImageInput = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

function isImageInput(value: unknown): value is ImageInput {
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

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const images = Array.isArray(input.images)
    ? input.images.filter(isImageInput).slice(0, 3)
    : [];

  if (!images.length) {
    return NextResponse.json({ error: "Прикрепите хотя бы одно изображение." }, { status: 400 });
  }

  if (images.some((image) => image.dataUrl.length > 16_000_000)) {
    return NextResponse.json({ error: "Одно из изображений слишком большое." }, { status: 413 });
  }

  try {
    const descriptions: string[] = [];

    for (const image of images) {
      const blob = dataUrlToBlob(image.dataUrl);
      const markdown = await cloudflareToMarkdown(blob, image.name);
      descriptions.push(`Файл: ${image.name}\n${markdown.slice(0, 12_000)}`);
    }

    const userTask = prompt || "Проанализируй прикреплённые изображения с точки зрения маркетинга и продаж.";
    const reply = await runCloudflareText(
      `Задача пользователя: ${userTask}\n\nОписание изображений, полученное системой компьютерного зрения:\n\n${descriptions.join("\n\n---\n\n")}`,
      {
        system:
          "Вы — Лидия AI, сильный маркетинговый директор. Отвечайте по-русски, обращайтесь на «Вы». Анализируйте только то, что подтверждается описанием изображения. Не придумывайте характеристики товара, цены, сертификаты, скидки или факты, которых нет. Если это товар или карточка маркетплейса, оцените визуальную иерархию, понятность оффера, доверие, композицию, читаемость и то, что стоит протестировать. Давайте конкретные рекомендации и приоритеты.",
        maxTokens: 1500,
      },
    );

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Cloudflare vision route failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось проанализировать изображение через Cloudflare AI.",
      },
      { status: 502 },
    );
  }
}
