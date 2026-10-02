// Unit tests for the Error Classification Engine.
// Run with: npm test  (see package.json - runs `node --test`)
//
// These exercise the pure classification logic (mock analysis, validation,
// confidence-threshold flagging, failure messaging) directly, without a
// database connection. runAnalysis() itself touches Mongoose/Sample and is
// left to integration testing once the upload endpoint (Person 2) exists.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  analyseSample,
  validateAnalysisResult,
  isUncertain,
  getConfidenceThreshold,
  describeFailure,
  group,
  TimeoutError,
  CONFIDENCE_THRESHOLD_DEFAULT,
  __testing,
} from "./errorClassificationEngine.js";
import { ERROR_CATEGORIES } from "../models/sample.js";

// Internals that are not part of the module's public API - see the
// __testing export in errorClassificationEngine.js.
const { callModelWithRetry, buildPrompt, mimeTypeFor } = __testing;

// A sample is now `pages: [{ imagePath, originalFilename }]`, not a single
// imagePath - this builds the one-page case tests mostly need.
function onePageSample(imagePath, overrides = {}) {
  return {
    pages: [{ imagePath, originalFilename: "" }],
    taskType: "ESSAY",
    ...overrides,
  };
}

describe("analyseSample (mock mode)", () => {
  test("returns one error per fixed category with valid fields", async () => {
    const sample = onePageSample("uploads/sample-1.png");
    const report = await analyseSample(sample);

    assert.equal(typeof report.illegibleNote, "string");
    assert.ok(Array.isArray(report.errors));
    assert.ok(report.errors.length > 0);

    // The fixture promises downstream slices an example of every category.
    const covered = new Set(report.errors.map((e) => e.category));
    for (const category of ERROR_CATEGORIES) {
      assert.ok(covered.has(category), `fixture missing an example of "${category}"`);
    }

    for (const detectedError of report.errors) {
      assert.ok(ERROR_CATEGORIES.includes(detectedError.category), `unexpected category: ${detectedError.category}`);
      assert.equal(typeof detectedError.written, "string");
      assert.notEqual(detectedError.written.trim(), "");
      assert.equal(typeof detectedError.confidenceScore, "number");
      assert.ok(detectedError.confidenceScore >= 0 && detectedError.confidenceScore <= 1);
      assert.equal(detectedError.dismissed, false);
      assert.equal(detectedError.locationOnScan.page, 0, "a one-page sample should only ever report page 0");
      for (const key of ["x", "y", "z", "w"]) {
        assert.equal(typeof detectedError.locationOnScan[key], "number");
        assert.ok(detectedError.locationOnScan[key] >= 0 && detectedError.locationOnScan[key] <= 1);
      }
    }
  });

  test("includes at least one below-threshold error for the uncertain UI state", async () => {
    const sample = onePageSample("uploads/sample-1.png");
    const report = await analyseSample(sample);

    const uncertainErrors = report.errors.filter((detectedError) => isUncertain(detectedError));
    assert.ok(uncertainErrors.length > 0, "expected at least one error below the confidence threshold");
  });

  test("simulates a corrupt/unreadable file when imagePath contains 'corrupt'", async () => {
    const sample = onePageSample("uploads/corrupt-scan.png");
    await assert.rejects(() => analyseSample(sample), /Could not read the uploaded image/);
  });

  test("spreads errors across every page of a multi-page sample", async () => {
    const sample = {
      pages: [
        { imagePath: "uploads/page-0.png", originalFilename: "" },
        { imagePath: "uploads/page-1.png", originalFilename: "" },
        { imagePath: "uploads/page-2.png", originalFilename: "" },
      ],
      taskType: "ESSAY",
    };
    const report = await analyseSample(sample);

    const pagesSeen = new Set(report.errors.map((e) => e.locationOnScan.page));
    assert.ok(pagesSeen.has(0) && pagesSeen.has(1) && pagesSeen.has(2), "expected errors on every page, not just page 0");
    for (const detectedError of report.errors) {
      const page = detectedError.locationOnScan.page;
      assert.ok(Number.isInteger(page) && page >= 0 && page < 3, `page ${page} is out of range for a 3-page sample`);
    }
  });

  test("finds a corrupt page even when it isn't the first page", async () => {
    const sample = {
      pages: [
        { imagePath: "uploads/page-0.png", originalFilename: "" },
        { imagePath: "uploads/corrupt-page.png", originalFilename: "" },
      ],
      taskType: "ESSAY",
    };
    await assert.rejects(() => analyseSample(sample), /Could not read the uploaded image at "uploads\/corrupt-page\.png"/);
  });
});

