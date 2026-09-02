import { env } from "cloudflare:workers";
import { beforeEach, expect, test } from "vitest";

import worker from "../src/index";

const password = "test-password";

async function request(path: string, init: RequestInit = {}, host = "foss.gg"): Promise<Response> {
  return worker.fetch(new Request(`https://${host}${path}`, init), {
    ADMIN_PASSWORD: password,
    DB: env.DB,
  });
}

async function form(
  path: string,
  values: Record<string, string>,
  cookie?: string,
): Promise<Response> {
  return request(path, {
    body: new URLSearchParams(values),
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM audit_log");
  await env.DB.exec("DELETE FROM links");
  await env.DB.exec("DELETE FROM users");
});

test("serves the landing page at the apex root", async () => {
  const response = await request("/");

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=UTF-8");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-security-policy")).toBe(
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect((await request("/", { method: "HEAD" })).status).toBe(200);
});

test("redirects path and subdomain links without forwarding source data", async () => {
  const login = await form("/admin/login", { password, username: "admin" });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  expect(
    (
      await form(
        "/admin/links",
        { destination: "https://example.com/a?b=c#d", key: "go", kind: "path" },
        cookie!,
      )
    ).status,
  ).toBe(303);
  expect(
    (
      await form(
        "/admin/links",
        { destination: "https://example.org/", key: "go", kind: "subdomain" },
        cookie!,
      )
    ).status,
  ).toBe(303);

  const pathResponse = await request("/go?ignored=yes", {}, "FOSS.GG");
  expect(pathResponse.status).toBe(302);
  expect(pathResponse.headers.get("location")).toBe("https://example.com/a?b=c#d");
  expect((await request("/anything", {}, "go.foss.gg")).headers.get("location")).toBe(
    "https://example.org/",
  );
});

test("requires a session and supports create, edit, delete, and validation", async () => {
  expect((await request("/admin")).status).toBe(200);
  expect((await form("/admin/login", { password: "wrong", username: "admin" })).status).toBe(401);
  expect(
    (
      await request("/admin/login", {
        body: "{}",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    ).status,
  ).toBe(400);

  const login = await form("/admin/login", { password, username: "admin" });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  expect(
    (
      await form(
        "/admin/links",
        { destination: "javascript:alert(1)", key: "one", kind: "path" },
        cookie!,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await form(
        "/admin/links",
        { destination: "https://example.com", key: "/", kind: "path" },
        cookie!,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await form(
        "/admin/links",
        { destination: "https://example.com", key: "/admin/x", kind: "path" },
        cookie!,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await form(
        "/admin/links",
        { destination: "https://example.com", key: "one", kind: "path" },
        cookie!,
      )
    ).status,
  ).toBe(303);
  const duplicate = await form(
    "/admin/links",
    { destination: "https://other.example", key: "/one", kind: "path" },
    cookie!,
  );
  expect(duplicate.status).toBe(409);

  const row = await env.DB.prepare("SELECT id FROM links WHERE key = '/one'").first<{
    id: number;
  }>();
  expect(row).toBeTruthy();
  expect(
    (
      await form(
        `/admin/links/${row!.id}`,
        {
          destination: "https://edited.example",
          key: "edited",
          kind: "subdomain",
        },
        cookie!,
      )
    ).status,
  ).toBe(303);
  expect((await request("/anything", {}, "edited.foss.gg")).headers.get("location")).toBe(
    "https://edited.example",
  );
  expect((await form(`/admin/links/${row!.id}/delete`, {}, cookie!)).status).toBe(303);
  expect((await request("/anything", {}, "edited.foss.gg")).status).toBe(404);
  const activity = await env.DB.prepare("SELECT action FROM audit_log ORDER BY id").all<{
    action: string;
  }>();
  expect(activity.results.map(({ action }) => action)).toStrictEqual([
    "created",
    "updated",
    "deleted",
  ]);
});

test("lets admin add users and enforces link ownership", async () => {
  const adminLogin = await form("/admin/login", {
    password,
    username: "admin",
  });
  const adminCookie = adminLogin.headers.get("set-cookie")?.split(";")[0];

  expect(
    (
      await form(
        "/admin/users",
        { password: "correct horse battery staple", username: "alice" },
        adminCookie!,
      )
    ).status,
  ).toBe(303);
  const userLogin = await form("/admin/login", {
    password: "correct horse battery staple",
    username: "alice",
  });
  const userCookie = userLogin.headers.get("set-cookie")?.split(";")[0];

  expect(
    (
      await form(
        "/admin/links",
        {
          destination: "https://admin.example",
          key: "admin-link",
          kind: "path",
        },
        adminCookie!,
      )
    ).status,
  ).toBe(303);
  const adminLink = await env.DB.prepare("SELECT id FROM links WHERE key = '/admin-link'").first<{
    id: number;
  }>();
  expect(
    (
      await form(
        `/admin/links/${adminLink!.id}`,
        { destination: "https://alice.example", key: "stolen", kind: "path" },
        userCookie!,
      )
    ).status,
  ).toBe(404);
  expect((await form(`/admin/links/${adminLink!.id}/delete`, {}, userCookie!)).status).toBe(404);

  expect(
    (
      await form(
        "/admin/links",
        {
          destination: "https://alice.example",
          key: "alice-link",
          kind: "path",
        },
        userCookie!,
      )
    ).status,
  ).toBe(303);
  const aliceLink = await env.DB.prepare("SELECT id FROM links WHERE key = '/alice-link'").first<{
    id: number;
  }>();
  expect(
    (
      await form(
        `/admin/links/${aliceLink!.id}`,
        {
          destination: "https://admin.example",
          key: "admin-takeover",
          kind: "path",
        },
        adminCookie!,
      )
    ).status,
  ).toBe(404);

  expect(
    (
      await form(
        "/admin/users",
        { password: "correct horse battery staple", username: "mallory" },
        userCookie!,
      )
    ).status,
  ).toBe(404);
});

test("returns not found for unsupported host forms and missing links", async () => {
  expect((await request("/missing")).status).toBe(404);
  expect((await request("/anything", {}, "a.b.foss.gg")).status).toBe(404);
  expect((await request("/anything", {}, "other.example")).status).toBe(404);
});
