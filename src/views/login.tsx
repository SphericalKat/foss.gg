import type { FC } from "hono/jsx";

import { PageLayout } from "./layout";

export const LoginPage: FC<{ error?: string }> = ({ error }) => (
  <PageLayout title="Sign in · foss.gg">
    <main class="center">
      <form class="login" method="post" action="/admin/login">
        <h1>Sign in</h1>
        {error && (
          <p class="error-text" role="alert">
            {error}
          </p>
        )}
        <label for="login-username">
          Username
          <input
            class="field"
            id="login-username"
            name="username"
            autocomplete="username"
            required
          />
        </label>
        <label for="login-password">
          Password
          <input
            class="field"
            id="login-password"
            type="password"
            name="password"
            autocomplete="current-password"
            required
          />
        </label>
        <button type="submit" class="btn">
          Sign in
        </button>
      </form>
    </main>
  </PageLayout>
);
