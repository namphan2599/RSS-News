# Google Login Design

## Goal

Add Supabase Sign in with Google to the existing web login page while keeping the current magic-link flow as a fallback.

## Current Context

The app is a Vite React SPA using `@supabase/supabase-js`. Authentication state lives in `src/auth/AuthProvider.tsx`, which initializes from `supabase.auth.getSession()` and updates through `supabase.auth.onAuthStateChange()`. `src/pages/LoginPage.tsx` currently supports email magic links only.

## Approach

Use Supabase OAuth application code with `supabase.auth.signInWithOAuth({ provider: "google" })`. Because this app is client-rendered and stores sessions through the Supabase browser client, no server-side callback route is required. Supabase will redirect back to the app, and the existing auth listener will load the session.

## UI

Add a "Sign in with Google" button to the login card. Keep the magic-link form below it. Disable the Google button while its request is in progress and display existing error UI if Supabase returns an error.

## Data Flow

1. User clicks "Sign in with Google".
2. `LoginPage` calls `signInWithGoogle()` from `useAuth()`.
3. `AuthProvider` calls `supabase.auth.signInWithOAuth()` with `provider: "google"` and `redirectTo: window.location.origin`.
4. Supabase redirects to Google, then returns to the app.
5. Existing Supabase session handling updates auth state and protected routes become available.

## Local Supabase Config

Add `[auth.external.google]` to `supabase/config.toml` with the provider enabled, a placeholder client ID, and the client secret sourced from `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`. The real Google client ID and secret must still be configured in Google Cloud and the Supabase project dashboard or local environment.

## Error Handling

If OAuth initialization fails before redirect, show the error message in the existing `ErrorNotice`. The redirected Google flow errors are handled by Supabase/Auth provider behavior and can be revisited if a dedicated error page becomes necessary.

## Testing

Add or update tests for the login page auth context mock to include `signInWithGoogle`. Run `npm run lint` and `npm run build` after implementation.

## Out Of Scope

Google One Tap, Google pre-built button scripts, native app flows, Chrome extension flows, and storing Google provider tokens are out of scope.