describe("validateAnalysisResult", () => {
  const validResult = {
    illegibleNote: "",
    errors: [
      {
        written: "teh",
        intended: "the",
        category: "orthographic",
        confidenceScore: 0.9,
        note: "Transposed letters.",
        locationOnScan: { page: 0, x: 0.1, y: 0.1, z: 0.05, w: 0.05 },
      },
    ],
  };

  test("accepts a well-formed result", () => {
    assert.doesNotThrow(() => validateAnalysisResult(validResult));
  });

  test("rejects an unknown category", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].category = "not-a-real-category";
    assert.throws(() => validateAnalysisResult(bad), /category/);
  });

  test("rejects an out-of-range confidenceScore", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].confidenceScore = 1.5;
    assert.throws(() => validateAnalysisResult(bad), /confidenceScore/);
  });

  test("rejects an out-of-range locationOnScan", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].locationOnScan.x = 2;
    assert.throws(() => validateAnalysisResult(bad), /locationOnScan/);
  });

  test("rejects a missing written field", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].written = "";
    assert.throws(() => validateAnalysisResult(bad), /written/);
  });

  test("rejects a non-array errors field", () => {
    const bad = { illegibleNote: "", errors: "not an array" };
    assert.throws(() => validateAnalysisResult(bad), /errors must be an array/);
  });

  test("rejects a non-integer page", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].locationOnScan.page = 1.5;
    assert.throws(() => validateAnalysisResult(bad), /page/);
  });

  test("rejects a negative page", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].locationOnScan.page = -1;
    assert.throws(() => validateAnalysisResult(bad), /page/);
  });

  test("rejects a page index the caller says doesn't exist", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].locationOnScan.page = 2;
    assert.throws(() => validateAnalysisResult(bad, /* pageCount */ 2), /page/);
  });

  test("accepts a page index within the caller-provided page count", () => {
    const ok = structuredClone(validResult);
    ok.errors[0].locationOnScan.page = 1;
    assert.doesNotThrow(() => validateAnalysisResult(ok, /* pageCount */ 2));
  });

  test("without a page count, any non-negative integer page is accepted", () => {
    const ok = structuredClone(validResult);
    ok.errors[0].locationOnScan.page = 47;
    assert.doesNotThrow(() => validateAnalysisResult(ok));
  });
});

test("Gemini response schema constrains confidence, coordinates, and page indexes", async () => {
  let request;
  const ai = {
    models: {
      async generateContent(value) {
        request = value;
        return {
          text: JSON.stringify({
            illegibleNote: "",
            errors: [
              {
                written: "teh",
                intended: "the",
                category: "orthographic",
                confidenceScore: 0.9,
                locationOnScan: { page: 1, x: 0.1, y: 0.1, z: 0.1, w: 0.1 },
              },
            ],
          }),
        };
      },
    },
  };

  await callModelWithRetry(
    ai,
    [],
    { modelName: "test-model", timeoutMs: 100, maxRetries: 0, retryBaseMs: 1 },
    2
  );

  const errorSchema = request.config.responseSchema.properties.errors.items.properties;
  assert.deepEqual(errorSchema.confidenceScore, { type: "number", minimum: 0, maximum: 1 });
  assert.deepEqual(errorSchema.locationOnScan.properties.page, {
    type: "integer",
    minimum: 0,
    maximum: 1,
  });
  for (const key of ["x", "y", "z", "w"]) {
    assert.deepEqual(errorSchema.locationOnScan.properties[key], {
      type: "number",
      minimum: 0,
      maximum: 1,
    });
  }
});

describe("confidence threshold", () => {
  test("defaults to CONFIDENCE_THRESHOLD_DEFAULT when unset", () => {
    delete process.env.ERROR_CONFIDENCE_THRESHOLD;
    assert.equal(getConfidenceThreshold(), CONFIDENCE_THRESHOLD_DEFAULT);
  });

  test("honours a valid ERROR_CONFIDENCE_THRESHOLD override", () => {
    process.env.ERROR_CONFIDENCE_THRESHOLD = "0.8";
    assert.equal(getConfidenceThreshold(), 0.8);
    delete process.env.ERROR_CONFIDENCE_THRESHOLD;
  });

  test("falls back to the default for an out-of-range override", () => {
    process.env.ERROR_CONFIDENCE_THRESHOLD = "5";
    assert.equal(getConfidenceThreshold(), CONFIDENCE_THRESHOLD_DEFAULT);
    delete process.env.ERROR_CONFIDENCE_THRESHOLD;
  });

  test("isUncertain flags scores below the threshold", () => {
    assert.equal(isUncertain({ confidenceScore: 0.3 }, 0.6), true);
    assert.equal(isUncertain({ confidenceScore: 0.9 }, 0.6), false);
  });
});

