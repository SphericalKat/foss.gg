import type { FC } from "hono/jsx";

import { APEX_HOST } from "../config/site";
import { PageLayout } from "./layout";

export const NotFoundPage: FC<{ requested: string }> = ({ requested }) => (
  <PageLayout title="Link not found · foss.gg">
    <main class="center">
      <div class="not-found">
        <h1>Link not found</h1>
        <p>
          <code>{requested}</code> doesn&apos;t point anywhere. Check the
          spelling, or the link may have been removed.
        </p>
        <a href={`https://${APEX_HOST}/`}>Go to {APEX_HOST}</a>
      </div>
    </main>
  </PageLayout>
);
