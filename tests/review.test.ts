import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewReasons } from "../packages/review/model";
test("review queue derives action steps without treating ownership as approval", () => {
  assert.deepEqual(reviewReasons("NORMALIZED", null, "UNKNOWN"), [
    "VALIDATION_REQUIRED",
  ]);
  assert.deepEqual(reviewReasons("VALID", "PASS", "VERIFIED"), [
    "APPROVAL_REQUIRED",
  ]);
  assert.deepEqual(reviewReasons("APPROVED", "PASS", "UNKNOWN"), [
    "RECIPIENT_REVIEW",
    "GENERATION_REQUIRED",
  ]);
  assert.deepEqual(reviewReasons("INVALID", "FAIL", "VERIFIED"), [
    "DATA_ERRORS",
  ]);
  assert.deepEqual(reviewReasons("BLOCKED_UNSUPPORTED", "FAIL", "VERIFIED"), [
    "UNSUPPORTED_CASE",
  ]);
});
test("completed exports clear ordinary work while expired evidence and service errors stay visible", () => {
  assert.deepEqual(reviewReasons("ARTIFACT_VALIDATED", "PASS", "UNKNOWN"), []);
  assert.deepEqual(reviewReasons("ARTIFACT_VALIDATED", "PASS", "EXPIRED"), [
    "RECIPIENT_REVIEW",
  ]);
  assert.deepEqual(
    reviewReasons("VALIDATION_PENDING", "PENDING", "UNKNOWN"),
    [],
  );
  assert.deepEqual(reviewReasons("VALIDATION_PENDING", "ERROR", "UNKNOWN"), [
    "TECHNICAL_RETRY",
  ]);
});
