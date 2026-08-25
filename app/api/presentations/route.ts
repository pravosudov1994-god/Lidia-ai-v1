import { NextResponse } from "next/server";
import { runCloudflareText } from "../../../lib/cloudflare-ai";

type PresentationSlide = {
  title: string;
  bullets: string[];
  note?: string;
};

type PresentationDeck = {
  title: string;
  subtitle?: string;
  slides: PresentationSlide[];
};

function normalizeDeck(value: unknown): PresentationDeck | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const subtitle = typeof input.subtitle === "string" ? input.subtitle.trim() : "";
  const rawSlides = Array.isArray(input.slides) ? input.slides : [];
  const slides: PresentationSlide[] = [];

  for (const slide of rawSlides) {
    if (!slide || typeof slide !== "object") continue;
    const item = slide as Record<string, unknown>;
    const slideTitle = typeof item.title === "string" ? item.title.trim() : "";
    const bullets = Array.isArray(item.bullets)
      ? item.bullets
          .filter((bullet): bullet is string => typeof bullet === "string")
          .map((bullet) => bullet.trim())
          .filter(Boolean)
          .slice(0, 7)
      : [];
    const note = typeof item.note === "string" ? item.note.trim() : "";

    if (!slideTitle) continue;

    slides.push(
      note
        ? { title: slideTitle, bullets, note }
        : { title: slideTitle, bullets },
    );

    if (slides.length >= 18) break;
  }

  if (!title || !slides.length) return null;

  return {
    title,
    subtitle: subtitle || undefined,
    slides,
  };
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || text.trim();

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) return null;

    try {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const mode = input.mode === "analyze" ? "analyze" : "create";
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const sourceText = typeof input.sourceText === "string" ? input.sourceText.slice(0, 70_000) : "";

  if (!prompt && !sourceText) {
    return NextResponse.json(
      { error: "Опишите задачу или прикрепите презентацию." },
      { status: 400 },
    );
  }

  try {
    if (mode === "analyze") {
      const reply = await runCloudflareText(
        `Задача пользователя: ${prompt || "Проанализируй презентацию и предложи улучшения."}\n\nТекст презентации:\n${sourceText || "Текст презентации не был извлечён."}`,
        {
          system:
            "Вы — Лидия AI, маркетинговый директор и редактор деловых презентаций. Отвечайте по-русски и на «Вы». Оцените структуру, логику, продающую силу, ясность оффера, доказательства, перегруз текста и последовательность слайдов. Не придумывайте данные, которых нет в исходнике. Дайте конкретные исправления и предложите новую структуру там, где это нужно.",
          maxTokens: 1800,
        },
      );

      return NextResponse.json({ reply });
    }

    const sourceInstruction = sourceText
      ? `\n\nНиже исходная презентация. Используйте её как материал и улучшите структуру, но не выдумывайте факты:\n${sourceText}`
      : "";

    const result = await runCloudflareText(
      `Создайте содержание профессиональной презентации по задаче пользователя: ${prompt || "Сделайте улучшенную версию приложенной презентации."}${sourceInstruction}\n\nВерните ТОЛЬКО валидный JSON без markdown в формате:\n{"title":"Название презентации","subtitle":"Короткий подзаголовок","slides":[{"title":"Заголовок слайда","bullets":["Короткий тезис 1","Короткий тезис 2"],"note":"Необязательная заметка докладчику"}]}\n\nТребования: 6–12 содержательных слайдов, максимум 5–6 коротких тезисов на слайд, один смысл на слайд, сильное начало и понятное завершение. Если данных не хватает, не придумывайте цифры. Для коммерческой презентации включите проблему, решение/ценность, доказательства, процесс/формат работы и следующий шаг.`,
      {
        system:
          "Вы — Лидия AI, сильный маркетинговый директор и архитектор презентаций. Создавайте логичные, лаконичные презентации для бизнеса. Строго возвращайте JSON, без пояснений вокруг него.",
        maxTokens: 2600,
      },
    );

    const parsed = extractJsonObject(result);
    const deck = normalizeDeck(parsed);

    if (!deck) {
      console.error("Cloudflare presentation JSON parse failed", result.slice(0, 1000));
      return NextResponse.json(
        { error: "Лидия подготовила структуру, но не удалось собрать PPTX. Попробуйте ещё раз." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      reply: `Готово — я подготовила структуру презентации «${deck.title}». Сейчас браузер соберёт настоящий файл PowerPoint (.pptx), который можно скачать.`,
      deck,
    });
  } catch (error) {
    console.error("Presentation route failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось обработать презентацию через Cloudflare AI.",
      },
      { status: 502 },
    );
  }
}
