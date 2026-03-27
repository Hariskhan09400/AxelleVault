# AxelleVault Supabase + .env Setup

## Required Environment Variables

Create a `.env` file in the project root with:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional 3rd-party APIs
VITE_HIBP_API_KEY=your-hibp-api-key
VITE_GOOGLE_SAFE_BROWSING_KEY=your-google-safebrowsing-key
VITE_VIRUSTOTAL_API_KEY=your-virustotal-api-key
VITE_DARKWEB_API_KEY=your-darkweb-api-key
VITE_SSL_API_KEY=your-ssl-scan-api-key
```

## Supabase Database Schema

Apply SQL from `supabase/migrations/20260326155131_create_axellevault_schema.sql` (includes all required tables:
- user_profiles
- security_logs
- login_attempts
- security_scores_history
- blocked_ips
- tool_usage_history
- encrypted_notes
- user_roles

With RLS and policies. Verify in Supabase dashboard.

## Supabase Auth Config

- Enable email/password authentication
- Disable email confirm if possible (or configure to auto-confirm)
- URL redirection: set auth URL to `https://<your-host>/reset-password` for password reset
- Password recovery expiry: set 15m in Supabase Auth settings (or adjust from project settings)

## Dev Startup

```bash
npm install
npm run dev
```

## Backend/Node.js Option

This project is primarily frontend with Supabase backend. For production-grade backend endpoints (rate-limiting, virus scanning, port scanning), add an Express server in `server/` and proxy requests using service-role secrets.\

## Key Components

- `src/contexts/AuthContext.tsx`: auth state, signup/login/logout/reset request, roles
- `src/components/ForgotPassword.tsx`: password reset trigger
- `src/components/ResetPassword.tsx`: token validation, expiry check, secure update
- `src/components/Dashboard.tsx`: tools routing + admin + secure notes
- `src/lib/supabase.ts`: table interfaces + helper operations

## Testing

- `npm run typecheck`
- `npm run lint`
- `npm run dev` (UI + Supabase auth flows)

## Extra Notes

- `DarkWebExposureChecker` uses fallback data without API key; get the key for real results.
- `PortScanner` uses `hackertarget.com` public endpoint; consider local backend in production.
