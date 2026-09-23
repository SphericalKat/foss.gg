import type { Context } from "hono";

import type { AppBindings } from "../bindings";
import { findLink } from "../models/links";
import { APEX_HOST, getRequestHostname } from "../request-host";
import { isSubdomainLabel, splitSubdomainKey } from "../subdomain-key";
import type { LinkKind } from "../types";
import { NotFoundPage } from "../views/not-found";

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

export const handleRedirect = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const url = new URL(context.req.url);
  const hostname = getRequestHostname(context.req.raw);
  const lookup = getLookup(hostname, url.pathname);
  if (!lookup) {
    return context.text("Not found", 404);
  }

  try {
    const link =
      (await findLink(context.env.DB, lookup.kind, lookup.key)) ??
      (lookup.fallbackKey
        ? await findLink(context.env.DB, lookup.kind, lookup.fallbackKey)
        : null);

    if (link) {
      return new Response(null, {
        headers: { Location: link.destination },
        status: 302,
      });
    }
    context.status(404);
    return context.render(
      <NotFoundPage requested={`${hostname}${url.pathname}`} />
    );
  } catch {
    return context.text("Internal server error", 500);
  }
};
