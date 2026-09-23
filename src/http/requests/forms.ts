import type { LinkRequest } from "../../services/links";

export const readFormData = async (
  request: Request
): Promise<FormData | null> => {
  try {
    return await request.formData();
  } catch {
    return null;
  }
};

export const readLinkRequest = async (
  request: Request
): Promise<LinkRequest | { error: "Invalid form data" }> => {
  const form = await readFormData(request);
  if (!form) {
    return { error: "Invalid form data" };
  }
  return {
    destination: String(form.get("destination") ?? "").trim(),
    key: String(form.get("key") ?? "").trim(),
    kind: String(form.get("kind") ?? ""),
  };
};

interface Credentials {
  username: string;
  password: string;
}

export const readCredentials = (form: FormData): Credentials => ({
  password: String(form.get("password") ?? ""),
  username: String(form.get("username") ?? "")
    .trim()
    .toLowerCase(),
});
