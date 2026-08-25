import Link from "next/link";

const features = [
  {
    icon: "01",
    title: "Анализ бизнеса",
    text: "Лидия помогает определить слабые места, ограничения роста и приоритетные зоны для улучшения.",
  },
  {
    icon: "02",
    title: "Стратегия продвижения",
    text: "Формирует понятный план действий: что делать сначала, какие каналы тестировать и какие цифры отслеживать.",
  },
  {
    icon: "03",
    title: "Поиск клиентов",
    text: "Помогает найти подходящие каналы привлечения и сформулировать предложения для вашей аудитории.",
  },
  {
    icon: "04",
    title: "Реклама",
    text: "Разбирает рекламные идеи, офферы, аудитории, бюджеты и логику тестирования кампаний.",
  },
  {
    icon: "05",
    title: "Контент",
    text: "Создаёт темы, структуры публикаций, рекламные тексты и контент-планы под конкретную задачу бизнеса.",
  },
  {
    icon: "06",
    title: "Рост продаж",
    text: "Ищет возможности повысить конверсию, повторные продажи и ценность каждого обращения.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="shell header-inner">
          <Link href="/" className="brand" aria-label="LIDIA AI — главная">
            <span className="brand-mark"><span>LI</span></span>
            <span>LIDIA AI</span>
          </Link>

          <nav className="nav" aria-label="Главная навигация">
            <a href="#capabilities">Возможности</a>
            <a href="#how">Как работает</a>
            <a href="#about">О Лидии</a>
          </nav>

          <Link href="/chat" className="button button-secondary">
            Начать анализ
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              AI-маркетолог для вашего бизнеса
            </div>

            <h1>
              У вас есть бизнес?
              <br />
              <span className="gradient-text">У Лидии есть идеи роста.</span>
            </h1>

            <p className="hero-copy">
              Получите персональный маркетинговый разбор. Лидия задаст несколько
              вопросов, проанализирует ситуацию и покажет точки роста, на которые
              стоит обратить внимание в первую очередь.
            </p>

            <div className="hero-actions">
              <Link href="/chat" className="button button-primary">
                Получить бесплатный разбор →
              </Link>
              <a href="#how" className="button button-secondary">
                Как это работает
              </a>
            </div>

            <div className="hero-note">
              Первый разбор — без регистрации. Обычно достаточно нескольких минут.
            </div>
          </div>

          <div className="ai-card" aria-label="Пример диалога с Лидией">
            <div className="ai-card-header">
              <div className="ai-identity">
                <div className="avatar">Л</div>
                <div>
                  <div className="ai-name">Лидия</div>
                  <div className="ai-role">AI-маркетинговый директор</div>
                </div>
              </div>
              <div className="online">онлайн</div>
            </div>

            <div className="ai-conversation">
              <div className="message message-ai">
                Здравствуйте! Я Лидия. Помогу разобрать Ваш бизнес и найти точки
                роста. Начнём с простого: чем занимается Ваш бизнес?
              </div>
              <div className="message message-user">
                У меня небольшая кофейня. Хочу увеличить поток новых клиентов.
              </div>
              <div className="message message-ai">
                Поняла. Сначала посмотрим на цифры и текущие каналы. В каком городе
                Вы работаете и откуда сейчас чаще всего приходят новые гости?
              </div>
              <div className="quick-chips">
                <span className="chip">Найти клиентов</span>
                <span className="chip">Разобрать рекламу</span>
                <span className="chip">Увеличить продажи</span>
              </div>
            </div>

            <Link href="/chat" className="chat-input-fake">
              <span>Напишите Лидии о своём бизнесе...</span>
              <span className="send-pill">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="capabilities">
        <div className="shell">
          <div className="section-label">Возможности</div>
          <h2>Не просто чат. Маркетолог, который думает вместе с Вами.</h2>
          <p className="section-intro">
            Лидия заточена под маркетинговые задачи бизнеса: от диагностики и
            позиционирования до рекламы, контента и повышения продаж.
          </p>

          <div className="cards-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="shell">
          <div className="section-label">Как это работает</div>
          <h2>От вопроса к конкретному плану действий.</h2>

          <div className="steps">
            <div className="step">
              <div className="step-number">ШАГ 01</div>
              <h3>Расскажите о бизнесе</h3>
              <p>
                Лидия уточняет нишу, продукт, аудиторию, регион, текущие каналы и
                главную задачу.
              </p>
            </div>
            <div className="step">
              <div className="step-number">ШАГ 02</div>
              <h3>Получите диагностику</h3>
              <p>
                Лидия анализирует предложение, привлечение, продажи, удержание и
                ключевые маркетинговые показатели.
              </p>
            </div>
            <div className="step">
              <div className="step-number">ШАГ 03</div>
              <h3>Определите точки роста</h3>
              <p>
                Вы получаете приоритетные гипотезы и следующие шаги, которые можно
                проверить на практике.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="about">
        <div className="shell">
          <div className="cta">
            <div className="section-label">LIDIA AI</div>
            <h2>Разберём Ваш бизнес прямо сейчас.</h2>
            <p>
              Ответьте на несколько вопросов. Лидия поможет увидеть ситуацию со
              стороны маркетингового директора и предложит направления для роста.
            </p>
            <Link href="/chat" className="button button-primary">
              Начать бесплатный анализ →
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="shell footer-inner">
          <div>© 2026 LIDIA AI</div>
          <div>AI-маркетолог для малого бизнеса</div>
        </div>
      </footer>
    </main>
  );
}
