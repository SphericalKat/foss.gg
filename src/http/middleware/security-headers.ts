import type { MiddlewareHandler } from "hono";

import type { AppBindings } from "../bindings";

export const htmlSecurityHeaders: MiddlewareHandler<AppBindings> = async (
  context,
  next
) => {
  try {
    return await next();
  } finally {
    if (context.res.headers.get("Content-Type")?.startsWith("text/html")) {
      context.res.headers.set("Cache-Control", "no-store");
      const scriptSource = context.req.path.startsWith("/admin")
        ? "; script-src 'self'"
        : "";
      context.res.headers.set(
        "Content-Security-Policy",
        `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'${scriptSource}`
      );
      context.res.headers.set("X-Content-Type-Options", "nosniff");
    }
  }
};
