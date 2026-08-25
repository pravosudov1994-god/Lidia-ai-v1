type CloudflareEnvelope<T = unknown> = {
  result?: T;
  success?: boolean;
  errors?: Array<{
    code?: number;
    message?: string;
  }>;
  messages?: unknown[];
};

export type CloudflareTextResult = {
  response?: string;
};

export function getCloudflareAiConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AI_TOKEN;

  if (!accountId || !token) {
    return null;
  }

  return { accountId, token };
}

export function cloudflareAiNotConfiguredMessage() {
  return "Бесплатный Cloudflare AI пока не настроен. Добавьте CLOUDFLARE_ACCOUNT_ID и CLOUDFLARE_AI_TOKEN в Cloudflare Secrets.";
}

export async function runCloudflareModel(
  model: string,
  input: Record<string, unknown>,
) {
  const config = getCloudflareAiConfig();

  if (!config) {
    throw new Error(cloudflareAiNotConfiguredMessage());
  }

  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function runCloudflareText(
  prompt: string,
  options?: {
    system?: string;
    model?: string;
    maxTokens?: number;
  },
) {
  const model = options?.model || "@cf/zai-org/glm-4.7-flash";
  const response = await runCloudflareModel(model, {
    messages: [
      ...(options?.system
        ? [{ role: "system", content: options.system }]
        : []),
      { role: "user", content: prompt },
    ],
    max_tokens: options?.maxTokens ?? 1400,
  });

  const data = (await response.json().catch(() => null)) as
    | CloudflareEnvelope<CloudflareTextResult | string>
    | null;

  if (!response.ok || !data?.success) {
    const message =
      data?.errors?.map((item) => item.message).filter(Boolean).join("; ") ||
      `Cloudflare AI вернул ошибку ${response.status}.`;
    throw new Error(message);
  }

  const result = data.result;
  const text =
    typeof result === "string"
      ? result
      : result && typeof result === "object" && "response" in result
        ? String(result.response || "")
        : "";

  if (!text.trim()) {
    throw new Error("Cloudflare AI не вернул текстовый ответ.");
  }

  return text.trim();
}

export async function cloudflareToMarkdown(file: File | Blob, name: string) {
  const config = getCloudflareAiConfig();

  if (!config) {
    throw new Error(cloudflareAiNotConfiguredMessage());
  }

  const form = new FormData();
  form.append("files", file, name);
  form.append(
    "conversionOptions",
    JSON.stringify({
      output: { format: "markdown" },
    }),
  );

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/tomarkdown`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      body: form,
    },
  );

  const data = (await response.json().catch(() => null)) as
    | CloudflareEnvelope<
        Array<{
          name?: string;
          format?: string;
          data?: string;
          error?: string;
        }>
      >
    | null;

  if (!response.ok || !data?.success) {
    const message =
      data?.errors?.map((item) => item.message).filter(Boolean).join("; ") ||
      `Cloudflare не смог прочитать файл (${response.status}).`;
    throw new Error(message);
  }

  const first = Array.isArray(data.result) ? data.result[0] : undefined;
  if (!first || first.format === "error" || !first.data) {
    throw new Error(first?.error || "Не удалось извлечь содержимое файла.");
  }

  return first.data;
}

export function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) throw new Error("Некорректное изображение.");

  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new Blob([bytes], { type: mimeType });
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;

  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }

  return btoa(binary);
}
