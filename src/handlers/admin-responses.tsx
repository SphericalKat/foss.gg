import type { Context } from "hono";

import type { AppBindings } from "../bindings";
import { listAuditEntries, listLinks } from "../models/links";
import { listUsers } from "../models/users";
import type { Link, Session, UserSummary } from "../types";
import { AdminPage } from "../views/admin";
import type { Notice } from "../views/admin";
import { shortUrl } from "../views/format";
import { LoginPage } from "../views/login";

export const renderLogin = (
  context: Context<AppBindings>,
  error?: string,
  status: 200 | 400 | 401 = 200
): Response | Promise<Response> => {
  context.status(status);
  return context.render(<LoginPage error={error} />);
};

// Notices only echo links and users that exist, so a crafted query string can't put arbitrary text on the page.
const noticeFromQuery = (
  query: Record<string, string>,
  links: Link[],
  users: UserSummary[]
): Notice | undefined => {
  const created = links.find(
    (link) => link.kind === query.kind && link.key === query.created
  );
  if (created) {
    return { code: shortUrl(created.kind, created.key), text: "Created" };
  }
  const saved = links.find((link) => String(link.id) === query.saved);
  if (saved) {
    return { code: shortUrl(saved.kind, saved.key), text: "Saved" };
  }
  if (query.deleted) {
    return { text: "Link deleted" };
  }
  const user = users.find(({ username }) => username === query.user);
  return user ? { code: user.username, text: "Added user" } : undefined;
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
        now={Date.now()}
        error={error}
        notice={
          error ? undefined : noticeFromQuery(context.req.query(), links, users)
        }
      />
    );
  } catch {
    return context.text("Internal server error", 500);
  }
};
