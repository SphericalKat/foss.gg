import type { Context } from "hono";
import type { AppBindings } from "../session";

const APEX_HOST = "foss.gg";

type LinkKind = "path" | "subdomain";

type Link = {
  destination: string;
};

export function isApexRequest(request: Request): boolean {
  return normalizeHostname(new URL(request.url).hostname) === APEX_HOST;
}

export async function handleRedirect(context: Context<AppBindings>): Promise<Response> {
  const url = new URL(context.req.url);
  const lookup = getLookup(normalizeHostname(url.hostname), url.pathname);
  if (!lookup) return context.text("Not found", 404);

  try {
    const link = await context.env.DB.prepare(
      "SELECT destination FROM links WHERE kind = ?1 AND key = ?2",
    )
      .bind(lookup.kind, lookup.key)
      .first<Link>();

    return link
      ? new Response(null, { status: 302, headers: { Location: link.destination } })
      : context.text("Not found", 404);
  } catch {
    return context.text("Internal server error", 500);
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function getLookup(hostname: string, pathname: string): { kind: LinkKind; key: string } | null {
  if (hostname === APEX_HOST) return { kind: "path", key: pathname };
  if (!hostname.endsWith(`.${APEX_HOST}`)) return null;

  const label = hostname.slice(0, -APEX_HOST.length - 1);
  if (!label || label.includes(".") || !isSubdomainKey(label)) return null;
  return { kind: "subdomain", key: label };
}

function isSubdomainKey(value: string): boolean {
  return value.length <= 63 && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}
