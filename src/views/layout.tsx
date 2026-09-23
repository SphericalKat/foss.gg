import { raw } from "hono/html";
import type { FC, PropsWithChildren } from "hono/jsx";

const adminStyles = `
body{font:16px system-ui;margin:0;background:#f4f4f5;color:#18181b}
main{max-width:1000px;margin:3rem auto;padding:0 1rem}
header,form{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}
header{justify-content:space-between}
h1{margin-bottom:.2rem}
section{background:#fff;padding:1rem;margin:1rem 0;border-radius:.5rem}
input,select,button{font:inherit;padding:.45rem}
input[name=destination]{min-width:22rem}
ul{list-style:none;padding:0}
li{display:flex;gap:.6rem;align-items:center;margin:.6rem 0}
.link-row{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin:.6rem 0}
.link-edit{flex:1 1 480px;display:flex;gap:.6rem;align-items:center;flex-wrap:nowrap;min-width:0}
.link-edit input[name=key]{flex:0 1 14rem;min-width:8rem}
.link-edit input[name=destination]{flex:1 1 16rem;min-width:12rem}
.link-delete{flex-shrink:0}
small,time{color:#71717a;font-size:.8rem}
.link-row small{white-space:nowrap}
.activity li{align-items:baseline;flex-wrap:wrap}
.error{color:#b91c1c}
.danger{color:#b91c1c}
@media(max-width:700px){li,.link-row{align-items:stretch;flex-direction:column}input[name=destination]{min-width:0;width:100%}.link-edit{flex-wrap:wrap}.link-edit input[name=key],.link-edit input[name=destination]{flex:1 1 100%;min-width:0}.link-row small{white-space:normal}}
`;

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
