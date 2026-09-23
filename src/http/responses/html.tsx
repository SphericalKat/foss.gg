import type { Context } from "hono";

import type { AuditEntry, Link } from "../../domain/link";
import type { Session } from "../../domain/session";
import type { UserSummary } from "../../domain/user";
import { AdminPage } from "../../views/admin";
import type { ErrorContext, LinkDraft, Notice } from "../../views/admin";
import { shortUrl } from "../../views/format";
import { LandingPage } from "../../views/landing";
import { LoginPage } from "../../views/login";
import { NotFoundPage } from "../../views/not-found";
import type { AppBindings } from "../bindings";

export const renderLogin = (
  context: Context<AppBindings>,
  error?: string,
  status: 200 | 400 | 401 = 200
): Response | Promise<Response> => {
  context.status(status);
  return context.render(<LoginPage error={error} />);
};

const noticeFromQuery = (
  query: Record<string, string>,
  links: Link[],
  users: UserSummary[]
): Notice | undefined => {
  const created = links.find(
    (link) => link.kind === query.kind && link.key === query.created
  );
  if (created) {
    const parent = created.kind === "subdomain" && !created.key.includes("/");
    return {
      action: parent
        ? {
            href: `/admin?domain=${encodeURIComponent(created.key)}#new-link`,
            text: `Add a path to ${shortUrl(created.kind, created.key)}`,
          }
        : undefined,
      code: shortUrl(created.kind, created.key),
      text: "Created",
    };
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

export const renderAdminPage = (
  context: Context<AppBindings>,
  data: {
    links: Link[];
    audit: AuditEntry[];
    users: UserSummary[];
    session: Session;
    now: number;
    error?: string;
    errorContext?: ErrorContext;
    draft?: LinkDraft;
    prefillDomain?: string;
  }
): Response | Promise<Response> =>
  context.render(
    <AdminPage
      links={data.links}
      audit={data.audit}
      users={data.users}
      session={data.session}
      now={data.now}
      error={data.error}
      errorContext={data.errorContext}
      draft={data.draft}
      prefillDomain={data.prefillDomain}
      notice={
        data.error
          ? undefined
          : noticeFromQuery(context.req.query(), data.links, data.users)
      }
    />
  );

export const renderNotFound = (
  context: Context<AppBindings>,
  requested: string
): Response | Promise<Response> => {
  context.status(404);
  return context.render(<NotFoundPage requested={requested} />);
};

export const renderLanding = (
  context: Context<AppBindings>
): Response | Promise<Response> => context.render(<LandingPage />);
