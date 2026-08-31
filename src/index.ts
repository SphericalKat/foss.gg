const APEX_HOST = "foss.gg";
const SESSION_COOKIE = "foss_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

type LinkKind = "path" | "subdomain";

type Link = {
  id: number;
  kind: LinkKind;
  key: string;
  destination: string;
  created_at: string;
  updated_at: string;
};

type LinkInput = {
  kind: LinkKind;
  key: string;
  destination: string;
};

type AppEnv = Env & { ADMIN_PASSWORD: string };

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);
    const hostname = normalizeHostname(url.hostname);

    if (hostname === APEX_HOST && isAdminPath(url.pathname)) {
      return handleAdmin(request, env, url);
    }

    if (hostname === APEX_HOST && url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
      return landingPage();
    }

    const lookup = getLookup(hostname, url.pathname);
    if (!lookup) return textResponse("Not found", 404);

    try {
      const link = await env.DB.prepare(
        "SELECT id, kind, key, destination, created_at, updated_at FROM links WHERE kind = ?1 AND key = ?2",
      )
        .bind(lookup.kind, lookup.key)
        .first<Link>();

      return link
        ? new Response(null, { status: 302, headers: { Location: link.destination } })
        : textResponse("Not found", 404);
    } catch {
      return textResponse("Internal server error", 500);
    }
  },
};

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function getLookup(hostname: string, pathname: string): { kind: LinkKind; key: string } | null {
  if (hostname === APEX_HOST) return { kind: "path", key: pathname };
  if (!hostname.endsWith(`.${APEX_HOST}`)) return null;

  const label = hostname.slice(0, -APEX_HOST.length - 1);
  if (!label || label.includes(".") || !isSubdomainKey(label)) return null;
  return { kind: "subdomain", key: label };
}

async function handleAdmin(request: Request, env: AppEnv, url: URL): Promise<Response> {
  if (url.pathname === "/admin" && request.method === "GET") {
    if (!(await hasValidSession(request, env))) return loginPage();
    return listPage(env);
  }

  if (url.pathname === "/admin/login" && request.method === "POST") {
    return login(request, env);
  }

  if (!(await hasValidSession(request, env))) return loginPage();

  if (url.pathname === "/admin/logout" && request.method === "POST") {
    return redirectResponse("/admin", `${SESSION_COOKIE}=; Max-Age=0; Path=/admin; HttpOnly; Secure; SameSite=Lax`);
  }

  if (url.pathname === "/admin/links" && request.method === "POST") {
    return createLink(request, env);
  }

  const editMatch = url.pathname.match(/^\/admin\/links\/(\d+)$/);
  if (editMatch && request.method === "POST") return updateLink(request, env, Number(editMatch[1]));

  const deleteMatch = url.pathname.match(/^\/admin\/links\/(\d+)\/delete$/);
  if (deleteMatch && request.method === "POST") return deleteLink(request, env, Number(deleteMatch[1]));

  return textResponse("Not found", 404);
}

