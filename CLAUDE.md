# CompSync Timer — Claude Instructions

## Commands
- Dev server: `npm run dev` (runs on localhost:3000)
- Type-check / build: `npm run build`
- Lint: `npm run lint`
- Deploy: push to GitHub — Vercel auto-deploys on every push

## Project
Next.js 16 + Tailwind 4 + TypeScript. No test suite.
GitHub repo: https://github.com/0xpaiDev/SynchTimmer
Remote: `git@github.com:0xpaiDev/SynchTimmer.git` (SSH), branch `main`
Vercel auto-deploys on every push to `main`.

## Rules
- Never `npm install` a package without asking first
- Never commit or push without explicit user instruction
- Always run `npm run build` mentally before suggesting a change touches the API routes (Admin SDK runs server-side only)
- Firebase client SDK must be lazy-initialized (never at module level)
- Firebase Admin SDK uses named app "admin" — do not change this
