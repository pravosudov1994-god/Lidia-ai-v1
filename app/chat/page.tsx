"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

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

  function submitMessage(value?: string) {
    const text = (value ?? input).trim();
    if (!text) return;

    const nextUserMessage: Message = { role: "user", content: text };
    setMessages((current) => [
      ...current,
      nextUserMessage,
      {
        role: "assistant",
        content:
          "Отлично, я поняла направление. Следующий важный шаг — посмотреть на текущий поток клиентов и цифры. Скажите, пожалуйста: кто Ваш основной клиент, какой примерно средний чек и откуда сейчас чаще всего приходят новые обращения?",
      },
    ]);
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage();
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
          </div>

          {messages.length === 1 && (
            <div className="chat-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  className="suggestion-button"
                  key={suggestion}
                  type="button"
                  onClick={() => submitMessage(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form className="chat-form" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Расскажите Лидии о своём бизнесе..."
              aria-label="Сообщение Лидии"
            />
            <button className="chat-submit" type="submit" disabled={!input.trim()}>
              Отправить →
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
