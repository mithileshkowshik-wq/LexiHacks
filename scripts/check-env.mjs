import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../server/package.json", import.meta.url),
);
const { parse } = require("dotenv");
const file = fileURLToPath(new URL("../server/.env", import.meta.url));
let settings;
try {
  settings = parse(fs.readFileSync(file));
} catch {
  console.error(
    "Server settings file is missing or unreadable: project/server/.env",
  );
  process.exit(1);
}

const present = (name) => Boolean(settings[name]?.trim());
let needsAttention = false;
function report(label, ready, required = true) {
  console.log(
    `${label}: ${ready ? "configured" : required ? "MISSING" : "not configured (optional)"}`,
  );
  if (!ready && required) needsAttention = true;
}

console.log("LexiPath settings check (private values are never displayed)\n");
report("Database connection", present("MONGODB_URI"));
report("Login signing secret", present("JWT_SECRET"));
const mockAi = settings.USE_MOCK_AI
  ? settings.USE_MOCK_AI === "true"
  : !present("GEMINI_API_KEY");
console.log(
  `Writing analysis mode: ${mockAi ? "demo responses" : "live Gemini"}`,
);
report("Gemini key", present("GEMINI_API_KEY"), !mockAi);
const mockRecommendations = settings.RECOMMENDATION_USE_MOCKS !== "false";
console.log(
  `Recommendation mode: ${mockRecommendations ? "demo responses" : settings.KNOWLEDGE_STORAGE_PROVIDER === "mounted" ? "live Gemini + teaching folder/cloud bucket" : "live Gemini + Azure"}`,
);
if (!mockRecommendations) {
  report(
    "Recommendation Gemini key",
    present("GEMINI_RECOMMENDATION_API_KEY") || present("GEMINI_API_KEY"),
  );
  if (settings.KNOWLEDGE_STORAGE_PROVIDER === "mounted") {
    const server = fileURLToPath(new URL("../server/", import.meta.url));
    const root = settings.KNOWLEDGE_ROOT
      ? path.resolve(server, settings.KNOWLEDGE_ROOT)
      : null;
    report("Teaching resource folder", Boolean(root && fs.existsSync(root)));
    for (const manifest of [
      "gemini-canonical-markdown.jsonl",
      "blob-upload-manifest.json",
      "worksheet-sections.json",
    ]) {
      report(
        manifest,
        Boolean(root && fs.existsSync(path.join(root, "_manifests", manifest))),
      );
    }
  } else
    for (const name of [
      "AZURE_STORAGE_ACCOUNT_NAME",
      "AZURE_STORAGE_CONTAINER_NAME",
      "AZURE_STORAGE_SAS_TOKEN",
    ]) {
      report(name, present(name));
    }
}
report("Password-reset email service", present("RESEND_API_KEY"), false);
if (settings.PORT && settings.PORT !== "5000") {
  console.log(
    "Local shortcuts expect PORT=5000. Adjust it in server/.env before restarting.",
  );
  needsAttention = true;
}
if (settings.CLIENT_URL && settings.CLIENT_URL !== "http://localhost:5173") {
  console.log(
    "For local password-reset links, use CLIENT_URL=http://localhost:5173.",
  );
}
console.log("\nSave settings, then use Restart-LexiPath.cmd to load changes.");
console.log(
  "This checks configuration presence; it does not call external services.",
);
process.exitCode = needsAttention ? 1 : 0;
