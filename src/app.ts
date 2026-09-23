import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";

import type { AppBindings } from "./http/bindings";
import { handleRedirect } from "./http/controllers/redirect";
import { htmlSecurityHeaders } from "./http/middleware/security-headers";
import { isApexRequest } from "./http/requests/link-lookup";
import { renderLanding } from "./http/responses/html";
import { adminRoutes } from "./http/routes/admin";

const app = new Hono<AppBindings>();

app.use("*", jsxRenderer());
app.use("*", htmlSecurityHeaders);
app.use("*", async (context, next) => {
  if (!isApexRequest(context.req.raw)) {
    return handleRedirect(context);
  }
  return await next();
});

app.on(["GET", "HEAD"], "/", (context) => renderLanding(context));
app.route("/admin", adminRoutes);
app.all("*", handleRedirect);

export default app;
