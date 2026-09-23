import type { Context } from "hono";

import { resolveLink } from "../../services/links";
import type { AppBindings } from "../bindings";
import { getLookup, getRequestHostname } from "../requests/link-lookup";
import { renderNotFound } from "../responses/html";

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
    const link = await resolveLink(
      context.env.DB,
      lookup.kind,
      lookup.key,
      lookup.fallbackKey
    );
    if (link) {
      return new Response(null, {
        headers: { Location: link.destination },
        status: 302,
      });
    }
    return renderNotFound(context, `${hostname}${url.pathname}`);
  } catch {
    return context.text("Internal server error", 500);
  }
};
