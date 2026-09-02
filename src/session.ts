import { scrypt } from "node:crypto";

import type { MiddlewareHandler } from "hono";

const SESSION_COOKIE = "foss_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

interface User {
  username: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

export interface Session {
  username: string;
  isAdmin: boolean;
}

export interface AppBindings {
  Bindings: Env;
  Variables: { session: Session | null };
}

export const loadSession: MiddlewareHandler<AppBindings> = async (context, next) => {
  context.set("session", await getSession(context.req.raw, context.env));
  await next();
};

export async function authenticate(
  env: Env,
  username: string,
  password: string,
): Promise<string | null> {
  if (!(await validCredentials(env, username, password))) {
    return null;
  }

  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${toBase64Url(encoder.encode(username))}.${expires}`;
  const signature = await sign(payload, env.ADMIN_PASSWORD);
  return `${SESSION_COOKIE}=${payload}.${signature}; Max-Age=${SESSION_TTL_SECONDS}; Path=/admin; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/admin; HttpOnly; Secure; SameSite=Lax`;
}

export async function createPasswordCredentials(
  password: string,
): Promise<{ hash: string; salt: string }> {
  return hashPassword(password);
}

export function isUsername(value: string): boolean {
  return value.length <= 32 && /^[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$/.test(value);
}

async function validCredentials(env: Env, username: string, password: string): Promise<boolean> {
  if (username === "admin") {
    return Boolean(env.ADMIN_PASSWORD) && timingSafeStringEqual(password, env.ADMIN_PASSWORD);
  }
  const user = await env.DB.prepare(
    "SELECT username, password_hash, password_salt, created_at FROM users WHERE username = ?1",
  )
    .bind(username)
    .first<User>();
  return Boolean(user) && verifyPassword(password, user!.password_salt, user!.password_hash);
}

async function getSession(request: Request, env: Env): Promise<Session | null> {
  if (!env.ADMIN_PASSWORD) {
    return null;
  }
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token) {
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
  if (!(await timingSafeStringEqual(signature, await sign(payload, env.ADMIN_PASSWORD)))) {
    return null;
  }

  const username = new TextDecoder().decode(fromBase64Url(encodedUsername));
  if (!isUsername(username)) {
    return null;
  }
  if (username !== "admin") {
    const user = await env.DB.prepare("SELECT username FROM users WHERE username = ?1")
      .bind(username)
      .first();
    if (!user) {
      return null;
    }
  }
  return { isAdmin: username === "admin", username };
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return toBase64Url(bytes);
}

async function timingSafeStringEqual(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return crypto.subtle.timingSafeEqual(leftDigest, rightDigest);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function hashPassword(
  password: string,
  salt: Uint8Array<ArrayBufferLike> = crypto.getRandomValues(new Uint8Array(16)),
): Promise<{ hash: string; salt: string }> {
  const hash = await new Promise<Uint8Array>((resolve, reject) => {
    scrypt(password, salt, 32, (error, derivedKey) =>
      error ? reject(error) : resolve(derivedKey),
    );
  });
  return { hash: toBase64Url(hash), salt: toBase64Url(salt) };
}

async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  try {
    const actual = await hashPassword(password, fromBase64Url(salt));
    return timingSafeStringEqual(actual.hash, expectedHash);
  } catch {
    return false;
  }
}
