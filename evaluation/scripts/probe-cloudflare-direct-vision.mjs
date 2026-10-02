import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const PROMPT =
  "Transcribe exactly the first handwritten response line in this worksheet image. " +
  "Do not correct spelling, grammar, capitalisation, or punctuation. Ignore printed instructions and teacher markings. " +
  "Return only the handwritten line, with no quotation marks or explanation.";

function requireValue(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    options[value.slice(2)] = argv[index + 1];
    index += 1;
  }
  return options;
}

export function buildDirectVisionRequest(
  imageDataUrl,
  { imagePlacement = "message" } = {},
) {
  if (!imageDataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error("Cloudflare grounding probe requires a JPEG data URL");
  }

  if (!new Set(["message", "top-level"]).has(imagePlacement)) {
    throw new Error(`Unsupported image placement: ${imagePlacement}`);
  }

  const content = [{ type: "text", text: PROMPT }];
  if (imagePlacement === "message") {
    content.push({ type: "image_url", image_url: { url: imageDataUrl } });
  }

  return {
    messages: [
      {
        role: "user",
        content,
      },
    ],
    ...(imagePlacement === "top-level" ? { image: imageDataUrl } : {}),
    max_tokens: 128,
    temperature: 0,
  };
}

export function extractResponseText(body) {
  const response = body?.result?.response;
  if (typeof response === "string") return response;
  if (typeof body?.result === "string") return body.result;
  return "";
}

async function runProbe(options, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const sourcePath = path.resolve(requireValue(options.source, "--source"));
  const sampleId = requireValue(options["sample-id"], "--sample-id");
  const outputDirectory = path.resolve(
    options.output ||
      path.join("evaluation/debug-private/cloudflare-direct-vision", sampleId),
  );

  if (!/\.jpe?g$/i.test(sourcePath)) {
    throw new Error("The first grounding probe must use a JPEG worksheet");
  }

  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(path.resolve("evaluation/.env"));
  }
  const accountId = requireValue(
    process.env.CLOUDFLARE_ACCOUNT_ID,
    "CLOUDFLARE_ACCOUNT_ID",
  );
  const apiToken = requireValue(
    process.env.CLOUDFLARE_API_TOKEN,
    "CLOUDFLARE_API_TOKEN",
  );

  const image = await readFile(sourcePath);
  const imageDataUrl = `data:image/jpeg;base64,${image.toString("base64")}`;
  const imagePlacement = options["image-placement"] || "message";
  const body = buildDirectVisionRequest(imageDataUrl, { imagePlacement });
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`;
  const startedAt = new Date();

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "raw-request.json"),
      `${JSON.stringify(
        {
          endpoint,
          method: "POST",
          headers: {
            authorization: "Bearer [REDACTED]",
            "content-type": "application/json",
          },
          body,
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      path.join(outputDirectory, "request-structure.json"),
      `${JSON.stringify(
        {
          documentation:
            "https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/",
          endpoint,
          method: "POST",
          headers: {
            authorization: "Bearer [REDACTED]",
            "content-type": "application/json",
          },
          body: {
            ...body,
            ...(body.image
              ? { image: "data:image/jpeg;base64,[REDACTED]" }
              : {
                  messages: body.messages.map((message) => ({
                    ...message,
                    content: message.content.map((part) =>
                      part.type === "image_url"
                        ? {
                            ...part,
                            image_url: {
                              url: "data:image/jpeg;base64,[REDACTED]",
                            },
                          }
                        : part,
                    ),
                  })),
                }),
          },
          imageEvidence: {
            imagePlacement,
            sourcePath,
            mimeType: "image/jpeg",
            byteLength: image.length,
            sha256: createHash("sha256").update(image).digest("hex"),
            dataUrlPrefix: imageDataUrl.slice(0, 32),
          },
        },
        null,
        2,
      )}\n`,
    ),
  ]);

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const rawResponse = await response.text();
  const finishedAt = new Date();

  await writeFile(path.join(outputDirectory, "raw-response.txt"), rawResponse);
  await writeFile(
    path.join(outputDirectory, "response-metadata.json"),
    `${JSON.stringify(
      {
        sampleId,
        sourcePath,
        model: MODEL,
        endpoint,
        httpStatus: response.status,
        contentType: response.headers.get("content-type"),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        latencyMs: finishedAt.getTime() - startedAt.getTime(),
      },
      null,
      2,
    )}\n`,
  );

  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    parsed = null;
  }
  const extractedText = extractResponseText(parsed);
  await writeFile(
    path.join(outputDirectory, "probe-result.json"),
    `${JSON.stringify(
      {
        sampleId,
        sourcePath,
        model: MODEL,
        prompt: PROMPT,
        extractedText,
        clearlyImageGrounded: null,
        reviewerNote:
          "Inspect the worksheet and raw response. JSON validity alone is not evidence of image grounding.",
      },
      null,
      2,
    )}\n`,
  );

  if (!response.ok) {
    throw new Error(
      `Cloudflare returned HTTP ${response.status}; raw response saved to ${outputDirectory}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        sampleId,
        outputDirectory,
        httpStatus: response.status,
        extractedText,
      },
      null,
      2,
    ),
  );
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  await runProbe(parseArgs(process.argv.slice(2)));
}
