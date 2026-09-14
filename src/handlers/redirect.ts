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
): { kind: LinkKind; key: string; fallbackKey: string | null } | null => {
  if (hostname === APEX_HOST) {
    return { fallbackKey: null, key: pathname, kind: "path" };
  }
  if (!hostname.endsWith(`.${APEX_HOST}`)) {
    return null;
  }

  const label = hostname.slice(0, -APEX_HOST.length - 1);
  if (!label || label.includes(".") || !isSubdomainKey(label)) {
    return null;
  }
  if (pathname === "/") {
    return { fallbackKey: null, key: label, kind: "subdomain" };
  }
  return { fallbackKey: label, key: `${label}${pathname}`, kind: "subdomain" };
};

const getEffectiveHostname = (request: Request): string => {
  const url = new URL(request.url);
  const override = url.searchParams.get("__host");
  if (override) {
    return normalizeHostname(override.split(":")[0] ?? "");
  }
  const xHost =
    request.headers.get("x-host") ?? request.headers.get("x-forwarded-host");
  if (xHost) {
    return normalizeHostname(xHost.split(":")[0] ?? "");
  }
  const urlHostname = normalizeHostname(url.hostname);
  const hostHeader = request.headers.get("host");
  if (hostHeader) {
    const headerHostname = normalizeHostname(hostHeader.split(":")[0] ?? "");
    if (
      headerHostname === APEX_HOST ||
      headerHostname.endsWith(`.${APEX_HOST}`)
    ) {
      return headerHostname;
    }
  }
  return urlHostname;
};

export const isApexRequest = (request: Request): boolean =>
  getEffectiveHostname(request) === APEX_HOST;

export const handleRedirect = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const url = new URL(context.req.url);
  const lookup = getLookup(getEffectiveHostname(context.req.raw), url.pathname);
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
