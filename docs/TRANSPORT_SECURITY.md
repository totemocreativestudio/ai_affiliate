# Lumaway Transport Security

## Web SSL/TLS

Lumaway Production is hosted on Vercel. The public domains `lumaway.online` and `www.lumaway.online` use Vercel-managed HTTPS/TLS certificates with automatic renewal. Do not upload a manual certificate unless Vercel certificate management explicitly requires one.

## Resend / Supabase Auth SMTP

Secure email transport uses:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key stored in Supabase Vault
- Transport: SMTPS / SSL-TLS

The Resend API key must never be stored in browser code, Git, screenshots, or public environment variables.

## SSH

Lumaway's Next.js production application runs on Vercel serverless infrastructure. It does not expose an SSH daemon and does not require SSH for deployment. GitHub-to-Vercel deployment uses the connected Git integration.

Supabase access also uses HTTPS/TLS/PostgreSQL TLS rather than SSH.

If a separate Hostinger VPS is later used, configure SSH only on that VPS:
- key-based authentication only;
- disable password login after key verification;
- never commit the private key;
- restrict source IPs where practical;
- use a non-root deployment user;
- keep server security updates enabled.

Do not add an SSH private key to Lumaway/Vercel unless there is a concrete external server that requires outbound SSH.
