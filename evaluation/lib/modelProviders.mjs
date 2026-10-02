function requireEnv(name, env) {
  const value = env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function stripCodeFence(text) {
  return String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

export function parseModelJson(value) {
  if (value && typeof value === "object") return value;
  return JSON.parse(stripCodeFence(value));
}

async function checkedJson(response) {
  const body = await response.json();
  if (!response.ok) {
    const message =
      body?.error?.message ||
      body?.errors?.[0]?.message ||
      `HTTP ${response.status}`;
    throw new Error(`Model request failed: ${message}`);
  }
  return body;
}

export async function invokeGemini({
  model,
  prompt,
  images,
  env,
  fetchImpl = fetch,
}) {
  const apiKey = requireEnv("GEMINI_API_KEY", env);
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...images.map((image) => ({
                inline_data: {
                  mime_type: image.mimeType,
                  data: image.data.toString("base64"),
                },
              })),
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(540000),
    },
  );
  const body = await checkedJson(response);
  return parseModelJson(body?.candidates?.[0]?.content?.parts?.[0]?.text);
}

export async function invokeOpenRouter({
  model,
  prompt,
  images,
  env,
  fetchImpl = fetch,
}) {
  const apiKey = requireEnv("OPENROUTER_API_KEY", env);
  const response = await fetchImpl(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "x-title": "LexiPath isolated evaluation",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...images.map((image) => ({
                type: "image_url",
                image_url: {
                  url: `data:${image.mimeType};base64,${image.data.toString("base64")}`,
                },
              })),
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(120000),
    },
  );
  const body = await checkedJson(response);
  const content = body?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part) => part?.text || part?.content || "").join("")
    : content;
  return parseModelJson(text);
}

export async function invokeCloudflare({
  model,
  prompt,
  images,
  env,
  fetchImpl = fetch,
}) {
  if (images.length !== 1) {
    throw new Error(
      "Cloudflare vision evaluation currently requires exactly one raster page",
    );
  }
  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN", env);
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID", env);
  const imageUrl = `data:${images[0].mimeType};base64,${images[0].data.toString("base64")}`;
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        authorization: "Bearer " + apiToken,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(120000),
    },
  );
  const body = await checkedJson(response);
  const content =
    body?.result?.response || body?.choices?.[0]?.message?.content;
  if (content && typeof content === "object") return content;
  return parseModelJson(content);
}

export const PROVIDERS = Object.freeze({
  gemini: invokeGemini,
  openrouter: invokeOpenRouter,
  cloudflare: invokeCloudflare,
});
