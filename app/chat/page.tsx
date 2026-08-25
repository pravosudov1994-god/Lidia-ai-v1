"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useState } from "react";

type Message = {
  role: "assistant" | "user";
  content: string;
};

const initialMessages: Message[] = [
  {
    role: "assistant",
    content:
      "Здравствуйте! Я Лидия — Ваш AI-маркетолог. Давайте сделаем быстрый разбор бизнеса и найдём точки роста.\n\nДля начала расскажите, пожалуйста: чем занимается Ваш бизнес и в каком городе или регионе Вы работаете?",
  },
];

const suggestions = [
  "У меня салон красоты",
  "Хочу больше клиентов",
  "Нужно улучшить рекламу",
  "Хочу увеличить продажи",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitMessage(value?: string) {
    const text = (value ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const conversation = [...messages, userMessage];

    setMessages(conversation);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
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

          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`chat-message-row ${message.role}`}
              >
                <div className="chat-bubble">{message.content}</div>
              </div>
            ))}

            {isLoading && (
              <div className="chat-message-row assistant">
                <div className="chat-bubble">Лидия анализирует ситуацию…</div>
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
                  onClick={() => void submitMessage(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: "0 20px 12px", color: "#ff9b9b" }}>
              {error}
            </div>
          )}

          <form className="chat-form" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Расскажите Лидии о своём бизнесе..."
              aria-label="Сообщение Лидии"
              disabled={isLoading}
            />
            <button
              className="chat-submit"
              type="submit"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? "Думаю…" : "Отправить →"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
