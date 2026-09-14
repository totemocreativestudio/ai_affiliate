# Next.js application-layer bridge

The supplied Luma V5.6.4.1 source is Flask/Jinja, not Next.js. This folder intentionally contains no fake replacement application.

To preserve the existing UI/UX, the safe conversion is:

1. Treat `templates/*.html` + `static/app.css` + `static/app.js` as the visual/interaction reference.
2. Port routes into Next.js App Router pages/route handlers incrementally.
3. Move server data access to Supabase.
4. Replace Flask session auth with Supabase Auth using `@supabase/ssr`.
5. Move local document storage to Supabase Storage.
6. Keep the existing Google Sheets/Drive/OpenAI integration semantics.
7. Verify one module at a time before switching production.

Do not call the project production-ready until the Next.js source exists, `npm run build` passes, and the deployed app has been browser-tested.
