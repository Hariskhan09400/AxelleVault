# AxelleVault - Quick Start Guide

## For Local Development

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

### Step 3: Open in Browser
```
http://localhost:5173
```

You should see the login page with full UI (no black screen).

### Step 4: Test Login
- Create an account via Sign Up
- Login with your email and password
- Access the dashboard

## For Production

### Build the Application
```bash
npm run build
```

Output will be in `dist/` folder.

### Deploy to Vercel
1. Connect your GitHub repository
2. Vercel will automatically detect the configuration
3. Build and deploy automatically

### Deploy to Other Services
- Copy contents of `dist/` folder
- Upload to your hosting service
- Ensure your server redirects all routes to `index.html`

## Troubleshooting

### Black Screen?
- Clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for errors (F12 → Console)

### Build Fails?
- Run `npm install` again
- Delete `node_modules` and rebuild
- Check Node.js version: `node -v` (should be 24.x)

### Login Not Working?
- Check Supabase connection in browser console
- Verify `.env` file has Supabase credentials
- Check browser's Network tab for API calls

## File Structure

```
project/
├── src/
│   ├── components/     (React components)
│   ├── contexts/       (Context providers)
│   ├── hooks/          (Custom hooks)
│   ├── lib/            (Utilities & Supabase)
│   ├── utils/          (Helper functions)
│   ├── App.tsx         (Main router)
│   └── main.tsx        (Entry point)
├── dist/               (Production build)
├── package.json        (Dependencies)
├── vercel.json         (Deployment config)
└── tsconfig.json       (TypeScript config)
```

## Available Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server on localhost:5173 |
| `npm run build` | Build for production (output: dist/) |
| `npm run preview` | Preview production build locally |

## Environment Variables

The application uses hardcoded Supabase credentials in `src/lib/supabase.ts`.

For production with environment variables:
```
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

## Key Features

- ✓ User authentication (email/password)
- ✓ Secure password storage
- ✓ Dashboard with tools
- ✓ Multiple security tools
- ✓ Encrypted notes vault
- ✓ Real-time updates
- ✓ Responsive design

## Getting Help

- Check console for error messages: F12 → Console
- Review TypeScript errors: `npm run build`
- Check network requests: F12 → Network tab
- Review application logs in browser console

---

**Status**: Ready for use
**Last Build**: April 27, 2026
