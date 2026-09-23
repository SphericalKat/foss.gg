import { scrypt } from "node:crypto";
import { promisify } from "node:util";

import type { Session, UserSummary } from "../types";
import { isUniqueConstraintError } from "./errors";

export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();
const scryptAsync = promisify(scrypt);

interface User {
  username: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

type UserWriteResult =
  | { status: "ok" }
  | { status: "invalid"; message: string }
  | { status: "conflict"; message: string }
  | { status: "failure" };

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
};

const fromBase64Url = (value: string): Uint8Array => {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(
    atob(base64),
    (character) => character.codePointAt(0) ?? 0
  );
};

const timingSafeStringEqual = async (
  left: string,
  right: string
): Promise<boolean> => {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return crypto.subtle.timingSafeEqual(leftDigest, rightDigest);
};

const sign = async (value: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value))
  );
  return toBase64Url(bytes);
};

const hashPassword = async (
  password: string,
  salt: Uint8Array<ArrayBufferLike> = crypto.getRandomValues(new Uint8Array(16))
): Promise<{ hash: string; salt: string }> => {
  // SAFETY: promisify(scrypt) resolves a Buffer, which is a Uint8Array.
  const derivedKey = (await scryptAsync(password, salt, 32)) as Uint8Array;
  return { hash: toBase64Url(derivedKey), salt: toBase64Url(salt) };
};

const verifyPassword = async (
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

const isUsername = (value: string): boolean =>
  value.length <= 32 && /^[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$/u.test(value);

const validCredentials = async (
  db: D1Database,
  adminPassword: string,
  username: string,
  password: string
): Promise<boolean> => {
  if (username === "admin") {
    return (
      Boolean(adminPassword) && timingSafeStringEqual(password, adminPassword)
    );
  }
  const user = await db
    .prepare(
      "SELECT username, password_hash, password_salt, created_at FROM users WHERE username = ?1"
    )
    .bind(username)
    .first<User>();
  if (!user) {
    return false;
  }
  return verifyPassword(password, user.password_salt, user.password_hash);
};

export const listUsers = async (db: D1Database): Promise<UserSummary[]> => {
  const result = await db
    .prepare("SELECT username, created_at FROM users ORDER BY username")
    .all<UserSummary>();
  return result.results;
};

export const addUser = async (
  db: D1Database,
  username: string,
  password: string
): Promise<UserWriteResult> => {
  if (!isUsername(username) || username === "admin") {
    return { message: "Enter a valid username", status: "invalid" };
  }
  if (password.length < 12 || password.length > 256) {
    return {
      message: "Passwords must contain 12 to 256 characters",
      status: "invalid",
    };
  }

  const credentials = await hashPassword(password);
  try {
    await db
      .prepare(
        "INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?1, ?2, ?3, ?4)"
      )
      .bind(
        username,
        credentials.hash,
        credentials.salt,
        new Date().toISOString()
      )
      .run();
    return { status: "ok" };
  } catch (error) {
    if (error instanceof Error && isUniqueConstraintError(error.message)) {
      return { message: "That username already exists", status: "conflict" };
    }
    return { status: "failure" };
  }
};

export const authenticate = async (
  db: D1Database,
  adminPassword: string,
  username: string,
  password: string
): Promise<string | null> => {
  if (!isUsername(username) || password.length > 256) {
    return null;
  }
  if (!(await validCredentials(db, adminPassword, username, password))) {
    return null;
  }

  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${toBase64Url(encoder.encode(username))}.${expires}`;
  const signature = await sign(payload, adminPassword);
  return `${payload}.${signature}`;
};

export const getSession = async (
  token: string,
  db: D1Database,
  adminPassword: string
): Promise<Session | null> => {
  if (!adminPassword) {
    return null;
  }
  const [encodedUsername, expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (
    !encodedUsername ||
    !Number.isSafeInteger(expires) ||
    expires <= Math.floor(Date.now() / 1000) ||
    !signature
  ) {
    return null;
  }
  const payload = `${encodedUsername}.${expiresText}`;
  if (
    !(await timingSafeStringEqual(
      signature,
      await sign(payload, adminPassword)
    ))
  ) {
    return null;
  }

  const username = new TextDecoder().decode(fromBase64Url(encodedUsername));
  if (!isUsername(username)) {
    return null;
  }
  if (username !== "admin") {
    const user = await db
      .prepare("SELECT username FROM users WHERE username = ?1")
      .bind(username)
      .first();
    if (!user) {
      return null;
    }
  }
  return { isAdmin: username === "admin", username };
};
