"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useRef,
  useState,
} from "react";
import {
  buildPptx,
  extractPptxText,
  type PresentationDeck,
} from "../../lib/presentation-client";

type Attachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "file";
  analyzable: boolean;
  downloadUrl: string;
  previewUrl?: string;
  generated?: boolean;
  local?: boolean;
  dataUrl?: string;
  extractedText?: string;
};

type Message = {
  role: "assistant" | "user";
  content: string;
  attachments?: Attachment[];
  generatedImages?: Attachment[];
};

type LoadingMode = "image" | "vision" | "presentation" | "chat" | null;

const initialMessages: Message[] = [
  {
    role: "assistant",
    content:
      "Здравствуйте! Я Лидия — Ваш AI-маркетолог. Давайте сделаем быстрый разбор бизнеса и найдём точки роста.\n\nВы можете прикреплять фотографии товаров и презентации PowerPoint. Я умею бесплатно анализировать изображения через Cloudflare AI, создавать новые визуалы, читать PPTX и собирать новые презентации для скачивания.\n\nДля начала расскажите, пожалуйста: чем занимается Ваш бизнес и в каком городе или регионе Вы работаете?",
  },
];

const suggestions = [
  "Разобрать мой бизнес",
  "Проанализируй фото товара",
  "Создай карточку товара для Ozon",
  "Создай презентацию для моего бизнеса",
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function wantsImageGeneration(text: string) {
  const normalized = text.toLowerCase();
  const action = /(созда|сгенер|сдела|нарис|подготов)/i;
  const visual = /(картин|изображ|баннер|креатив|карточк|визуал|облож|фото)/i;
  return (
    (action.test(normalized) && visual.test(normalized)) ||
    /(ozon|wildberries|вайлдберриз).*(карточк|картин|изображ|визуал)/i.test(normalized)
  );
}

function wantsPresentationGeneration(text: string) {
  return (
    /(созда|сгенер|сдела|подготов|собер|пересобер)/i.test(text) &&
    /(презентац|powerpoint|pptx|слайд)/i.test(text)
  );
}

function isPptxFile(file: File) {
  return (
    file.name.toLowerCase().endsWith(".pptx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Не удалось прочитать «${file.name}».`));
    reader.readAsDataURL(file);
  });
}

function presentationTextFromDeck(deck: PresentationDeck) {
  return [
    deck.title,
    deck.subtitle || "",
    ...deck.slides.map(
      (slide, index) =>
        `--- Слайд ${index + 1} ---\n${slide.title}\n${slide.bullets.join("\n")}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 70_000);
}

function safePresentationName(title: string) {
  const clean = title
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${clean || "LIDIA-presentation"}.pptx`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: File[]) {
    if (!files.length || isUploading) return;

    const availableSlots = Math.max(0, 6 - pendingAttachments.length);
    const selected = files.slice(0, availableSlots);

    if (!selected.length) {
      setError("К одному сообщению можно прикрепить до 6 файлов.");
      return;
    }

    setError("");
    setIsUploading(true);

    try {
      for (const file of selected) {
        if (file.size > 20 * 1024 * 1024) {
          setError(`Файл «${file.name}» больше 20 МБ и пока не может быть загружен.`);
          continue;
        }

        if (file.type.startsWith("image/")) {
          if (file.size > 10 * 1024 * 1024) {
            setError(`Фото «${file.name}» больше 10 МБ. Для AI-анализа выберите более лёгкую версию.`);
            continue;
          }

          const dataUrl = await readAsDataUrl(file);
          const downloadUrl = URL.createObjectURL(file);
          const attachment: Attachment = {
            id: `local-image-${crypto.randomUUID()}`,
            name: file.name,
            mimeType: file.type || "image/jpeg",
            size: file.size,
            kind: "image",
            analyzable: true,
            local: true,
            dataUrl,
            previewUrl: dataUrl,
            downloadUrl,
          };
          setPendingAttachments((current) => [...current, attachment]);
          continue;
        }

        if (isPptxFile(file)) {
          const extractedText = await extractPptxText(file);
          const downloadUrl = URL.createObjectURL(file);
          const attachment: Attachment = {
            id: `local-pptx-${crypto.randomUUID()}`,
            name: file.name,
            mimeType:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            size: file.size,
            kind: "file",
            analyzable: true,
            local: true,
            extractedText,
            downloadUrl,
          };
          setPendingAttachments((current) => [...current, attachment]);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/files", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as {
          file?: Attachment;
          error?: string;
        };

        if (!response.ok || !data.file) {
          throw new Error(data.error || `Не удалось загрузить «${file.name}».`);
        }

        setPendingAttachments((current) => [...current, data.file as Attachment]);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить файл.",
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    void uploadFiles(files);
  }

  function removePendingAttachment(attachment: Attachment) {
    setPendingAttachments((current) =>
      current.filter((item) => item.id !== attachment.id),
    );

    if (attachment.local) {
      if (attachment.downloadUrl.startsWith("blob:")) {
        URL.revokeObjectURL(attachment.downloadUrl);
      }
      return;
    }

    void fetch(`/api/files/${encodeURIComponent(attachment.id)}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }

  function reuseImage(attachment: Attachment) {
    if (pendingAttachments.some((item) => item.id === attachment.id)) return;
    setPendingAttachments((current) => [...current.slice(0, 5), attachment]);
    setInput("Сделай ещё один вариант на основе этой картинки: ");
  }

  function reusePresentation(attachment: Attachment) {
    if (pendingAttachments.some((item) => item.id === attachment.id)) return;
    setPendingAttachments((current) => [...current.slice(0, 5), attachment]);
    setInput("Пересобери эту презентацию и улучши её: ");
  }

  async function submitMessage(value?: string) {
    const text = (value ?? input).trim();
    if ((!text && !pendingAttachments.length) || isLoading || isUploading) return;

    const sentAttachments = pendingAttachments;
    const userMessage: Message = {
      role: "user",
      content: text,
      attachments: sentAttachments.length ? sentAttachments : undefined,
    };
    const conversation = [...messages, userMessage];

    const localImages = sentAttachments.filter(
      (attachment) => attachment.kind === "image" && attachment.dataUrl,
    );
    const presentation = sentAttachments.find(
      (attachment) => attachment.extractedText,
    );

    const mode: LoadingMode = wantsPresentationGeneration(text)
      ? "presentation"
      : wantsImageGeneration(text)
        ? "image"
        : presentation
          ? "presentation"
          : localImages.length
            ? "vision"
            : "chat";

    setMessages(conversation);
    setInput("");
    setPendingAttachments([]);
    setError("");
    setIsLoading(true);
    setLoadingMode(mode);

    try {
      if (wantsPresentationGeneration(text)) {
        const response = await fetch("/api/presentations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "create",
            prompt: text,
            sourceText: presentation?.extractedText || "",
          }),
        });

        const data = (await response.json()) as {
          reply?: string;
          deck?: PresentationDeck;
          error?: string;
        };

        if (!response.ok || !data.deck) {
          throw new Error(data.error || "Не удалось подготовить презентацию.");
        }

        const blob = await buildPptx(data.deck);
        const downloadUrl = URL.createObjectURL(blob);
        const filename = safePresentationName(data.deck.title);
        const generatedPresentation: Attachment = {
          id: `generated-pptx-${crypto.randomUUID()}`,
          name: filename,
          mimeType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          size: blob.size,
          kind: "file",
          analyzable: true,
          generated: true,
          local: true,
          extractedText: presentationTextFromDeck(data.deck),
          downloadUrl,
        };

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              data.reply || "Готово — презентация PowerPoint создана и готова к скачиванию.",
            attachments: [generatedPresentation],
          },
        ]);
      } else if (text && wantsImageGeneration(text)) {
        const recentImages = conversation
          .flatMap((message) => message.attachments ?? [])
          .filter(
            (attachment) =>
              attachment.kind === "image" && typeof attachment.dataUrl === "string",
          )
          .slice(-1);

        const response = await fetch("/api/images", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: text,
            sourceImages: recentImages.map((attachment) => ({
              name: attachment.name,
              mimeType: attachment.mimeType,
              dataUrl: attachment.dataUrl,
            })),
          }),
        });

        const data = (await response.json()) as {
          reply?: string;
          image?: Attachment;
          error?: string;
        };

        if (!response.ok || !data.image) {
          throw new Error(data.error || "Не удалось создать изображение.");
        }

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: data.reply || "Готово — изображение создано.",
            generatedImages: [data.image as Attachment],
          },
        ]);
      } else if (presentation?.extractedText) {
        const response = await fetch("/api/presentations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "analyze",
            prompt: text || "Проанализируй эту презентацию и предложи улучшения.",
            sourceText: presentation.extractedText,
          }),
        });

        const data = (await response.json()) as { reply?: string; error?: string };
        if (!response.ok || !data.reply) {
          throw new Error(data.error || "Не удалось проанализировать презентацию.");
        }

        setMessages((current) => [
          ...current,
          { role: "assistant", content: data.reply as string },
        ]);
      } else if (localImages.length) {
        const response = await fetch("/api/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text || "Проанализируй эти изображения с точки зрения маркетинга.",
            images: localImages.map((attachment) => ({
              name: attachment.name,
              mimeType: attachment.mimeType,
              dataUrl: attachment.dataUrl,
            })),
          }),
        });

        const data = (await response.json()) as { reply?: string; error?: string };
        if (!response.ok || !data.reply) {
          throw new Error(data.error || "Не удалось проанализировать изображение.");
        }

        setMessages((current) => [
          ...current,
          { role: "assistant", content: data.reply as string },
        ]);
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages: conversation }),
        });

        const data = (await response.json()) as {
          reply?: string;
          error?: string;
        };

        if (!response.ok || !data.reply) {
          throw new Error(data.error || "Не удалось получить ответ Лидии.");
        }

        setMessages((current) => [
          ...current,
          { role: "assistant", content: data.reply as string },
        ]);
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Не удалось получить ответ Лидии.";
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingMode(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  const loadingText =
    loadingMode === "image"
      ? "Лидия создаёт изображение через Cloudflare AI…"
      : loadingMode === "vision"
        ? "Лидия смотрит и анализирует изображение…"
        : loadingMode === "presentation"
          ? "Лидия работает с презентацией…"
          : "Лидия анализирует ситуацию…";

  return (
    <main className="chat-page">
      <header className="site-header">
        <div className="shell header-inner">
          <Link href="/" className="brand">
            <span className="brand-mark"><span>LI</span></span>
            <span>LIDIA AI</span>
          </Link>
          <Link href="/" className="back-link">← На главную</Link>
        </div>
      </header>

      <div className="chat-shell">
        <section className="chat-panel" aria-label="Чат с Лидией">
          <div className="chat-panel-head">
            <div className="ai-identity">
              <div className="avatar">Л</div>
              <div>
                <div className="ai-name">Лидия</div>
                <div className="ai-role">AI-маркетинговый директор</div>
              </div>
            </div>
            <div className="online">онлайн</div>
          </div>

          <div className="chat-capabilities">
            <span>🖼 Бесплатный анализ фото</span>
            <span>✨ Генерация изображений</span>
            <span>📊 Чтение и создание PPTX</span>
          </div>

          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`chat-message-row ${message.role}`}
              >
                <div className="message-stack">
                  {message.content && <div className="chat-bubble">{message.content}</div>}

                  {!!message.attachments?.length && (
                    <div className="message-attachments">
                      {message.attachments.map((attachment) => (
                        <div className="attachment-card" key={attachment.id}>
                          {attachment.kind === "image" && attachment.previewUrl ? (
                            <img
                              className="attachment-preview"
                              src={attachment.previewUrl}
                              alt={attachment.name}
                            />
                          ) : (
                            <div className="attachment-file-icon">
                              {attachment.name.toLowerCase().endsWith(".pptx") ? "📊" : "📄"}
                            </div>
                          )}
                          <div className="attachment-info">
                            <strong>{attachment.name}</strong>
                            <span>
                              {formatFileSize(attachment.size)}
                              {attachment.extractedText ? " · PPTX прочитан" : ""}
                              {!attachment.analyzable ? " · только хранение" : ""}
                            </span>
                          </div>
                          <div className="attachment-actions-group">
                            <a
                              className="attachment-action"
                              href={attachment.downloadUrl}
                              download={attachment.name}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Скачать
                            </a>
                            {attachment.generated && attachment.extractedText && (
                              <button
                                className="attachment-action attachment-action-button"
                                type="button"
                                onClick={() => reusePresentation(attachment)}
                              >
                                Доработать
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!!message.generatedImages?.length && (
                    <div className="generated-images">
                      {message.generatedImages.map((image) => (
                        <div className="generated-image-card" key={image.id}>
                          {image.previewUrl && (
                            <img src={image.previewUrl} alt="Изображение, созданное Лидией" />
                          )}
                          <div className="generated-image-actions">
                            <a
                              href={image.downloadUrl}
                              download={image.name}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ↓ Скачать изображение
                            </a>
                            <button type="button" onClick={() => reuseImage(image)}>
                              ✨ Доработать
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="chat-message-row assistant">
                <div className="chat-bubble">{loadingText}</div>
              </div>
            )}
          </div>

          {messages.length === 1 && !isLoading && (
            <div className="chat-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  className="suggestion-button"
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    if (suggestion.includes("Ozon")) {
                      setInput("Создай продающую карточку товара для Ozon на основе прикреплённого фото товара");
                      fileInputRef.current?.click();
                    } else if (suggestion.includes("фото")) {
                      setInput("Проанализируй это фото и скажи, что улучшить с точки зрения маркетинга");
                      fileInputRef.current?.click();
                    } else if (suggestion.includes("презентацию")) {
                      setInput("Создай презентацию для моего бизнеса на 8 слайдов");
                    } else {
                      void submitMessage(suggestion);
                    }
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="chat-error" role="alert">
              {error}
            </div>
          )}

          {!!pendingAttachments.length && (
            <div className="pending-attachments">
              {pendingAttachments.map((attachment) => (
                <div className="pending-attachment" key={attachment.id}>
                  {attachment.kind === "image" && attachment.previewUrl ? (
                    <img src={attachment.previewUrl} alt="" />
                  ) : (
                    <span className="pending-file-icon">
                      {attachment.name.toLowerCase().endsWith(".pptx") ? "📊" : "📄"}
                    </span>
                  )}
                  <div>
                    <strong>{attachment.name}</strong>
                    <span>
                      {formatFileSize(attachment.size)}
                      {attachment.extractedText ? " · готово к анализу" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Удалить ${attachment.name}`}
                    onClick={() => removePendingAttachment(attachment)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <form className="chat-form chat-form-enhanced" onSubmit={handleSubmit}>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              multiple
              accept="image/*,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json"
              onChange={handleFileInput}
            />

            <div className="chat-compose">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напишите Лидии или прикрепите фото / PPTX / файл..."
                aria-label="Сообщение Лидии"
                disabled={isLoading}
              />
              <div className="compose-tools">
                <button
                  className="attach-button"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isUploading}
                >
                  {isUploading ? "Обработка…" : "📎 Прикрепить"}
                </button>
                <button
                  className="image-action-button"
                  type="button"
                  onClick={() =>
                    setInput(
                      "Создай профессиональный маркетинговый визуал на основе прикреплённого изображения",
                    )
                  }
                  disabled={isLoading}
                >
                  ✨ Картинка
                </button>
                <button
                  className="presentation-action-button"
                  type="button"
                  onClick={() =>
                    setInput(
                      "Создай профессиональную презентацию для моего бизнеса на 8 слайдов",
                    )
                  }
                  disabled={isLoading}
                >
                  📊 Презентация
                </button>
              </div>
            </div>

            <button
              className="chat-submit"
              type="submit"
              disabled={
                (!input.trim() && !pendingAttachments.length) ||
                isLoading ||
                isUploading
              }
            >
              {isLoading ? "Думаю…" : "Отправить →"}
            </button>
          </form>
          <div className="chat-file-note">
            Фото и PPTX обрабатываются без OpenAI: изображения — через бесплатный лимит Cloudflare AI, презентации читаются локально в браузере
          </div>
        </section>
      </div>
    </main>
  );
}
