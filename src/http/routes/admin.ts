import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import {
  adminNotFound,
  createLink,
  createUser,
  deleteLink,
  login,
  logout,
  serveAdminScript,
  showAdmin,
  updateLink,
} from "../controllers/admin";
import { loadSession, requireSession } from "../middleware/session";

export const adminRoutes = new Hono<AppBindings>();

adminRoutes.get("/admin.js", serveAdminScript);
adminRoutes.use("*", loadSession);
adminRoutes.get("/", showAdmin);
adminRoutes.post("/login", login);
adminRoutes.use("*", requireSession);
adminRoutes.post("/logout", logout);
adminRoutes.post("/links", createLink);
adminRoutes.post("/users", createUser);
adminRoutes.post("/links/:id{[0-9]+}", updateLink);
adminRoutes.post("/links/:id{[0-9]+}/delete", deleteLink);
adminRoutes.all("*", adminNotFound);
