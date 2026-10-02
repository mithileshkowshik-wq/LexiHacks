// Integration tests for the Error Classification Engine.
// Run with: npm test  (picked up by `node --test` alongside the unit tests)
//
// Scope: the engine TOGETHER WITH the Sample/Student Mongoose models and a
// real MongoDB instance - i.e. the full runAnalysis() background job, from
// loading the sample out of the database to persisting the final state.
// Strategy is bottom-up along the call graph: the leaf functions are covered
// by the unit tests in errorClassificationEngine.test.js; this file covers
// the next layer up (engine <-> model <-> database). The layer above this
// (HTTP route -> runAnalysis) is tested once the upload endpoint exists.
//
// Requires MONGODB_URI (read from server/.env). The whole suite skips
// cleanly when it is not set, so teammates without a local database can
// still run `npm test` for the unit tests alone.

import dotenv from "dotenv";
dotenv.config();

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Sample } from "../models/sample.js";
import { Student } from "../models/student.js";
import { runAnalysis } from "./errorClassificationEngine.js";

const uri = process.env.MONGODB_URI;

describe(
  "runAnalysis integration (engine <-> Sample model <-> MongoDB)",
  { skip: uri ? false : "MONGODB_URI not set - skipping integration tests" },
  () => {
    let student;

    before(async () => {
      // Force mock mode so these tests are deterministic and never spend
      // API quota, regardless of what the local .env has configured.
      process.env.USE_MOCK_AI = "true";

      await mongoose.connect(uri);
      student = await Student.create({
        name: "INTEGRATION-TEST-STUDENT",
        currentGrade: "P4",
      });
    });

    after(async () => {
      await Sample.deleteMany({ student: student._id });
      await Student.deleteOne({ _id: student._id });
      await mongoose.disconnect();
    });

    test("IT-01: analyses an uploaded sample and persists ANALYSED with intact errors", async () => {
      const sample = await Sample.create({
        student: student._id,
        title: "integration happy path",
        pages: [{ imagePath: "uploads/integration-sample.png", originalFilename: "sample.png" }],
        taskType: "ESSAY",
      });

      await runAnalysis(sample._id);

      const saved = await Sample.findById(sample._id);
      assert.equal(saved.status, "ANALYSED");
      assert.equal(saved.analysisError, "");
      assert.ok(saved.errors.length > 0, "expected detected errors to be persisted");

      for (const detectedError of saved.errors) {
        // The exact written form and the AI's metadata must survive the
        // full trip through Mongoose validation and MongoDB storage.
        assert.notEqual(detectedError.written.trim(), "");
        assert.equal(typeof detectedError.confidenceScore, "number");
        assert.equal(detectedError.locationOnScan.page, 0, "the only page in a one-page sample");
        for (const key of ["x", "y", "z", "w"]) {
          const value = detectedError.locationOnScan[key];
          assert.ok(
            typeof value === "number" && value >= 0 && value <= 1,
            `locationOnScan.${key} must survive the round-trip in 0-1 range`
          );
        }
      }
    });

    test("IT-04: a multi-page sample persists errors tagged with the right page index", async () => {
      const sample = await Sample.create({
        student: student._id,
        title: "integration multi-page",
        pages: [
          { imagePath: "uploads/integration-page-0.png", originalFilename: "p0.png" },
          { imagePath: "uploads/integration-page-1.png", originalFilename: "p1.png" },
        ],
        taskType: "ESSAY",
      });

      await runAnalysis(sample._id);

      const saved = await Sample.findById(sample._id);
      assert.equal(saved.status, "ANALYSED");
      const pagesSeen = new Set(saved.errors.map((e) => e.locationOnScan.page));
      assert.ok(pagesSeen.has(0) && pagesSeen.has(1), "expected errors tagged on both of the sample's pages");
      for (const detectedError of saved.errors) {
        const page = detectedError.locationOnScan.page;
        assert.ok(Number.isInteger(page) && page >= 0 && page < 2, `page ${page} does not exist in this 2-page sample`);
      }
    });

    test("IT-03: a malformed sample id is swallowed, never an unhandled rejection", async () => {
      // runAnalysis is called fire-and-forget after the upload response has
      // already been sent, so nothing is there to catch a rejection. An
      // unhandled rejection takes the whole server down in Node 15+, so this
      // must resolve quietly no matter what the database does.
      await assert.doesNotReject(() => runAnalysis("not-a-valid-object-id"));
    });

    test("IT-02: an unreadable upload persists FAILED with a human-readable reason", async () => {
      const sample = await Sample.create({
        student: student._id,
        title: "integration failure path",
        // "corrupt" triggers the mock failure - on any page, not just the first.
        pages: [{ imagePath: "uploads/corrupt-integration.png", originalFilename: "corrupt.png" }],
        taskType: "ESSAY",
      });

      await runAnalysis(sample._id);

      const saved = await Sample.findById(sample._id);
      assert.equal(saved.status, "FAILED");
      assert.match(saved.analysisError, /Could not read the uploaded image/);
      assert.equal(saved.errors.length, 0, "no errors should be written on failure");
      // The reason shown to the educator must be plain language, not a stack trace.
      assert.ok(!saved.analysisError.includes("    at "));
    });
  }
);