describe("group", () => {
  test("a valid error keeps its assigned category (Valid Error Tag)", () => {
    const error = { written: "teh", category: "orthographic", confidenceScore: 0.9 };
    assert.equal(group(error), "orthographic");
  });

  test("an error with an unrecognised shape is tagged 'unsure' (Uncategorized Error)", () => {
    assert.equal(group({ written: "teh", category: "not-a-real-category" }), "unsure");
    assert.equal(group({ written: "teh" }), "unsure");
    assert.equal(group("not an error object"), "unsure");
    assert.equal(group(null), "unsure");
  });
});

describe("describeFailure", () => {
  test("produces a human-readable message, never a raw stack trace", () => {
    const message = describeFailure(new Error("some internal detail"));
    assert.equal(typeof message, "string");
    assert.ok(!message.includes("at "), "message should not look like a stack trace");
  });

  test("passes through the unreadable-image message unchanged", () => {
    const err = new Error('Could not read the uploaded image at "uploads/x.png"');
    assert.equal(describeFailure(err), err.message);
  });

  test("explains a missing API key", () => {
    const err = new Error("GEMINI_API_KEY is not configured");
    assert.match(describeFailure(err), /GEMINI_API_KEY/);
  });

  test("explains a timeout without leaking internal timing detail", () => {
    const message = describeFailure(new TimeoutError("Gemini request timed out after 30000ms"));
    assert.match(message, /timed out/i);
    assert.ok(!message.includes("30000"), "raw timeout value should not reach the educator");
  });
});

describe("mimeTypeFor", () => {
  test("maps the supported extensions, ignoring case", () => {
    assert.equal(mimeTypeFor("uploads/scan.png"), "image/png");
    assert.equal(mimeTypeFor("uploads/scan.PNG"), "image/png");
    assert.equal(mimeTypeFor("uploads/scan.jpg"), "image/jpeg");
    assert.equal(mimeTypeFor("uploads/scan.jpeg"), "image/jpeg");
    assert.equal(mimeTypeFor("uploads/scan.pdf"), "application/pdf");
  });

  test("rejects an unsupported file type", () => {
    assert.throws(() => mimeTypeFor("uploads/scan.gif"), /Unsupported image type/);
  });
});

describe("buildPrompt", () => {
  test("lists every category the model is allowed to choose", () => {
    const prompt = buildPrompt(onePageSample("uploads/x.png", { answerKey: "" }));
    for (const category of ERROR_CATEGORIES) {
      assert.ok(prompt.includes(category), `prompt is missing the "${category}" category`);
    }
  });

  test("tells the model never to correct the child's spelling", () => {
    const prompt = buildPrompt(onePageSample("uploads/x.png", { answerKey: "" }));
    assert.match(prompt, /Do not silently correct/);
  });

  test("withholds the answer key on open-ended essays", () => {
    const prompt = buildPrompt(onePageSample("uploads/x.png", { answerKey: "The cat sat on the mat." }));
    assert.ok(
      !prompt.includes("The cat sat on the mat."),
      "an essay has no single correct answer, so the key must not be sent"
    );
  });

  test("passes the answer key as reading help on closed tasks", () => {
    const prompt = buildPrompt({
      pages: [{ imagePath: "uploads/x.png" }],
      taskType: "SHORT_ANSWER",
      answerKey: "The cat sat on the mat.",
    });
    assert.ok(prompt.includes("The cat sat on the mat."));
    assert.match(prompt, /help you read unclear handwriting/);
  });

  test("omits the answer-key section when no key is stored", () => {
    const prompt = buildPrompt({ pages: [{ imagePath: "uploads/x.png" }], taskType: "SHORT_ANSWER", answerKey: "" });
    assert.ok(!prompt.includes("help you read unclear handwriting"));
  });

  test("describes a single page as page 0, not a page count", () => {
    const prompt = buildPrompt(onePageSample("uploads/x.png"));
    assert.match(prompt, /single page/);
  });

  test("tells the model how many pages it's getting and that they're one continuous piece of writing", () => {
    const prompt = buildPrompt({
      pages: [{ imagePath: "uploads/p0.png" }, { imagePath: "uploads/p1.png" }, { imagePath: "uploads/p2.png" }],
      taskType: "ESSAY",
    });
    assert.match(prompt, /3 pages/);
    assert.match(prompt, /one continuous piece of writing/);
  });
});

