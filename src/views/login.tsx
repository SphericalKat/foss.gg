import type { FC } from "hono/jsx";
import { AdminLayout } from "./layout";

export const LoginPage: FC<{ error?: string }> = ({ error }) => (
  <AdminLayout title="foss.gg admin">
    <h1>foss.gg admin</h1>
    {error && <p class="error">{error}</p>}
    <form method="post" action="/admin/login">
      <label>
        Username <input name="username" autocomplete="username" required />
      </label>
      <label>
        Password <input type="password" name="password" autocomplete="current-password" required />
      </label>
      <button>Log in</button>
    </form>
  </AdminLayout>
);
