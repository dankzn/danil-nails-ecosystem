import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./security.js";

test("password hashes are salted and verifiable", async () => {
  const password = "a-secure-test-password";
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword("wrong-password", firstHash), false);
});

test("short passwords are rejected", async () => {
  await assert.rejects(() => hashPassword("too-short"));
});
