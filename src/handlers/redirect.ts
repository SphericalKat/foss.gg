import type { Context } from "hono";

import type { AppBindings } from "../session";
import { isSubdomainLabel, splitSubdomainKey } from "../subdomain-key";

const APEX_HOST = "foss.gg";

type LinkKind = "path" | "subdomain";

interface Link {
  destination: string;
}

const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/\.$/u, "");

const getLookup = (
  hostname: string,
  pathname: string
): { kind: LinkKind; key: string; fallbackKey: string | null } | null => {
  if (hostname === APEX_HOST) {
    return { fallbackKey: null, key: pathname, kind: "path" };
  }
  if (!hostname.endsWith(`.${APEX_HOST}`)) {
    return null;
  }

  const label = hostname.slice(0, -APEX_HOST.length - 1);
  if (!label || label.includes(".") || !isSubdomainLabel(label)) {
    return null;
  }
  const trimmedPathname = pathname.replace(/\/+$/u, "");
  const { path } = splitSubdomainKey(`${label}${trimmedPathname}`);
  return path
    ? { fallbackKey: label, key: `${label}${path}`, kind: "subdomain" }
    : { fallbackKey: null, key: label, kind: "subdomain" };
};

const getRequestHostname = (request: Request): string =>
  normalizeHostname(new URL(request.url).hostname);

export const isApexRequest = (request: Request): boolean =>
  getRequestHostname(request) === APEX_HOST;

export const handleRedirect = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const url = new URL(context.req.url);
  const lookup = getLookup(getRequestHostname(context.req.raw), url.pathname);
  if (!lookup) {
    return context.text("Not found", 404);
  }

  const findLink = (key: string): Promise<Link | null> =>
    context.env.DB.prepare(
      "SELECT destination FROM links WHERE kind = ?1 AND key = ?2"
    )
      .bind(lookup.kind, key)
      .first<Link>();

  try {
    const link =
      (await findLink(lookup.key)) ??
      (lookup.fallbackKey ? await findLink(lookup.fallbackKey) : null);

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
