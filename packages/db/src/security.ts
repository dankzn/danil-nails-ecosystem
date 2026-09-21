import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;
const passwordFormat = "scrypt-v1";

export async function hashPassword(password: string) {
  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters");
  }

  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

  return [
    passwordFormat,
    salt.toString("base64url"),
    derivedKey.toString("base64url")
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [format, encodedSalt, encodedKey] = encodedHash.split("$");

  if (format !== passwordFormat || !encodedSalt || !encodedKey) {
    return false;
  }

  const salt = Buffer.from(encodedSalt, "base64url");
  const expectedKey = Buffer.from(encodedKey, "base64url");
  const actualKey = (await scrypt(password, salt, expectedKey.length)) as Buffer;

  return (
    expectedKey.length === actualKey.length &&
    timingSafeEqual(expectedKey, actualKey)
  );
}
