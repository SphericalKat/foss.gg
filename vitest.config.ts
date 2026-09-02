import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: { globals: true, setupFiles: ["./test/apply-migrations.ts"] },
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          ADMIN_PASSWORD: "test-password",
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
        d1Databases: ["DB"],
      },
    })),
  ],
});
