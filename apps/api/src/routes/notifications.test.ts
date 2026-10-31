import assert from "node:assert/strict";
import { test } from "node:test";
import { isAuthorizedDispatchRequest } from "./notifications.js";

test("isAuthorizedDispatchRequest rejects when no secret is configured", () => {
  assert.equal(isAuthorizedDispatchRequest("anything", undefined), false);
});

test("isAuthorizedDispatchRequest rejects a missing header", () => {
  assert.equal(isAuthorizedDispatchRequest(undefined, "secret"), false);
});

test("isAuthorizedDispatchRequest rejects a mismatched header", () => {
  assert.equal(isAuthorizedDispatchRequest("wrong", "secret"), false);
});

test("isAuthorizedDispatchRequest rejects a duplicated header (array)", () => {
  assert.equal(isAuthorizedDispatchRequest(["secret", "secret"], "secret"), false);
});

test("isAuthorizedDispatchRequest accepts a matching header", () => {
  assert.equal(isAuthorizedDispatchRequest("secret", "secret"), true);
});