describe("callModelWithRetry", () => {
  const validPayload = {
    illegibleNote: "",
    errors: [
      {
        written: "teh",
        intended: "the",
        category: "orthographic",
        confidenceScore: 0.9,
        note: "Transposed letters.",
        locationOnScan: { page: 0, x: 0.1, y: 0.1, z: 0.05, w: 0.05 },
      },
    ],
  };

  const reply = (payload) => ({ text: JSON.stringify(payload) });
  const config = (maxRetries, timeoutMs = 1000) => ({
    modelName: "test-model",
    timeoutMs,
    maxRetries,
    retryBaseMs: 500,
  });

  // Stand-in for the Gemini client: one queued step per attempt, each either
  // a response to return or an Error to throw.
  function fakeModel(steps) {
    const client = {
      callCount: 0,
      models: {
        generateContent: async () => {
          const step = steps[client.callCount];
          client.callCount += 1;
          if (step === undefined) throw new Error("fakeModel: called more times than queued");
          if (step instanceof Error) throw step;
          return step;
        },
      },
    };
    return client;
  }

  test("returns the validated result without retrying when the first call succeeds", async () => {
    const ai = fakeModel([reply(validPayload)]);
    const result = await callModelWithRetry(ai, [], config(2));

    assert.deepEqual(result, validPayload);
    assert.equal(ai.callCount, 1);
  });

  test("retries after a failed call and returns the later success", async () => {
    const ai = fakeModel([new Error("network reset"), reply(validPayload)]);
    const result = await callModelWithRetry(ai, [], config(2));

    assert.deepEqual(result, validPayload);
    assert.equal(ai.callCount, 2);
  });

  test("retries when the model returns text that is not JSON", async () => {
    const ai = fakeModel([{ text: "Sure! Here are the errors I found:" }, reply(validPayload)]);
    const result = await callModelWithRetry(ai, [], config(2));

    assert.deepEqual(result, validPayload);
    assert.equal(ai.callCount, 2);
  });

  test("retries when the response is valid JSON but breaks the schema", async () => {
    const offSchema = structuredClone(validPayload);
    offSchema.errors[0].category = "not-a-real-category";
    const ai = fakeModel([reply(offSchema), reply(validPayload)]);

    const result = await callModelWithRetry(ai, [], config(2));

    // Proves validation runs inside the retry loop: a schema breach is
    // retried rather than persisted.
    assert.deepEqual(result, validPayload);
    assert.equal(ai.callCount, 2);
  });

  test("retries when the model reports a page index that doesn't exist in this sample", async () => {
    const outOfRange = structuredClone(validPayload);
    outOfRange.errors[0].locationOnScan.page = 5; // this sample only has 2 pages
    const ai = fakeModel([reply(outOfRange), reply(validPayload)]);

    const result = await callModelWithRetry(ai, [], config(2), /* pageCount */ 2);

    assert.deepEqual(result, validPayload);
    assert.equal(ai.callCount, 2);
  });

  test("gives up after maxRetries and rethrows the last error", async () => {
    const ai = fakeModel([new Error("first failure"), new Error("final failure")]);

    await assert.rejects(() => callModelWithRetry(ai, [], config(1)), /final failure/);
    assert.equal(ai.callCount, 2, "one initial attempt plus one retry");
  });

  test("does not retry when maxRetries is zero", async () => {
    const ai = fakeModel([new Error("only attempt")]);

    await assert.rejects(() => callModelWithRetry(ai, [], config(0)), /only attempt/);
    assert.equal(ai.callCount, 1);
  });

  test("waits longer before retrying a Gemini rate-limit (429) error than a generic failure", async () => {
    const rateLimitError = Object.assign(new Error("Resource exhausted"), { status: 429 });
    const ai = fakeModel([rateLimitError, reply(validPayload)]);

    const start = Date.now();
    const result = await callModelWithRetry(ai, [], config(1));
    const elapsed = Date.now() - start;

    assert.deepEqual(result, validPayload);
    assert.equal(ai.callCount, 2);
    assert.ok(elapsed >= 2000, `expected a rate-limit backoff of at least 2000ms, got ${elapsed}ms`);
  });

  test("times out a call that never comes back", async () => {
    const stalled = {
      callCount: 0,
      models: {
        generateContent: () => {
          stalled.callCount += 1;
          return new Promise(() => {}); // never settles
        },
      },
    };

    await assert.rejects(
      () => callModelWithRetry(stalled, [], config(0, 50)),
      (err) => err instanceof TimeoutError
    );
    assert.equal(stalled.callCount, 1);
  });
});
