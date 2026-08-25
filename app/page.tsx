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
  {
    icon: "07",
    title: "Файлы и изображения",
    text: "Прикрепляйте фотографии, PDF, документы, таблицы и прайсы. Лидия использует поддерживаемые вложения в маркетинговом анализе.",
  },
  {
    icon: "08",
    title: "Создание визуалов",
    text: "Создавайте рекламные изображения и карточки товаров для маркетплейсов, в том числе новые варианты на основе фотографии товара.",
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
              Общайтесь с AI-маркетологом, прикладывайте фотографии товаров,
              документы, таблицы и другие материалы. Лидия поможет разобрать
              ситуацию, найти точки роста и подготовить маркетинговые решения —
              вплоть до новых рекламных визуалов.
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
              Первый разбор — без регистрации. В чат можно прикреплять файлы и изображения.
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
                Здравствуйте! Я Лидия. Можете рассказать о бизнесе или прикрепить
                материал для анализа — фото товара, документ, таблицу или PDF.
              </div>
              <div className="message message-user">
                Хочу сделать сильную карточку товара для Ozon. У меня есть фото товара.
              </div>
              <div className="message message-ai">
                Прикрепите фотографию. Я помогу оценить исходник и подготовить новый
                маркетинговый визуал, не придумывая характеристик товара.
              </div>
              <div className="quick-chips">
                <span className="chip">📎 Анализ файла</span>
                <span className="chip">🖼 Анализ фото</span>
                <span className="chip">✨ Создать визуал</span>
              </div>
            </div>

            <Link href="/chat" className="chat-input-fake">
              <span>Напишите Лидии или прикрепите файл...</span>
              <span className="send-pill">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="capabilities">
        <div className="shell">
          <div className="section-label">Возможности</div>
          <h2>Не просто чат. Рабочий AI-маркетолог для Вашего бизнеса.</h2>
          <p className="section-intro">
            Лидия заточена под маркетинговые задачи: диагностика бизнеса,
            позиционирование, реклама, контент, работа с файлами и создание визуалов.
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
          <h2>От вопроса или файла — к конкретному маркетинговому решению.</h2>

          <div className="steps">
            <div className="step">
              <div className="step-number">ШАГ 01</div>
              <h3>Поставьте задачу</h3>
              <p>
                Расскажите о бизнесе или приложите фотографию, PDF, документ,
                таблицу, прайс или другой материал.
              </p>
            </div>
            <div className="step">
              <div className="step-number">ШАГ 02</div>
              <h3>Получите анализ</h3>
              <p>
                Лидия анализирует доступные данные, предложение, привлечение,
                продажи и материалы, которые Вы передали.
              </p>
            </div>
            <div className="step">
              <div className="step-number">ШАГ 03</div>
              <h3>Получите результат</h3>
              <p>
                Это может быть план действий, рекламная идея, разбор файла или
                готовое изображение, которое можно скачать и доработать дальше.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="about">
        <div className="shell">
          <div className="cta">
            <div className="section-label">LIDIA AI</div>
            <h2>Поставьте Лидии реальную маркетинговую задачу.</h2>
            <p>
              Опишите ситуацию, приложите материалы и получите анализ или готовый
              маркетинговый результат прямо в диалоге.
            </p>
            <Link href="/chat" className="button button-primary">
              Открыть LIDIA AI →
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="shell footer-inner">
          <div>© 2026 LIDIA AI</div>
          <div>AI-маркетолог для бизнеса</div>
        </div>
      </footer>
    </main>
  );
}
