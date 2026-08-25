"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useRef,
  useState,
} from "react";

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
};

type Message = {
  role: "assistant" | "user";
  content: string;
  attachments?: Attachment[];
  generatedImages?: Attachment[];
};

const initialMessages: Message[] = [
  {
    role: "assistant",
    content:
      "Здравствуйте! Я Лидия — Ваш AI-маркетолог. Давайте сделаем быстрый разбор бизнеса и найдём точки роста.\n\nВы можете не только писать мне, но и прикреплять фотографии товаров, PDF, документы, таблицы и другие файлы. Я могу анализировать поддерживаемые вложения и создавать маркетинговые изображения.\n\nДля начала расскажите, пожалуйста: чем занимается Ваш бизнес и в каком городе или регионе Вы работаете?",
  },
];

const suggestions = [
  "Разобрать мой бизнес",
  "Хочу больше клиентов",
  "Проанализируй мой файл",
  "Создай карточку товара для Ozon",
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    void fetch(`/api/files/${encodeURIComponent(attachment.id)}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }

  function reuseImage(attachment: Attachment) {
    if (pendingAttachments.some((item) => item.id === attachment.id)) return;
    setPendingAttachments((current) => [...current.slice(0, 5), attachment]);
    setInput("Сделай ещё один вариант на основе этой картинки: ");
  }

  async function submitMessage(value?: string) {
    const text = (value ?? input).trim();
    if ((!text && !pendingAttachments.length) || isLoading || isUploading) return;

    const userMessage: Message = {
      role: "user",
      content: text,
      attachments: pendingAttachments.length ? pendingAttachments : undefined,
    };
    const conversation = [...messages, userMessage];

    setMessages(conversation);
    setInput("");
    setPendingAttachments([]);
    setError("");
    setIsLoading(true);

    try {
      if (text && wantsImageGeneration(text)) {
        const recentImages = conversation
          .flatMap((message) => message.attachments ?? [])
          .filter((attachment) => attachment.kind === "image")
          .slice(-1);

        const response = await fetch("/api/images", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: text,
            sourceImages: recentImages,
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
            <span>📎 Файлы</span>
            <span>🖼 Анализ фото</span>
            <span>✨ Генерация изображений</span>
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
                            <div className="attachment-file-icon">📄</div>
                          )}
                          <div className="attachment-info">
                            <strong>{attachment.name}</strong>
                            <span>
                              {formatFileSize(attachment.size)}
                              {!attachment.analyzable ? " · только хранение" : ""}
                            </span>
                          </div>
                          <a
                            className="attachment-action"
                            href={attachment.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Скачать
                          </a>
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
                            <a href={image.downloadUrl} target="_blank" rel="noreferrer">
                              ↓ Скачать PNG
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
                <div className="chat-bubble">
                  {wantsImageGeneration(input) ? "Лидия создаёт изображение…" : "Лидия анализирует ситуацию…"}
                </div>
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
                    <span className="pending-file-icon">📄</span>
                  )}
                  <div>
                    <strong>{attachment.name}</strong>
                    <span>{formatFileSize(attachment.size)}</span>
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
              onChange={handleFileInput}
            />

            <div className="chat-compose">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напишите Лидии или прикрепите фото / файл..."
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
                  {isUploading ? "Загрузка…" : "📎 Прикрепить"}
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
                  ✨ Создать изображение
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
            До 6 файлов в сообщении · до 20 МБ каждый · изображения, PDF, документы, таблицы и другие форматы
          </div>
        </section>
      </div>
    </main>
  );
}
