# Google Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase Sign in with Google to the existing React login page while preserving magic-link login.

**Architecture:** Extend `AuthProvider` with one OAuth method, then wire a second login button in `LoginPage`. Use Supabase browser OAuth redirect flow; no server callback route is needed for this SPA.

**Tech Stack:** Vite, React, TypeScript, React Router, Supabase Auth, Vitest, Testing Library.

---

## File Structure

- Modify `src/auth/AuthProvider.tsx`: add `signInWithGoogle` to `AuthContextValue` and implement it with `supabase.auth.signInWithOAuth`.
- Modify `src/pages/LoginPage.tsx`: add Google login button state and handler while keeping magic-link form.
- Modify `src/App.test.tsx`: update mocked auth context so tests that render auth consumers still match the context shape.
- Modify `supabase/config.toml`: add local Google provider config using env-backed secret.

## Task 1: Add Google OAuth To Auth Provider

**Files:**
- Modify: `src/auth/AuthProvider.tsx`

- [ ] **Step 1: Add failing auth context contract expectation**

No direct isolated test exists for `AuthProvider`. Use TypeScript build as the contract check after updating consumers in Task 2. The failure before implementation would be `Property 'signInWithGoogle' does not exist on type 'AuthContextValue'` once `LoginPage` calls it.

- [ ] **Step 2: Implement provider method**

Update `src/auth/AuthProvider.tsx` so the context type and value include `signInWithGoogle`:

```tsx
type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signInWithOtp: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};
```

Add this method next to `signInWithOtp` in the `useMemo` value:

```tsx
signInWithGoogle: async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
},
```

- [ ] **Step 3: Run type check after Task 2**

Run after the login page uses the method:

```bash
npm run build
```

Expected before Task 2 mock updates: TypeScript can fail where auth mocks omit `signInWithGoogle`.

## Task 2: Add Google Button To Login Page

**Files:**
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update login page to use Google auth**

In `src/pages/LoginPage.tsx`, destructure `signInWithGoogle`, add pending state, and add click handler:

```tsx
const { loading, session, signInWithOtp, signInWithGoogle } = useAuth();
const [email, setEmail] = useState("");
const [error, setError] = useState<string | null>(null);
const [sent, setSent] = useState(false);
const [googleLoading, setGoogleLoading] = useState(false);
```

```tsx
async function onGoogleSignIn() {
  setError(null);
  setSent(false);
  setGoogleLoading(true);

  try {
    await signInWithGoogle();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to start Google sign in";
    setError(message);
    setGoogleLoading(false);
  }
}
```

Add button before magic-link form:

```tsx
<button type="button" onClick={onGoogleSignIn} disabled={googleLoading}>
  {googleLoading ? "Opening Google..." : "Sign in with Google"}
</button>
```

- [ ] **Step 2: Keep magic link behavior unchanged**

Leave existing `onSubmit`, email input, sent notice, and redirect logic intact. Do not remove magic-link form.

- [ ] **Step 3: Update auth mock shape**

In `src/App.test.tsx`, update the auth provider mock:

```ts
vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => ({
    loading: false,
    session: { user: { email: "owner@example.com" } },
    signInWithOtp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));
```

- [ ] **Step 4: Run focused tests**

```bash
npm run test -- App.test.tsx
```

Expected: tests pass.

## Task 3: Add Local Supabase Google Provider Config

**Files:**
- Modify: `supabase/config.toml`

- [ ] **Step 1: Add provider section**

Append this section after `[auth]` settings:

```toml
[auth.external.google]
enabled = true
client_id = "your-google-client-id"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = false
```

- [ ] **Step 2: Confirm setup requirement remains explicit**

Do not add secrets to the repository. The user must set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` locally and configure real Google Client ID/Secret in Supabase dashboard for hosted auth.

## Task 4: Verify Full Change

**Files:**
- No edits expected.

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 2: Run tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 4: Review git diff**

```bash
git diff -- src/auth/AuthProvider.tsx src/pages/LoginPage.tsx src/App.test.tsx supabase/config.toml docs/superpowers/specs/2026-06-04-google-login-design.md docs/superpowers/plans/2026-06-04-google-login.md
```

Expected: diff only contains Google login implementation, local provider config, and docs.

## Commit Note

Do not commit unless the user explicitly requests it. If requested, use a message like:

```bash
git add src/auth/AuthProvider.tsx src/pages/LoginPage.tsx src/App.test.tsx supabase/config.toml docs/superpowers/specs/2026-06-04-google-login-design.md docs/superpowers/plans/2026-06-04-google-login.md
git commit -m "feat: add Google login"
```

## Self-Review

- Spec coverage: Auth provider, login UI, local Supabase config, error handling, and verification are covered.
- Placeholder scan: no TODO/TBD placeholders. `your-google-client-id` is intentional Supabase guide placeholder, not a secret.
- Type consistency: `signInWithGoogle` name is consistent across context, login page, and test mock.
