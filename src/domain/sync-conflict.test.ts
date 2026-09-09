import test from "node:test";
import assert from "node:assert/strict";
import { isStaleWrite } from "./sync-conflict.ts";

test("does not flag equal or newer base versions as stale", () => {
  assert.equal(isStaleWrite(1, 1), false);
  assert.equal(isStaleWrite(2, 1), false);
  assert.equal(isStaleWrite(null, 2), false);
});

test("flags an older base version as a stale write", () => {
  assert.equal(isStaleWrite(1, 2), true);
});
