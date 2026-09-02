import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import worker from "../src/index";

const password = "test-password";

const linkId = async (key: string): Promise<number> => {
  const row = await env.DB.prepare("SELECT id FROM links WHERE key = ?1")
    .bind(key)
    .first<{ id: number }>();
  if (!row) {
    throw new Error(`Link ${key} was not created`);
  }
  return row.id;
};

describe("foss.gg worker", () => {
  const request = (
    path: string,
    init: RequestInit = {},
    host = "foss.gg"
  ): Promise<Response> =>
    worker.fetch(new Request(`https://${host}${path}`, init), {
      ADMIN_PASSWORD: password,
      DB: env.DB,
    });

  const form = (
    path: string,
    values: Record<string, string>,
    cookie?: string
  ): Promise<Response> => {
    const headers = new Headers({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    if (cookie) {
      headers.set("Cookie", cookie);
    }
    return request(path, {
      body: new URLSearchParams(values),
      headers,
      method: "POST",
    });
  };

  const loginCookie = async (
    username: string,
    loginPassword: string
  ): Promise<string> => {
    const login = await form("/admin/login", {
      password: loginPassword,
      username,
    });
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) {
      throw new Error("Login did not set a session cookie");
    }
    return cookie;
  };

  beforeEach(async () => {
    await env.DB.exec("DELETE FROM audit_log");
    await env.DB.exec("DELETE FROM links");
    await env.DB.exec("DELETE FROM users");
  });

  test("serves the landing page at the apex root", async () => {
    const response = await request("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=UTF-8"
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("answers HEAD requests for the landing page", async () => {
    const response = await request("/", { method: "HEAD" });

    expect(response.status).toBe(200);
  });

  test("redirects path and subdomain links without forwarding source data", async () => {
    const cookie = await loginCookie("admin", password);
    const pathCreated = await form(
      "/admin/links",
      { destination: "https://example.com/a?b=c#d", key: "go", kind: "path" },
      cookie
    );
    expect(pathCreated.status).toBe(303);
    const subdomainCreated = await form(
      "/admin/links",
      { destination: "https://example.org/", key: "go", kind: "subdomain" },
      cookie
    );
    expect(subdomainCreated.status).toBe(303);

    const pathResponse = await request("/go?ignored=yes", {}, "FOSS.GG");
    expect(pathResponse.status).toBe(302);
    expect(pathResponse.headers.get("location")).toBe(
      "https://example.com/a?b=c#d"
    );
    const subdomainResponse = await request("/anything", {}, "go.foss.gg");
    expect(subdomainResponse.headers.get("location")).toBe(
      "https://example.org/"
    );
  });

  test("requires a session for admin routes", async () => {
    const admin = await request("/admin");
    expect(admin.status).toBe(200);
    const wrongPassword = await form("/admin/login", {
      password: "wrong",
      username: "admin",
    });
    expect(wrongPassword.status).toBe(401);
    const jsonLogin = await request("/admin/login", {
      body: "{}",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(jsonLogin.status).toBe(400);
  });

  test("rejects invalid link input", async () => {
    const cookie = await loginCookie("admin", password);
    const scriptDestination = ["javascript", "alert(1)"].join(":");
    const scriptUrl = await form(
      "/admin/links",
      { destination: scriptDestination, key: "one", kind: "path" },
      cookie
    );
    expect(scriptUrl.status).toBe(400);
    const rootKey = await form(
      "/admin/links",
      { destination: "https://example.com", key: "/", kind: "path" },
      cookie
    );
    expect(rootKey.status).toBe(400);
    const reservedKey = await form(
      "/admin/links",
      { destination: "https://example.com", key: "/admin/x", kind: "path" },
      cookie
    );
    expect(reservedKey.status).toBe(400);
  });

  test("creates, edits, and deletes links with an audit trail", async () => {
    const cookie = await loginCookie("admin", password);
    const created = await form(
      "/admin/links",
      { destination: "https://example.com", key: "one", kind: "path" },
      cookie
    );
    expect(created.status).toBe(303);
    const duplicate = await form(
      "/admin/links",
      { destination: "https://other.example", key: "/one", kind: "path" },
      cookie
    );
    expect(duplicate.status).toBe(409);

    const id = await linkId("/one");
    const updated = await form(
      `/admin/links/${id}`,
      {
        destination: "https://edited.example",
        key: "edited",
        kind: "subdomain",
      },
      cookie
    );
    expect(updated.status).toBe(303);
    const editedResponse = await request("/anything", {}, "edited.foss.gg");
    expect(editedResponse.headers.get("location")).toBe(
      "https://edited.example"
    );
  });

  test("removes deleted links and records the audit trail", async () => {
    const cookie = await loginCookie("admin", password);
    await form(
      "/admin/links",
      { destination: "https://example.com", key: "one", kind: "path" },
      cookie
    );
    const id = await linkId("/one");
    await form(
      `/admin/links/${id}`,
      {
        destination: "https://edited.example",
        key: "edited",
        kind: "subdomain",
      },
      cookie
    );
    const deleted = await form(`/admin/links/${id}/delete`, {}, cookie);
    expect(deleted.status).toBe(303);

    const missing = await request("/anything", {}, "edited.foss.gg");
    expect(missing.status).toBe(404);
    const activity = await env.DB.prepare(
      "SELECT action FROM audit_log ORDER BY id"
    ).all<{ action: string }>();
    expect(activity.results.map(({ action }) => action)).toStrictEqual([
      "created",
      "updated",
      "deleted",
    ]);
  });

  test("lets admins add users who can log in", async () => {
    const adminCookie = await loginCookie("admin", password);
    const created = await form(
      "/admin/users",
      { password: "correct horse battery staple", username: "alice" },
      adminCookie
    );
    expect(created.status).toBe(303);
    const userCookie = await loginCookie(
      "alice",
      "correct horse battery staple"
    );
    const forbidden = await form(
      "/admin/users",
      { password: "correct horse battery staple", username: "mallory" },
      userCookie
    );
    expect(forbidden.status).toBe(404);
  });

  test("enforces link ownership between users", async () => {
    const adminCookie = await loginCookie("admin", password);
    await form(
      "/admin/users",
      { password: "correct horse battery staple", username: "alice" },
      adminCookie
    );
    const userCookie = await loginCookie(
      "alice",
      "correct horse battery staple"
    );

    await form(
      "/admin/links",
      { destination: "https://admin.example", key: "admin-link", kind: "path" },
      adminCookie
    );
    const adminLinkId = await linkId("/admin-link");
    const stolen = await form(
      `/admin/links/${adminLinkId}`,
      { destination: "https://alice.example", key: "stolen", kind: "path" },
      userCookie
    );
    expect(stolen.status).toBe(404);
    const stolenDelete = await form(
      `/admin/links/${adminLinkId}/delete`,
      {},
      userCookie
    );
    expect(stolenDelete.status).toBe(404);

    await form(
      "/admin/links",
      { destination: "https://alice.example", key: "alice-link", kind: "path" },
      userCookie
    );
    const aliceLinkId = await linkId("/alice-link");
    const takeover = await form(
      `/admin/links/${aliceLinkId}`,
      {
        destination: "https://admin.example",
        key: "admin-takeover",
        kind: "path",
      },
      adminCookie
    );
    expect(takeover.status).toBe(404);
  });

  test("returns not found for unsupported host forms and missing links", async () => {
    const missing = await request("/missing");
    expect(missing.status).toBe(404);
    const nested = await request("/anything", {}, "a.b.foss.gg");
    expect(nested.status).toBe(404);
    const foreign = await request("/anything", {}, "other.example");
    expect(foreign.status).toBe(404);
  });
});
