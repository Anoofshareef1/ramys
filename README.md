# lessonplanr

A calm, responsive teacher task workspace built with React, TypeScript, and Vite.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

## Included in this prototype

- Two-page Today and Reminders workflow
- Local browser persistence so tasks survive refreshes
- Live completion percentage, progress bar, ring, and weekly activity bars
- Task filters, completion toggles, deletion, and period selection
- Custom school portal shortcuts
- Browser notification permission toggle
- Installable PWA metadata and service worker
- Responsive layout for desktop, Android, and iOS

## Supabase cloud saving

The UI is currently local-first because a Supabase project URL, anon key, authentication setup, and database policies are required. To connect cloud saving:

1. Create a Supabase project.
2. Add `@supabase/supabase-js`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`.
4. Create `profiles`, `tasks`, and `school_links` tables with `user_id` columns.
5. Enable Row Level Security and restrict every operation with `auth.uid() = user_id`.
6. Add email or magic-link authentication, then replace the local storage adapter with Supabase queries.

Never expose a Supabase service-role key in this frontend.

## PWA notes

Android can install the app from the browser's install prompt or browser menu. On iOS, open the site in Safari, choose Share, then Add to Home Screen. Browser notifications require permission and HTTPS in production. Actual scheduled reminders can use a Netlify Scheduled Function with a cron expression. The function can read due tasks from Supabase and send Web Push notifications using VAPID keys. The browser still needs to register a push subscription, and secrets must remain in Netlify environment variables.
