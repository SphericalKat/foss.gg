import { raw } from "hono/html";
import type { FC, PropsWithChildren } from "hono/jsx";

import { adminStyles } from "./styles";

type AdminLayoutProps = PropsWithChildren<{ title: string }>;

export const AdminLayout: FC<AdminLayoutProps> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>{title}</title>
      <style>{raw(adminStyles)}</style>
    </head>
    <body>
      <main>{children}</main>
    </body>
  </html>
);
