"use client";

import { strFromU8, unzipSync } from "fflate";

export type PresentationSlide = {
  title: string;
  bullets: string[];
  note?: string;
};

export type PresentationDeck = {
  title: string;
  subtitle?: string;
  slides: PresentationSlide[];
};

function slideNumber(path: string) {
  const match = path.match(/slide(\d+)\.xml$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function textFromXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const nodes = Array.from(document.getElementsByTagName("a:t"));

  return nodes
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function extractPptxText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const archive = unzipSync(bytes);
  const slidePaths = Object.keys(archive)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((left, right) => slideNumber(left) - slideNumber(right));

  if (!slidePaths.length) {
    throw new Error("Не удалось найти слайды внутри PPTX-файла.");
  }

  const slides = slidePaths.map((path, index) => {
    const xml = strFromU8(archive[path]);
    const text = textFromXml(xml);
    return `--- Слайд ${index + 1} ---\n${text || "[Слайд без извлечённого текста]"}`;
  });

  return slides.join("\n\n").slice(0, 70_000);
}

export async function buildPptx(deck: PresentationDeck) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "LIDIA AI";
  pptx.company = "LIDIA AI";
  pptx.subject = deck.subtitle || "Презентация, созданная LIDIA AI";
  pptx.title = deck.title;

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "070B14" };
  titleSlide.addText("LIDIA AI", {
    x: 0.8,
    y: 0.65,
    w: 2.2,
    h: 0.3,
    fontFace: "Arial",
    fontSize: 12,
    bold: true,
    color: "A78BFA",
    charSpacing: 1.6,
  });
  titleSlide.addText(deck.title, {
    x: 0.8,
    y: 2.0,
    w: 11.6,
    h: 1.5,
    fontFace: "Arial",
    fontSize: 32,
    bold: true,
    color: "F8FAFC",
    margin: 0,
    breakLine: false,
  });
  if (deck.subtitle) {
    titleSlide.addText(deck.subtitle, {
      x: 0.82,
      y: 3.65,
      w: 10.5,
      h: 0.8,
      fontFace: "Arial",
      fontSize: 17,
      color: "A5B4C8",
      margin: 0,
    });
  }
  titleSlide.addText("Создано с помощью LIDIA AI", {
    x: 0.82,
    y: 6.65,
    w: 4.0,
    h: 0.25,
    fontFace: "Arial",
    fontSize: 9,
    color: "64748B",
    margin: 0,
  });

  deck.slides.forEach((item, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: "070B14" };

    slide.addText(`0${index + 1}`.slice(-2), {
      x: 0.8,
      y: 0.55,
      w: 0.6,
      h: 0.3,
      fontFace: "Arial",
      fontSize: 11,
      bold: true,
      color: "818CF8",
      margin: 0,
    });

    slide.addText(item.title, {
      x: 0.8,
      y: 1.15,
      w: 11.6,
      h: 0.75,
      fontFace: "Arial",
      fontSize: 25,
      bold: true,
      color: "F8FAFC",
      margin: 0,
    });

    const bullets = item.bullets.length
      ? item.bullets
      : ["Добавьте ключевой тезис этого слайда."];

    const runs = bullets.map((bullet) => ({
      text: bullet,
      options: {
        bullet: { indent: 18 },
        breakLine: true,
      },
    }));

    slide.addText(runs, {
      x: 1.0,
      y: 2.25,
      w: 10.8,
      h: 3.8,
      fontFace: "Arial",
      fontSize: 18,
      color: "CBD5E1",
      breakLine: false,
      paraSpaceAfterPt: 15,
      margin: 0,
      valign: "top",
    });

    if (item.note) {
      slide.addNotes(item.note);
    }

    slide.addText("LIDIA AI", {
      x: 0.8,
      y: 6.75,
      w: 1.5,
      h: 0.2,
      fontFace: "Arial",
      fontSize: 8,
      bold: true,
      color: "475569",
      margin: 0,
    });
  });

  const result = await pptx.write({ outputType: "blob", compression: true });
  return result as Blob;
}
