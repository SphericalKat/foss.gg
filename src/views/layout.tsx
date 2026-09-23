import { raw } from "hono/html";
import type { FC, PropsWithChildren } from "hono/jsx";

import { APEX_HOST } from "../request-host";
import type { Session } from "../types";

import adminStyles from "./admin.css";

export const ADMIN_SCRIPT_PATH = "/admin/admin.js";

type PageLayoutProps = PropsWithChildren<{
  title: string;
  session?: Session;
  withScript?: boolean;
}>;

export const PageLayout: FC<PageLayoutProps> = ({
  title,
  session,
  withScript,
  children,
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>{title}</title>
      <style>{raw(adminStyles)}</style>
      {withScript && <script src={ADMIN_SCRIPT_PATH} defer />}
    </head>
    <body>
      <div class="wrap">
        <header class="site-header">
          <a class="brand" href={`https://${APEX_HOST}/`}>
            {APEX_HOST}
          </a>
          {session && (
            <div class="whoami">
              <span>
                <span class="full">Signed in as </span>
                <strong>{session.username}</strong>
              </span>
              <form method="post" action="/admin/logout">
                <button type="submit" class="link-btn">
                  Log out
                </button>
              </form>
            </div>
          )}
        </header>
        {children}
      </div>
    </body>
  </html>
);
