# Dark Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DESIGN.md-inspired dark theme that initializes from stored preference or system preference and can be toggled from a top-right app button.

**Architecture:** Keep theme state local to `AppShell`, because the control is global app chrome. Render `data-theme="light|dark"` on `.app-shell`, persist explicit toggles in `localStorage.theme`, and drive colors through CSS variables with dark overrides. Preserve existing routes, data flow, drawer behavior, and user changes in `src/components/DatePicker.tsx`.

**Tech Stack:** Vite, React, TypeScript, React Router, Vitest, Testing Library, lucide-react, CSS custom properties.

---

## File Structure

- Modify `src/App.test.tsx`: add `matchMedia` setup and tests for system dark default, stored override, and toggle button behavior.
- Modify `src/components/AppShell.tsx`: add theme initialization, top-right theme button, `data-theme`, and localStorage persistence.
- Modify `src/styles.css`: add CSS variables, dark theme overrides, and theme button styles. Do not replace unrelated local edits.
- Do not modify `src/components/DatePicker.tsx`.

## Task 1: Theme Behavior Tests

**Files:**
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add matchMedia test helper**

In `src/App.test.tsx`, add this helper after `mockDigest`:

```tsx
function mockSystemTheme(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
```

- [ ] **Step 2: Reset theme storage and system theme in `beforeEach`**

Update the existing `beforeEach` in `src/App.test.tsx` to include:

```tsx
    localStorage.clear();
    mockSystemTheme(false);
```

The full `beforeEach` should be:

```tsx
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    mockSystemTheme(false);
    digestsApiMock.getDigest.mockReset();
  });
```

- [ ] **Step 3: Write failing theme tests**

Add these tests inside `describe("App", () => { ... })`, after the navigation drawer tests and before date navigation tests:

```tsx
  it("uses system dark theme when no stored theme exists", async () => {
    mockSystemTheme(true);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

    const { container } = render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("toggles from light to dark theme and stores the choice", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

    const { container } = render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-theme", "light");

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(container.querySelector(".app-shell")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("uses stored dark theme before system light theme", async () => {
    localStorage.setItem("theme", "dark");
    mockSystemTheme(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

    const { container } = render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });
```

- [ ] **Step 4: Run focused test to verify failure**

Run: `npm run test -- src/App.test.tsx`

Expected: FAIL because `.app-shell` has no `data-theme` and no theme toggle button exists.

## Task 2: Theme State And Toggle Button

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Update imports**

Change the first two imports in `src/components/AppShell.tsx` to:

```tsx
import { BookOpen, Menu, Moon, Rss, Settings, Sun, X } from "lucide-react";
import { useState } from "react";
```

- [ ] **Step 2: Add theme type and initializer**

Add this above `export function AppShell()`:

```tsx
type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
```

- [ ] **Step 3: Add theme state and toggle function**

Inside `AppShell`, after the existing `navOpen` state, add:

```tsx
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
```

After `closeNav`, add:

```tsx
  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "light" ? "dark" : "light";
      localStorage.setItem("theme", nextTheme);
      return nextTheme;
    });
  }
```

- [ ] **Step 4: Add `data-theme` and theme button**

Change the root shell opening tag from:

```tsx
    <div className="app-shell">
```

to:

```tsx
    <div className="app-shell" data-theme={theme}>
```

Add this button immediately after the menu button:

```tsx
      <button
        className="theme-button"
        type="button"
        aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        onClick={toggleTheme}
      >
        {theme === "light" ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
      </button>
```

- [ ] **Step 5: Run focused test to verify behavior passes**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS for theme behavior tests and existing app tests.

- [ ] **Step 6: Commit theme behavior**

Run:

```bash
git add src/App.test.tsx src/components/AppShell.tsx
git commit -m "add theme toggle behavior"
```

## Task 3: CSS Variables And Dark Theme

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add light and dark CSS variables**

In `src/styles.css`, replace the current `:root` block with:

