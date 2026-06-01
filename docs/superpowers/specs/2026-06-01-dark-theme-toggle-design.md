# Dark Theme Toggle Design

## Goal

Add a dark theme for the RSS Digest app based on `DESIGN.md`, with a theme button fixed in the top-right app chrome.

## Selected Approach

Use **system default plus manual override**.

The app initializes from a stored user choice when present. If no stored choice exists, it follows `prefers-color-scheme`. The top-right button toggles between light and dark and stores the user's explicit choice in `localStorage`.

This balances the user's system preference with direct control and keeps the implementation local to the existing app shell and CSS.

## Theme Behavior

- `AppShell` owns theme state because the theme button belongs to global app chrome.
- Initial theme checks `localStorage.theme` first.
- Accepted stored values are `light` and `dark`.
- If no accepted stored value exists, initial theme uses `window.matchMedia("(prefers-color-scheme: dark)").matches`.
- Toggle button switches between `light` and `dark`.
- Toggle button writes the selected value to `localStorage.theme`.
- The root shell renders `data-theme="light"` or `data-theme="dark"`.
- The button accessible label is `Switch to dark theme` while light is active and `Switch to light theme` while dark is active.

## Theme Button

Placement:

- Fixed at the top-right of the viewport.
- Matches the existing menu button's circular form, size, border, and z-index rhythm.
- Stays visible on every authenticated route.

Interaction:

- Single click toggles theme.
- The icon can use existing `lucide-react` icons such as `Moon` and `Sun`.
- No new UI library is required.

## Dark Visual System

Dark theme uses the dark product-surface side of `DESIGN.md`:

- App floor: `#181715`
- Elevated cards/readers/forms: `#252320`
- Soft dark card interiors: `#1f1e1b`
- Primary text: `#faf9f5`
- Muted text: `#a09d96`
- Hairline borders: `rgba(250, 249, 245, 0.14)`
- Coral primary action: `#cc785c`
- Coral active: `#a9583e`

Light theme remains the current warm editorial cream system:

- App floor: `#faf9f5`
- Cards/readers/forms: `#fffdf8` / `#efe9de`
- Primary text: `#141413`
- Muted text: `#6c6a64`
- Hairline borders: `#e6dfd8`

Implementation should convert hard-coded color rules in `src/styles.css` to CSS variables and override those variables in `.app-shell[data-theme="dark"]`. Keep coral usage sparse and consistent.

## Scope

Modify:

- `src/components/AppShell.tsx`: theme state, initialization, toggle button, `data-theme` attribute.
- `src/styles.css`: CSS variables and dark theme overrides.
- `src/App.test.tsx`: tests for system default, toggle, and stored override.

Avoid:

- `src/components/DatePicker.tsx`, because it already has unrelated local changes.
- Backend, Supabase, route, or data-flow changes.
- New dependencies.

## Testing

Add tests for:

- System dark preference initializes `data-theme="dark"` when no stored override exists.
- Clicking the theme button toggles to dark from light and updates the accessible label.
- Stored `localStorage.theme = "dark"` wins even when system preference is light.
- Existing digest and navigation drawer behavior stays green.

Verification commands:

- `npm run test -- src/App.test.tsx`
- `npm run test`
- `npm run build`

## Non-Goals

- No automatic live sync when OS theme changes after app load.
- No theme setting in Supabase or user profile.
- No third theme option.
- No animation requirement.

## Self-Review

- No placeholders remain.
- Scope is limited to theme state, theme button, CSS variables, and tests.
- Behavior is explicit and testable.
- Design respects `DESIGN.md` dark product surfaces while preserving coral as the primary accent.
