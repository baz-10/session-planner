# Codex Project Instructions

## GitHub and Vercel Deployments

Vercel deploys this project from the `main` branch on GitHub.

Before committing or pushing deployment work, verify the local Git author identity:

```bash
git config user.name
git config user.email
```

Use the GitHub no-reply identity for this repository:

```bash
git config --local user.name "baz-10"
git config --local user.email "61862746+baz-10@users.noreply.github.com"
```

This avoids GitHub push rejections caused by commits exposing a private Gmail
address.

## Deployment Safety

- Run a production build before pushing to `main` when code changes affect the app:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy npm run build
```

- Keep unrelated local changes out of deployment commits. This repository may have
  active work in progress, so stage only the files that belong to the requested
  change.
- After pushing `main`, check the Vercel deployment status and confirm the
  deployment is `READY`.
