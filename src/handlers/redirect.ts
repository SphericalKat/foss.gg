import type { Context } from "hono";

import type { AppBindings } from "../session";

const APEX_HOST = "foss.gg";

type LinkKind = "path" | "subdomain";

interface Link {
  destination: string;
}

const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/\.$/u, "");

const isSubdomainKey = (value: string): boolean =>
  value.length <= 63 && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(value);

const getLookup = (
  hostname: string,
  pathname: string
): { kind: LinkKind; key: string } | null => {
  if (hostname === APEX_HOST) {
    return { key: pathname, kind: "path" };
  }
  if (!hostname.endsWith(`.${APEX_HOST}`)) {
    return null;
  }

  const label = hostname.slice(0, -APEX_HOST.length - 1);
  if (!label || label.includes(".") || !isSubdomainKey(label)) {
    return null;
  }
  return { key: label, kind: "subdomain" };
};

export const isApexRequest = (request: Request): boolean =>
  normalizeHostname(new URL(request.url).hostname) === APEX_HOST;

export const handleRedirect = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const url = new URL(context.req.url);
  const lookup = getLookup(normalizeHostname(url.hostname), url.pathname);
  if (!lookup) {
    return context.text("Not found", 404);
  }

  try {
    const link = await context.env.DB.prepare(
      "SELECT destination FROM links WHERE kind = ?1 AND key = ?2"
    )
      .bind(lookup.kind, lookup.key)
      .first<Link>();

    return link
      ? new Response(null, {
          headers: { Location: link.destination },
          status: 302,
        })
      : context.text("Not found", 404);
  } catch {
    return context.text("Internal server error", 500);
  }
};
