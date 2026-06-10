# Cloudflare in front of ffxivlog.com — setup runbook

Goal (from the roadmap): bot protection + rate limiting at the edge, before
traffic ever reaches Vercel/Railway. Everything below is on Cloudflare's
**free** plan unless marked otherwise. These are account-level steps only you
can do; the one code change needed afterwards is listed at the bottom.

## 1. Add the domain
1. Cloudflare dashboard → Add site → `ffxivlog.com` → Free plan.
2. Cloudflare imports existing DNS records. Verify it picked up:
   - `ffxivlog.com` + `www` → Vercel (A `76.76.21.21` / CNAME `cname.vercel-dns.com`)
   - `api` → Railway CNAME (whatever `api.ffxivlog.com` currently points to)
3. At your registrar, switch nameservers to the two Cloudflare gives you.
   (DNS propagates in minutes-to-hours; the site keeps working throughout.)
4. Set the cloud icons: **proxied (orange)** for `ffxivlog.com`, `www`, and `api`.

> Vercel note: when Cloudflare proxies the apex, Vercel may warn about domain
> verification. In Cloudflare → SSL/TLS set mode to **Full (strict)** — both
> Vercel and Railway provision their own certs, so strict works and avoids
> redirect loops.

## 2. Bot protection (free)
- Security → Bots → enable **Bot Fight Mode**.
- Security → Settings → Security Level: Medium.

## 3. Rate limiting & firewall rules (free tier includes 1 rate-limiting rule)
Use the single free rate rule where it matters most:
- **Rule: AI burst guard** — When URI Path starts with `/api/ai/` → more than
  10 requests / 1 minute per IP → Block for 1 hour.
  (The app already enforces 20/hour/user after login; this stops anonymous
  hammering before it costs anything.)

Free custom firewall rules (up to 5) worth adding:
- Block requests to `api.ffxivlog.com` whose `cf.client.bot` is true and not a
  verified bot.
- Challenge (Managed Challenge) requests with empty User-Agent.

## 4. Optional / later
- **WAF managed rules** (OWASP etc.) need the Pro plan — the app survived a
  SQL-injection/XSS audit, so this is defense-in-depth, not urgent.
- **Turnstile CAPTCHA** for guest-facing AI: not currently needed because the
  AI endpoint requires Discord login. Revisit if guest AI access ever opens.
- **Cache rules**: Cloudflare will automatically cache the Vercel static
  assets; `/api/recipes` already sends `Cache-Control: public, max-age=300`
  and will benefit at the edge with no extra config.

## 5. The one code change (after `api` is proxied)
`backend/index.js` sets `app.set('trust proxy', 1)` — one hop (Railway's
proxy). With Cloudflare in front there are **two** hops, so `req.ip` would
become Cloudflare's IP and the per-IP Lodestone rate limit would lump all
users together. After flipping the orange cloud on `api`, change it to:

```js
app.set('trust proxy', 2); // Cloudflare → Railway proxy → app
```

(or use the `CF-Connecting-IP` header). Deploy that in the same hour you
proxy the API subdomain.

## 6. Verify
- `curl -sI https://ffxivlog.com | grep -i server` → `server: cloudflare`
- Site loads, Discord login round-trips, AI search works while logged in.
- `curl -s https://api.ffxivlog.com/health` → `{"status":"ok"}`