async function login(request: Request, env: AppEnv): Promise<Response> {
  const form = await readFormData(request);
  if (!form) return loginPage("Invalid form data", 400);
  const password = String(form.get("password") ?? "");
  if (!env.ADMIN_PASSWORD || !(await timingSafeStringEqual(password, env.ADMIN_PASSWORD))) {
    return loginPage("Invalid password", 401);
  }

  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${expires}`;
  const signature = await sign(payload, env.ADMIN_PASSWORD);
  const cookie = `${SESSION_COOKIE}=${payload}.${signature}; Max-Age=${SESSION_TTL_SECONDS}; Path=/admin; HttpOnly; Secure; SameSite=Lax`;
  return redirectResponse("/admin", cookie);
}

async function hasValidSession(request: Request, env: AppEnv): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token) return false;

  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || !signature) return false;
  return timingSafeStringEqual(signature, await sign(expiresText, env.ADMIN_PASSWORD));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
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
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function createLink(request: Request, env: AppEnv): Promise<Response> {
  const input = await readLinkInput(request);
  if ("error" in input) return listPage(env, input.error, 400);

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO links (kind, key, destination, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
    )
      .bind(input.kind, input.key, input.destination, now)
      .run();
    return redirectResponse("/admin");
  } catch (error) {
    if (isUniqueConstraintError(error)) return listPage(env, "That short link already exists", 409);
    return textResponse("Internal server error", 500);
  }
}

async function updateLink(request: Request, env: AppEnv, id: number): Promise<Response> {
  const input = await readLinkInput(request);
  if ("error" in input) return listPage(env, input.error, 400);

  try {
    const result = await env.DB.prepare(
      "UPDATE links SET kind = ?1, key = ?2, destination = ?3, updated_at = ?4 WHERE id = ?5",
    )
      .bind(input.kind, input.key, input.destination, new Date().toISOString(), id)
      .run();
    if (!result.meta.changes) return textResponse("Not found", 404);
    return redirectResponse("/admin");
  } catch (error) {
    if (isUniqueConstraintError(error)) return listPage(env, "That short link already exists", 409);
    return textResponse("Internal server error", 500);
  }
}

async function deleteLink(request: Request, env: Env, id: number): Promise<Response> {
  if (request.method !== "POST") return textResponse("Method not allowed", 405);
  const result = await env.DB.prepare("DELETE FROM links WHERE id = ?1").bind(id).run();
  if (!result.meta.changes) return textResponse("Not found", 404);
  return redirectResponse("/admin");
}

async function readLinkInput(request: Request): Promise<LinkInput | { error: string }> {
  const form = await readFormData(request);
  if (!form) return { error: "Invalid form data" };
  const rawKind = String(form.get("kind") ?? "");
  const rawKey = String(form.get("key") ?? "").trim();
  const destination = String(form.get("destination") ?? "").trim();
  if (rawKind !== "path" && rawKind !== "subdomain") return { error: "Choose a valid link type" };
  if (!rawKey) return { error: "Enter a valid short-link key" };
  const kind = rawKind as LinkKind;
  const key = kind === "path" ? normalizePathKey(rawKey) : rawKey.toLowerCase();
  if (!key || (kind === "path" ? !isPathKey(key) : !isSubdomainKey(key))) {
    return { error: "Enter a valid short-link key" };
  }
  if (kind === "path" && (key === "/" || key === "/admin" || key.startsWith("/admin/"))) {
    return { error: "The root and /admin routes are reserved" };
  }
  if (!isDestination(destination)) return { error: "Destination must be an absolute HTTP or HTTPS URL" };
  return { kind, key, destination };
}

async function readFormData(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

function normalizePathKey(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function isPathKey(value: string): boolean {
  return value.length <= 2048 && /^\/[\S]*$/.test(value) && !value.includes("?") && !value.includes("#");
}

function isSubdomainKey(value: string): boolean {
  return value.length <= 63 && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

function isDestination(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}

async function listPage(env: AppEnv, error?: string, status = 200): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      "SELECT id, kind, key, destination, created_at, updated_at FROM links ORDER BY kind, key",
    ).all<Link>();
    return htmlResponse(renderAdmin(result.results, error), status);
  } catch {
    return textResponse("Internal server error", 500);
  }
}

function loginPage(error?: string, status = 200): Response {
  return htmlResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>foss.gg admin</title>${styles()}</head><body><main><h1>foss.gg admin</h1>${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}<form method="post" action="/admin/login"><label>Password <input type="password" name="password" autocomplete="current-password" required></label><button>Log in</button></form></main></body></html>`,
    status,
  );
}

