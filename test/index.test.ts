import worker from "../src/index";
import { env } from "cloudflare:workers";

const password = "test-password";

async function request(path: string, init: RequestInit = {}, host = "foss.gg"): Promise<Response> {
  return worker.fetch(new Request(`https://${host}${path}`, init), {
    DB: env.DB,
    ADMIN_PASSWORD: password,
  });
}

async function form(
  path: string,
  values: Record<string, string>,
  cookie?: string,
): Promise<Response> {
  return request(path, {
    method: "POST",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values),
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
  const login = await form("/admin/login", { username: "admin", password });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  expect(
    (
      await form(
        "/admin/links",
        { kind: "path", key: "go", destination: "https://example.com/a?b=c#d" },
        cookie!,
      )
    ).status,
  ).toBe(303);
  expect(
    (
      await form(
        "/admin/links",
        { kind: "subdomain", key: "go", destination: "https://example.org/" },
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
  expect((await form("/admin/login", { username: "admin", password: "wrong" })).status).toBe(401);
  expect(
    (
      await request("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
  ).toBe(400);

  const login = await form("/admin/login", { username: "admin", password });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  expect(
    (
      await form(
        "/admin/links",
        { kind: "path", key: "one", destination: "javascript:alert(1)" },
        cookie!,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await form(
        "/admin/links",
        { kind: "path", key: "/", destination: "https://example.com" },
        cookie!,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await form(
        "/admin/links",
        { kind: "path", key: "/admin/x", destination: "https://example.com" },
        cookie!,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await form(
        "/admin/links",
        { kind: "path", key: "one", destination: "https://example.com" },
        cookie!,
      )
    ).status,
  ).toBe(303);
  const duplicate = await form(
    "/admin/links",
    { kind: "path", key: "/one", destination: "https://other.example" },
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
        { kind: "subdomain", key: "edited", destination: "https://edited.example" },
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
  expect(activity.results.map(({ action }) => action)).toEqual(["created", "updated", "deleted"]);
});

test("lets admin add users and enforces link ownership", async () => {
  const adminLogin = await form("/admin/login", { username: "admin", password });
  const adminCookie = adminLogin.headers.get("set-cookie")?.split(";")[0];

  expect(
    (
      await form(
        "/admin/users",
        { username: "alice", password: "correct horse battery staple" },
        adminCookie!,
      )
    ).status,
  ).toBe(303);
  const userLogin = await form("/admin/login", {
    username: "alice",
    password: "correct horse battery staple",
  });
  const userCookie = userLogin.headers.get("set-cookie")?.split(";")[0];

  expect(
    (
      await form(
        "/admin/links",
        { kind: "path", key: "admin-link", destination: "https://admin.example" },
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
        { kind: "path", key: "stolen", destination: "https://alice.example" },
        userCookie!,
      )
    ).status,
  ).toBe(404);
  expect((await form(`/admin/links/${adminLink!.id}/delete`, {}, userCookie!)).status).toBe(404);

  expect(
    (
      await form(
        "/admin/links",
        { kind: "path", key: "alice-link", destination: "https://alice.example" },
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
        { kind: "path", key: "admin-takeover", destination: "https://admin.example" },
        adminCookie!,
      )
    ).status,
  ).toBe(404);

  expect(
    (
      await form(
        "/admin/users",
        { username: "mallory", password: "correct horse battery staple" },
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
