import { Hono } from "hono";
import { adminRoutes } from "./handlers/admin";
import { handleRedirect, isApexRequest } from "./handlers/redirect";
import { landingPage } from "./html";
import type { AppBindings } from "./session";

const app = new Hono<AppBindings>();

app.use("*", async (context, next) => {
  if (!isApexRequest(context.req.raw)) return handleRedirect(context);
  await next();
});

app.on(["GET", "HEAD"], "/", () => landingPage());
app.route("/admin", adminRoutes);
app.all("*", handleRedirect);

export default app;