```css
:root {
  color: #141413;
  background: #faf9f5;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;

  --color-canvas: #faf9f5;
  --color-card: #fffdf8;
  --color-card-strong: #efe9de;
  --color-ink: #141413;
  --color-body: #3d3d3a;
  --color-muted: #6c6a64;
  --color-hairline: #e6dfd8;
  --color-hairline-soft: #ebe6df;
  --color-primary: #cc785c;
  --color-primary-active: #a9583e;
  --color-on-primary: #ffffff;
  --color-dark: #181715;
  --color-dark-elevated: #252320;
  --color-on-dark: #faf9f5;
  --color-on-dark-soft: #a09d96;
  --color-error: #c64545;
  --color-error-text: #8b2f25;
  --color-success-bg: rgba(93, 184, 114, 0.16);
  --color-success-text: #2f7a42;
  --color-warning-bg: rgba(232, 165, 90, 0.18);
  --color-warning-text: #8c5a17;
  --color-error-bg: rgba(198, 69, 69, 0.16);
  --color-error-status-text: #9a2f2f;
  --color-backdrop: rgba(20, 20, 19, 0.28);
  --color-focus-ring: rgba(204, 120, 92, 0.14);
}

.app-shell[data-theme="dark"] {
  --color-canvas: #181715;
  --color-card: #252320;
  --color-card-strong: #1f1e1b;
  --color-ink: #faf9f5;
  --color-body: #d8d3c8;
  --color-muted: #a09d96;
  --color-hairline: rgba(250, 249, 245, 0.14);
  --color-hairline-soft: rgba(250, 249, 245, 0.1);
  --color-error-text: #f0a39c;
  --color-success-text: #8bd49d;
  --color-warning-text: #e8c37b;
  --color-error-status-text: #e58b8b;
  --color-backdrop: rgba(0, 0, 0, 0.48);
  --color-focus-ring: rgba(204, 120, 92, 0.28);
}
```

- [ ] **Step 2: Replace color literals with variables**

In `src/styles.css`, replace these color literals in existing rules:

```text
#faf9f5 -> var(--color-canvas)
#fffdf8 -> var(--color-card)
#efe9de -> var(--color-card-strong)
#141413 -> var(--color-ink)
#3d3d3a -> var(--color-body)
#6c6a64 -> var(--color-muted)
#e6dfd8 -> var(--color-hairline)
#ebe6df -> var(--color-hairline-soft)
#cc785c -> var(--color-primary)
#ffffff -> var(--color-on-primary)
#181715 -> var(--color-dark)
#252320 -> var(--color-dark-elevated)
#faf9f5 in sidebar text -> var(--color-on-dark)
#a09d96 -> var(--color-on-dark-soft)
#c64545 -> var(--color-error)
#8b2f25 -> var(--color-error-text)
rgba(20, 20, 19, 0.28) -> var(--color-backdrop)
rgba(204, 120, 92, 0.14) -> var(--color-focus-ring)
rgba(250, 249, 245, 0.14) -> var(--color-hairline)
rgba(93, 184, 114, 0.16) -> var(--color-success-bg)
#2f7a42 -> var(--color-success-text)
rgba(232, 165, 90, 0.18) -> var(--color-warning-bg)
#8c5a17 -> var(--color-warning-text)
rgba(198, 69, 69, 0.16) -> var(--color-error-bg)
#9a2f2f -> var(--color-error-status-text)
```

Do not replace color values inside the new variable declarations from Step 1.

- [ ] **Step 3: Add app-shell and theme button styles**

Update `.app-shell` to include canvas color:

```css
.app-shell {
  background: var(--color-canvas);
  color: var(--color-ink);
  min-height: 100vh;
}
```

Update `body` to use the canvas variable:

```css
body {
  margin: 0;
  min-width: 320px;
  background: var(--color-canvas);
}
```

Add `.theme-button` beside `.menu-button` styles:

```css
.theme-button {
  align-items: center;
  background: var(--color-canvas);
  border: 1px solid var(--color-hairline);
  border-radius: 999px;
  color: var(--color-ink);
  display: inline-flex;
  height: 42px;
  justify-content: center;
  position: fixed;
  right: 24px;
  top: 24px;
  width: 42px;
  z-index: 30;
}
```

In the mobile media query, add:

```css
  .theme-button {
    right: 16px;
    top: 16px;
  }
```

- [ ] **Step 4: Run focused tests**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS. CSS changes should not break behavior tests.

- [ ] **Step 5: Commit theme styles**

Run:

```bash
git add src/styles.css
git commit -m "add dark theme styles"
```

## Task 4: Full Verification

**Files:**
- No new files unless verification exposes required fixes.

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS with all `src/App.test.tsx` tests passing.

- [ ] **Step 2: Run full tests**

Run: `npm run test`

Expected: PASS with all Vitest tests passing.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully. Existing Vite deprecation or chunk-size warnings are acceptable if build exits successfully.

- [ ] **Step 4: Review final status**

Run: `git status --short`

Expected: implementation files are clean after commits. Existing untracked docs and unrelated `src/components/DatePicker.tsx` changes may remain and must not be reverted.

## Self-Review

- Spec coverage: plan covers system default, localStorage override, top-right button, `data-theme`, dark visual tokens, tests, and verification.
- Placeholder scan: no placeholders or open-ended implementation steps remain.
- Type consistency: `Theme`, `getInitialTheme`, `theme`, `toggleTheme`, `data-theme`, and accessible labels match across tasks and tests.
