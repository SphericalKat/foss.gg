import type { Context } from "hono";

import type { AppBindings } from "../bindings";
import { listAuditEntries, listLinks } from "../models/links";
import { listUsers } from "../models/users";
import type { Session, UserSummary } from "../types";
import { AdminPage } from "../views/admin";
import { LoginPage } from "../views/login";

export const renderLogin = (
  context: Context<AppBindings>,
  error?: string,
  status: 200 | 400 | 401 = 200
): Response | Promise<Response> => {
  context.status(status);
  return context.render(<LoginPage error={error} />);
};

export const listPage = async (
  context: Context<AppBindings>,
  session: Session,
  error?: string,
  status: 200 | 400 | 409 = 200
): Promise<Response> => {
  try {
    const [links, audit, users] = await Promise.all([
      listLinks(context.env.DB),
      listAuditEntries(context.env.DB),
      session.isAdmin
        ? listUsers(context.env.DB)
        : Promise.resolve<UserSummary[]>([]),
    ]);
    context.status(status);
    return context.render(
      <AdminPage
        links={links}
        audit={audit}
        users={users}
        session={session}
        error={error}
      />
    );
  } catch {
    return context.text("Internal server error", 500);
  }
};
