import { raw } from "hono/html";
import type { FC } from "hono/jsx";

import { landingStyles } from "./styles";

export const LandingPage: FC = () => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta
        name="description"
        content="Clean path and subdomain redirects on foss.gg."
      />
      <title>foss.gg — URLs, cut clean</title>
      <style>{raw(landingStyles)}</style>
    </head>
    <body>
      <div class="shell">
        <header class="site-header">
          <a class="brand" href="/" aria-label="foss.gg home">
            <span class="brand-mark" aria-hidden="true">
              ↗
            </span>
            foss.gg
          </a>
          <a class="admin-link" href="/admin">
            Manage links <span aria-hidden="true">→</span>
          </a>
        </header>
        <main>
          <section class="hero" aria-labelledby="hero-title">
            <div class="hero-copy">
              <p class="eyebrow">Cloudflare-powered redirects</p>
              <h1 id="hero-title">
                URLs,
                <br />
                <em>cut clean.</em>
              </h1>
              <p class="lede">
                Turn a path or subdomain into one clean hop to wherever you need
                to go.
              </p>
              <a class="cta" href="/admin">
                Manage links <span aria-hidden="true">→</span>
              </a>
            </div>
            <div class="signal" aria-hidden="true">
              <span class="signal-arrow">→</span>
              <span class="signal-code">302</span>
            </div>
          </section>
          <section class="examples" aria-label="Supported link formats">
            <article class="example">
              <div class="example-meta">
                <span>01 / path</span>
                <span>one domain</span>
              </div>
              <code>foss.gg/project</code>
              <p>Keep the domain. Give the destination a short route.</p>
            </article>
            <article class="example">
              <div class="example-meta">
                <span>02 / subdomain</span>
                <span>one word</span>
              </div>
              <code>project.foss.gg</code>
              <p>
                Put the memorable part first. The redirect works from every
                path.
              </p>
            </article>
          </section>
        </main>
        <footer class="site-footer">
          <span>Built on Cloudflare Workers + D1</span>
          <span>foss.gg / 2026</span>
        </footer>
      </div>
    </body>
  </html>
);
