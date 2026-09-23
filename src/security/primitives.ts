const encoder = new TextEncoder();

export const utf8Bytes = (value: string): Uint8Array => encoder.encode(value);

export const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
};

export const fromBase64Url = (value: string): Uint8Array => {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(
    atob(base64),
    (character) => character.codePointAt(0) ?? 0
  );
};

export const timingSafeStringEqual = async (
  left: string,
  right: string
): Promise<boolean> => {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return crypto.subtle.timingSafeEqual(leftDigest, rightDigest);
};
