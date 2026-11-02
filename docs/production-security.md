# Going live: security settings

Run this on the server, with its real settings, before every deploy. It prints what is wrong and never prints a secret:

```bash
NODE_ENV=production npm run prod:check
```

A line marked **FIX** blocks going live. **CHECK** is worth a look. **note** is an optional feature that is off.

## What it checks, and why

| Setting | Must be | Why |
|---|---|---|
| `NODE_ENV` | `production` | PM2 sets it from `ecosystem.config.js`. Anything else is treated as a development machine. |
| `JWT_SECRET` | 32+ random characters, not the sample | It signs every login. Only development and tests may use the built-in sample; a real server with no secret, or a short one, refuses to start signing. Make one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DB_PASSWORD` | long and random | `postgres123` is the local development password. |
| `CORS_ORIGIN` | unset, or your own address(es) | `*` lets any website call the API from a browser. Unset in production means no other website may. |
| `NEXT_PUBLIC_APP_URL` | `https://...` | The address people use. It must be HTTPS (see below). Set it before `npm run build`. |
| `SESSION_COOKIE_SECURE` | `true` once HTTPS works | The login cookie then never travels over plain HTTP. Never `false` on a live site. |
| `WEBSITE_API_KEY` | 32+ characters (if the public website is used) | The shared key between the website and the API. |
| `TRUST_PROXY` | `loopback` (default) | Which proxy is believed about a caller's address. The PIN lockout uses it. Behind nginx on the same machine, leave it. |

## HTTPS

Passwords and the login cookie are readable by anyone on the network while the site is served over plain `http://`.

1. Get a certificate for your address. On Cloudways, turn on the SSL certificate and "Force HTTPS redirection" in the panel. On a plain server, use nginx with certbot; `scripts/nginx-https.conf.example` is a ready starting point (HTTP redirects to HTTPS, and the proxy tells the app the request was HTTPS).
2. Set `NEXT_PUBLIC_APP_URL=https://your-address`, then `npm run build` and restart.
3. Set `SESSION_COOKIE_SECURE=true`.
4. Run `NODE_ENV=production npm run prod:check` again. The browsers then also honour the app's `Strict-Transport-Security` header (it has no effect over HTTP).

Do step 3 only after HTTPS works: with the Secure cookie on and the site still on HTTP, nobody can sign in.
