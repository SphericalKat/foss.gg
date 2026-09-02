# foss.gg

A small URL shortener for `foss.gg`, built with Cloudflare Workers and D1.

It supports two link formats:

- `foss.gg/example`
- `example.foss.gg`

Manage links at [foss.gg/admin](https://foss.gg/admin). Log in as `admin` with the configured admin password.

The admin can add users and set their passwords. Each account can edit or delete only its own links. The admin page shows the latest link activity.

## Development

Install the dependencies:

```sh
npm install
```

Create a local admin password:

```sh
printf 'ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 32)" > .dev.vars
```

Apply the D1 migration and start the Worker:

```sh
npx wrangler d1 migrations apply foss-gg-links --local
npx wrangler dev
```

Run the checks:

```sh
npm test
npm run check
```

## Deployment

Create the D1 database once:

```sh
npx wrangler d1 create foss-gg-links
```

Put the returned database ID in `wrangler.jsonc`. Then apply the migration and set the admin password:

```sh
npx wrangler d1 migrations apply foss-gg-links --remote
npx wrangler secret put ADMIN_PASSWORD
```

Deploy the Worker:

```sh
npx wrangler deploy
```

The Worker routes require these proxied Cloudflare DNS records:

| Type   | Name | Value   | Proxy status |
| ------ | ---- | ------- | ------------ |
| `AAAA` | `@`  | `100::` | Proxied      |
| `AAAA` | `*`  | `100::` | Proxied      |

`100::` is an originless placeholder. The Worker responds before Cloudflare contacts an origin.

## Link behavior

Known links return a temporary `302` redirect. Unknown links return `404`.

The Worker uses the saved destination exactly. It does not append the source path or query string.
