# Digest Date Viewer Design

## Goal

Change `src/pages/DigestsPage.tsx` from a list of digests into a direct daily digest viewer. The page opens on today's date, lets users move backward or forward by one day, and lets users pick an exact date with the existing `DatePicker` component.

## Selected Approach

Use `DigestsPage` as a date-based viewer while keeping the route `/digests` unchanged.

This is the smallest correct change because it reuses existing API and UI pieces: `getDigest`, `DigestViewer`, `DatePicker`, `EmptyState`, and `ErrorNotice`. It avoids changing routing behavior or loading all digests into the browser.

## Behavior

- Initial selected date is today's local date formatted as `YYYY-MM-DD`.
- Previous and Next buttons move selected date by one day.
- Datepicker changes selected date directly.
- For each selected date, the page fetches one digest with `getDigest(selectedDate)`.
- If no digest exists for selected date, the page shows an empty state and stays on selected date.
- If digest exists but `summary` is empty, the page shows existing missing-summary empty state.
- Stale responses are ignored when users change dates quickly.

## UI

Controls render at top-left above the digest content:

- `Previous`
- `Next`
- `DatePicker`

Below controls, the page renders the digest title, digest date, item count, and markdown summary. Existing visual style is preserved with small CSS additions for a compact toolbar.

## Error And Loading States

- Loading state displays while selected date fetch is active.
- Non-missing API errors render `ErrorNotice`.
- Missing digest renders `EmptyState` with a clear date-specific message.

## Testing

Update app-level tests to cover:

- `/digests` renders today's digest by default.
- Previous/Next changes selected date and fetches matching digest.
- Datepicker fetches selected date.
- Missing digest shows `No digest for this date`.

Run `npm run test` after implementation.
