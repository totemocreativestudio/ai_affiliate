# Lumaway app subdomain migration

## Target

- Application: https://app.lumaway.online
- Landing page: https://www.lumaway.online
- Apex marketing URL: https://lumaway.online

## Application routing

The Next.js proxy already treats `app.lumaway.online` as the application host.

On the app host:
- `/` internally rewrites to the Lumaway login shell.
- `/dashboard`, `/upload`, `/database`, etc. internally rewrite to the legacy catch-all implementation without exposing `/app.lumaway` in the browser URL.
- `/web/*` redirects to `www.lumaway.online`.

On public hosts:
- requests to `/app.lumaway/*` redirect permanently to `https://app.lumaway.online/*`;
- application route segments such as `/dashboard` also redirect to the app subdomain.

## Vercel

Add `app.lumaway.online` to the Lumaway production project.

## Hostinger DNS

After Vercel provides the required DNS target, create only the exact record Vercel requests for host `app`. Do not modify Resend mail records, MX records, SPF, DKIM, or the existing apex/www records during this app-subdomain change.

## Verification

After DNS propagation:
1. https://app.lumaway.online -> Lumaway sign-in.
2. https://app.lumaway.online/dashboard -> authenticated dashboard.
3. https://www.lumaway.online -> marketing site.
4. https://www.lumaway.online/app.lumaway/login -> 308 to https://app.lumaway.online/login.
5. Google/Auth redirect URLs must allow https://app.lumaway.online paths used by the application.
