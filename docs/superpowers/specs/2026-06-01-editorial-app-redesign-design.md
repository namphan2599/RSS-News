# Editorial App Redesign Design

## Goal

Redesign the whole RSS Digest app using the warm editorial system from `DESIGN.md`. The digest view should become the visual center of the product, and the navigation sidebar should be hidden by default.

## Selected Approach

Use the **Editorial Reader** direction.

The app opens on a warm cream canvas with a centered reading experience. Navigation moves into a hidden drawer opened by a compact menu button. This keeps the digest content dominant while still giving feeds, settings, and sign-out a consistent, accessible home.

This is the smallest correct whole-app redesign because it preserves existing routes, data flow, and page responsibilities while replacing the shell layout and shared visual tokens.

## Design System

Use `DESIGN.md` as the source of visual direction:

- Canvas: `#faf9f5`
- Primary coral: `#cc785c`
- Coral active: `#a9583e`
- Ink: `#141413`
- Body: `#3d3d3a`
- Muted: `#6c6a64`
- Hairline: `#e6dfd8`
- Surface card: `#efe9de`
- Dark surface: `#181715`
- Dark elevated: `#252320`

Typography:

- Display headings use `Cormorant Garamond, EB Garamond, Georgia, serif` as public substitutes for the unavailable Claude display fonts.
- Body, nav, labels, buttons, and forms use `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Display headings stay regular weight with tight letter spacing.
- Body text stays readable at 16px with generous line height.

Surface and shape rules:

- Use cream canvas as the app floor.
- Use hairline borders instead of heavy shadows.
- Use rounded 8px controls and 12px-16px cards.
- Reserve dark navy for the hidden navigation drawer and selected product-like panels.
- Reserve coral for primary actions and active emphasis, not every accent.

## App Shell

Replace the fixed left sidebar layout with a hidden-by-default navigation drawer.

Default state:

- Show a circular menu button at the top-left of the viewport.
- Keep the main content centered with generous responsive padding.
- Do not reserve permanent horizontal space for navigation.

Open state:

- Show a dark navy drawer from the left.
- Show a subtle backdrop over the page.
- Include brand, user email, nav links, and sign-out button inside the drawer.
- Close the drawer when the user clicks close, backdrop, or any nav link.

Accessibility:

- Menu button has an accessible name such as `Open navigation`.
- Close button has an accessible name such as `Close navigation`.
- Drawer uses semantic navigation content.
- Hidden drawer content is not visually present by default.

Responsive behavior:

- Use the same hidden drawer pattern on desktop and mobile.
- Drawer width should be comfortable on desktop and fit small screens on mobile.
- Main content padding tightens on mobile.

## Digest Page

The digest page is the main product surface.

Layout:

- Center content in a reader column, approximately 880px max width for the markdown body.
- Add a small editorial eyebrow such as `Daily briefing` above the page heading.
- Keep the digest title prominent with serif display typography.
- Place date navigation above the digest article in a compact toolbar.
- Render markdown inside a warm reader card with hairline border and generous padding.

Behavior remains unchanged:

- Initial selected date is today's local `YYYY-MM-DD`.
- Previous and Next move one day.
- Date picker changes selected date directly.
- Each selected date fetches `getDigest(selectedDate)`.
- Missing digest shows the existing date-specific empty state.
- Non-missing errors show `ErrorNotice`.
- Missing summary shows the existing missing-summary empty state.
- Stale responses remain ignored.

## Other Pages

Apply the same design system across the app without adding new product behavior.

Feeds:

- Keep existing feed form and list behavior.
- Style the page as cream canvas with card rows, hairline borders, and coral primary submit button.
- Preserve existing update/delete flows.

Settings:

- Keep existing run history/settings behavior.
- Style panels and run rows as editorial cards.

Login:

- Center the login card on cream canvas.
- Use serif headline and coral submit button.
- Preserve current auth flow.

## Components And CSS

Expected implementation scope:

- `src/components/AppShell.tsx`: add drawer open/close state and hidden navigation behavior.
- `src/pages/DigestsPage.tsx`: add digest-focused structure and class names while preserving fetch behavior.
- `src/components/MarkdownRenderer.tsx` or CSS only: style markdown as the reader card.
- `src/styles.css`: replace current palette/layout rules with the DESIGN.md-inspired tokens and responsive drawer/reader styles.
- `src/App.test.tsx`: update shell/navigation expectations and preserve digest behavior coverage.

Avoid new libraries. Keep state local to `AppShell` and `DigestsPage`.

## Testing

Add or update tests for:

- Sidebar navigation is hidden by default.
- Menu button opens the navigation drawer.
- Close button or backdrop hides the drawer.
- Clicking a nav link closes the drawer.
- Digest page still renders today's digest from `/`.
- Previous/Next and date picker still fetch selected dates.
- Missing digest, stale response, and missing summary behavior still pass.

Verification commands:

- `npm run test -- src/App.test.tsx`
- `npm run test`
- `npm run build`

## Non-Goals

- No route changes.
- No data model or Supabase changes.
- No new UI libraries.
- No feeds/settings feature expansion.
- No custom font loading unless already available; use documented fallback stacks.

## Self-Review

- No placeholders remain.
- Scope is limited to whole-app visual redesign, hidden navigation, and digest reader focus.
- Behavior changes are explicit and testable.
- Implementation preserves existing API/data flow and route structure.
