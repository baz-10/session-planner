# Session Planner - Deployment Checklist

## Status: Awaiting your input

### Completed
- [x] GitHub repo created: https://github.com/baz-10/session-planner
- [x] Build passes successfully
- [x] Supabase URL configured: `https://iqcpfxrxtnbjllwprfun.supabase.co`
- [x] Database migration ready: `supabase/migrations/00001_initial_schema.sql`
- [x] Vercel CLI installed

### Pending - Your Action Required

#### 1. Complete Vercel Login
A device authentication is in progress. Visit this URL:

```
https://vercel.com/oauth/device?user_code=ZBLN-XJXL
```

(Note: This code may expire. If it does, run `vercel login` to get a new one)

#### 2. Get Supabase Anon Key
1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/iqcpfxrxtnbjllwprfun/settings/api
2. Copy the `anon` / `public` key (starts with `eyJ...`)
3. Update `.env.local` - replace `PASTE_YOUR_ANON_KEY_HERE` with your key

#### 3. Run Database Migration
In Supabase SQL Editor (https://supabase.com/dashboard/project/iqcpfxrxtnbjllwprfun/sql/new):
1. Copy contents of `supabase/migrations/00001_initial_schema.sql`
2. Paste and run in the SQL editor

#### 4. Deploy to Vercel
After completing steps 1-3:
```bash
vercel --prod
```

When prompted, add these environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`: `https://iqcpfxrxtnbjllwprfun.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon key from step 2

---

## Quick Commands

```bash
# Check Vercel login status
vercel whoami

# Re-login to Vercel if needed
vercel login

# Deploy to production
vercel --prod

# Link to Supabase project (optional)
supabase link --project-ref iqcpfxrxtnbjllwprfun
```
