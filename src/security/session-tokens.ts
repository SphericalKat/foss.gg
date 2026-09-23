import {
  fromBase64Url,
  toBase64Url,
  timingSafeStringEqual,
  utf8Bytes,
} from "./primitives";

const sign = async (value: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8Bytes(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, utf8Bytes(value))
  );
  return toBase64Url(bytes);
};

export const createSessionToken = async (
  username: string,
  expires: number,
  secret: string
): Promise<string> => {
  const payload = `${toBase64Url(utf8Bytes(username))}.${expires}`;
  return `${payload}.${await sign(payload, secret)}`;
};

export const readSessionToken = async (
  token: string,
  secret: string
): Promise<string | null> => {
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
  if (!(await timingSafeStringEqual(signature, await sign(payload, secret)))) {
    return null;
  }
  return new TextDecoder().decode(fromBase64Url(encodedUsername));
};
