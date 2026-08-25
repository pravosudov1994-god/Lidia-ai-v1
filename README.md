# LIDIA AI

LIDIA AI — виртуальный AI-маркетолог для малого бизнеса.

Главная задача продукта: быстро разобрать бизнес пользователя, определить точки роста и предложить конкретные следующие шаги.

## MVP

- Премиальная главная страница LIDIA AI
- Отдельная страница `/chat`
- Текстовый AI-чат
- Бесплатный анализ изображений через Cloudflare Workers AI в пределах бесплатного дневного лимита
- Бесплатная генерация изображений через Cloudflare Workers AI в пределах бесплатного дневного лимита
- Локальное чтение `.pptx` в браузере без платного API
- Создание настоящих PowerPoint `.pptx` в браузере через PptxGenJS
- Анализ и проектирование презентаций через Cloudflare Workers AI
- Загрузка и скачивание файлов

## Стек

- Next.js + TypeScript
- React
- CSS
- Cloudflare Workers
- Cloudflare Workers AI
- OpenAI Responses API для общего текстового чата, пока не переведённого на Cloudflare AI
- `fflate` для чтения PPTX
- `pptxgenjs` для генерации PowerPoint

## Переменные окружения

### Cloudflare Workers AI

Для бесплатного AI-контура изображений и презентаций нужны:

```text
CLOUDFLARE_ACCOUNT_ID=<account id>
CLOUDFLARE_AI_TOKEN=<Workers AI API token>
```

Создайте Workers AI API Token в Cloudflare и храните его только как Secret. Не добавляйте токен в GitHub.

### OpenAI

Общий текстовый чат пока может использовать:

```text
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-5.4-mini
```

Реальные секреты никогда не коммитьте. Для локальной разработки используйте `.env.local`, а в Cloudflare — Runtime variables and secrets.

## Как работают бесплатные картинки

- Загруженные фото остаются в браузере и не требуют OpenAI Files API.
- Анализ фото идёт через Cloudflare Markdown Conversion + Workers AI.
- Генерация с нуля идёт через `@cf/black-forest-labs/flux-1-schnell`.
- Редактирование загруженной картинки идёт через `@cf/runwayml/stable-diffusion-v1-5-img2img`.

## Как работают презентации

- `.pptx` распаковывается прямо в браузере и из XML слайдов извлекается текст.
- Для анализа и структуры новой презентации используется Cloudflare Workers AI.
- Готовый `.pptx` собирается в браузере с помощью PptxGenJS и сразу доступен для скачивания.
- Для этого не нужен Microsoft PowerPoint на сервере и не нужен платный API создания презентаций.

## Локальный запуск

```bash
npm install
npm run dev
```

После запуска откройте `http://localhost:3000`, чат находится на `/chat`.

## Следующие этапы

- Перевести общий текстовый чат на Cloudflare AI как бесплатный fallback
- Подключить Cloudflare R2 для постоянного хранения пользовательских файлов
- Добавить лимиты, rate limiting и защиту от злоупотреблений
- Добавить историю проектов и библиотеку созданных материалов