function landingPage(): Response {
  return htmlResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Clean path and subdomain redirects on foss.gg.">
  <title>foss.gg — URLs, cut clean</title>
  <style>
    :root{--paper:#f3efe5;--surface:#fffdf7;--ink:#172117;--muted:#586458;--line:#c9cec3;--accent:#c8ff5a;--accent-ink:#213800;--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:24px;--space-6:32px;--space-7:48px;--space-8:64px;--space-9:96px;--radius:18px;--shadow:0 18px 50px rgba(23,33,23,.1)}
    *{box-sizing:border-box}
    html{background:var(--paper)}
    body{min-width:320px;min-height:100svh;margin:0;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 85% 12%,rgba(200,255,90,.42),transparent 27rem),linear-gradient(rgba(23,33,23,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(23,33,23,.045) 1px,transparent 1px),var(--paper);background-size:auto,32px 32px,32px 32px,auto}
    a{color:inherit}
    a:focus-visible{outline:3px solid var(--ink);outline-offset:4px}
    .shell{width:min(1180px,calc(100% - 48px));min-height:100svh;margin:auto;display:grid;grid-template-rows:auto 1fr auto}
    .site-header{min-height:88px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}
    .brand{display:inline-flex;align-items:center;gap:var(--space-3);font:700 18px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none;letter-spacing:-.03em}
    .brand-mark{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:var(--ink);color:var(--accent);font-size:18px}
    .admin-link{min-height:44px;display:inline-flex;align-items:center;gap:var(--space-2);font-size:14px;font-weight:700;text-underline-offset:4px}
    main{padding:var(--space-9) 0 var(--space-8)}
    .hero{display:grid;grid-template-columns:minmax(0,1fr) 300px;align-items:end;gap:var(--space-8)}
    .eyebrow{display:flex;align-items:center;gap:var(--space-2);margin:0 0 var(--space-5);font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}
    .eyebrow::before{content:"";width:9px;height:9px;border-radius:50%;background:#4f7f00;box-shadow:0 0 0 5px rgba(79,127,0,.13)}
    h1{max-width:850px;margin:0;font-size:clamp(56px,9vw,112px);line-height:.88;letter-spacing:-.075em;font-weight:820}
    h1 em{color:#4a7700;font-family:Georgia,"Times New Roman",serif;font-weight:400}
    .hero-copy{max-width:34rem}
    .lede{max-width:29rem;margin:var(--space-6) 0;color:var(--muted);font-size:clamp(18px,2vw,22px);line-height:1.55}
    .cta{min-height:52px;display:inline-flex;align-items:center;gap:var(--space-3);padding:0 var(--space-5);border:2px solid var(--ink);border-radius:999px;background:var(--accent);color:var(--accent-ink);font-weight:800;text-decoration:none;box-shadow:5px 5px 0 var(--ink)}
    .cta:hover{box-shadow:2px 2px 0 var(--ink);transform:translate(3px,3px)}
    .signal{aspect-ratio:1;display:grid;place-items:center;position:relative;border-radius:50%;background:var(--ink);color:var(--accent);box-shadow:var(--shadow)}
    .signal-arrow{font-size:clamp(88px,12vw,150px);font-weight:300;line-height:1;transform:translateY(-5px)}
    .signal-code{position:absolute;right:10%;bottom:12%;font:700 14px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.15em}
    .examples{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-4);margin-top:var(--space-9)}
    .example{min-width:0;padding:var(--space-6);border:1px solid rgba(23,33,23,.18);border-radius:var(--radius);background:rgba(255,253,247,.88);box-shadow:0 8px 24px rgba(23,33,23,.06)}
    .example-meta{display:flex;justify-content:space-between;gap:var(--space-4);margin-bottom:var(--space-7);color:var(--muted);font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.1em}
    .example code{display:block;overflow-wrap:anywhere;font:700 clamp(22px,3vw,34px)/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:-.05em}
    .example p{margin:var(--space-4) 0 0;color:var(--muted);font-size:15px;line-height:1.6}
    .site-footer{min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);border-top:1px solid var(--line);color:var(--muted);font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
    @media(max-width:760px){.shell{width:min(100% - 32px,1180px)}.site-header{min-height:72px}main{padding:var(--space-8) 0}.hero{grid-template-columns:1fr;gap:var(--space-7)}.signal{width:min(64vw,240px);justify-self:end}.examples{grid-template-columns:1fr;margin-top:var(--space-8)}.example-meta{margin-bottom:var(--space-6)}.site-footer{padding:var(--space-5) 0;align-items:flex-start;flex-direction:column}}
    @media(max-width:420px){.admin-link span{display:none}h1{font-size:54px}.example{padding:var(--space-5)}}
  </style>
</head>
<body>
  <div class="shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="foss.gg home"><span class="brand-mark" aria-hidden="true">↗</span>foss.gg</a>
      <a class="admin-link" href="/admin">Manage links <span aria-hidden="true">→</span></a>
    </header>
    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow">Cloudflare-powered redirects</p>
          <h1 id="hero-title">URLs,<br><em>cut clean.</em></h1>
          <p class="lede">Turn a path or subdomain into one clean hop to wherever you need to go.</p>
          <a class="cta" href="/admin">Manage links <span aria-hidden="true">→</span></a>
        </div>
        <div class="signal" aria-hidden="true"><span class="signal-arrow">→</span><span class="signal-code">302</span></div>
      </section>
      <section class="examples" aria-label="Supported link formats">
        <article class="example">
          <div class="example-meta"><span>01 / path</span><span>one domain</span></div>
          <code>foss.gg/project</code>
          <p>Keep the domain. Give the destination a short route.</p>
        </article>
        <article class="example">
          <div class="example-meta"><span>02 / subdomain</span><span>one word</span></div>
          <code>project.foss.gg</code>
          <p>Put the memorable part first. The redirect works from every path.</p>
        </article>
      </section>
    </main>
    <footer class="site-footer"><span>Built on Cloudflare Workers + D1</span><span>foss.gg / 2026</span></footer>
  </div>
</body>
</html>`);
}

function renderAdmin(links: Link[], error?: string): string {
  const rows = links
    .map(
      (link) =>
        `<li><form method="post" action="/admin/links/${link.id}"><select name="kind"><option value="path"${link.kind === "path" ? " selected" : ""}>Path</option><option value="subdomain"${link.kind === "subdomain" ? " selected" : ""}>Subdomain</option></select><input name="key" value="${escapeHtml(link.key)}" required><input type="url" name="destination" value="${escapeHtml(link.destination)}" required><button>Save</button></form><form method="post" action="/admin/links/${link.id}/delete"><button class="danger">Delete</button></form></li>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>foss.gg links</title>${styles()}</head><body><main><header><h1>foss.gg links</h1><form method="post" action="/admin/logout"><button>Log out</button></form></header>${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}<section><h2>New link</h2><form method="post" action="/admin/links"><select name="kind"><option value="path">Path</option><option value="subdomain">Subdomain</option></select><input name="key" placeholder="/example or example" required><input type="url" name="destination" placeholder="https://example.com" required><button>Add link</button></form></section><section><h2>Saved links</h2><ul>${rows || "<li>No links yet</li>"}</ul></section></main></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function styles(): string {
  return `<style>body{font:16px system-ui;margin:0;background:#f4f4f5;color:#18181b}main{max-width:1000px;margin:3rem auto;padding:0 1rem}header,form{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}header{justify-content:space-between}section{background:#fff;padding:1rem;margin:1rem 0;border-radius:.5rem}input,select,button{font:inherit;padding:.45rem}input[name=destination]{min-width:22rem}ul{list-style:none;padding:0}li{display:flex;gap:.6rem;align-items:center;margin:.6rem 0}.error{color:#b91c1c}.danger{color:#b91c1c}@media(max-width:700px){li{align-items:stretch;flex-direction:column}input[name=destination]{min-width:0;width:100%}}</style>`;
}

function redirectResponse(location: string, setCookie?: string): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(null, { status: 303, headers });
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=UTF-8" } });
}
