import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { adminRoutes } from "./handlers/admin";
import { handleRedirect, isApexRequest } from "./handlers/redirect";
import type { AppBindings } from "./session";
import { LandingPage } from "./views/landing";

const app = new Hono<AppBindings>();

app.use("*", jsxRenderer());

app.use("*", async (context, next) => {
  await next();
  if (context.res.headers.get("Content-Type")?.startsWith("text/html")) {
    context.res.headers.set("Cache-Control", "no-store");
    context.res.headers.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    );
    context.res.headers.set("X-Content-Type-Options", "nosniff");
  }
});

app.use("*", async (context, next) => {
  if (!isApexRequest(context.req.raw)) return handleRedirect(context);
  await next();
});

app.on(["GET", "HEAD"], "/", (context) => context.render(<LandingPage />));
app.route("/admin", adminRoutes);
app.all("*", handleRedirect);

export default app;
