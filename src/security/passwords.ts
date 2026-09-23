import { scrypt } from "node:crypto";
import { promisify } from "node:util";

import {
  fromBase64Url,
  toBase64Url,
  timingSafeStringEqual,
} from "./primitives";

const scryptAsync = promisify(scrypt);

export const hashPassword = async (
  password: string,
  salt: Uint8Array<ArrayBufferLike> = crypto.getRandomValues(new Uint8Array(16))
): Promise<{ hash: string; salt: string }> => {
  // SAFETY: promisify(scrypt) resolves a Buffer, which is a Uint8Array.
  const derivedKey = (await scryptAsync(password, salt, 32)) as Uint8Array;
  return { hash: toBase64Url(derivedKey), salt: toBase64Url(salt) };
};

export const verifyPassword = async (
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> => {
  try {
    const actual = await hashPassword(password, fromBase64Url(salt));
    return timingSafeStringEqual(actual.hash, expectedHash);
  } catch {
    return false;
  }
};
