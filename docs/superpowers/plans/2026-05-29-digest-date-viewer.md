# Digest Date Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/digests` list view with a direct date-based digest viewer that opens on today and supports previous day, next day, and datepicker navigation.

**Architecture:** Keep logic in `src/pages/DigestsPage.tsx` because this behavior is page-local. Reuse existing `getDigest`, `DigestViewer`, `DatePicker`, `EmptyState`, and `ErrorNotice`. Add small CSS classes in `src/styles.css` for the compact toolbar.

**Tech Stack:** Vite, React, TypeScript, React Router, Vitest, Testing Library, Supabase API wrapper.

---

## File Structure

- Modify `src/pages/DigestsPage.tsx`: replace list loading with selected-date state, single digest fetch, toolbar handlers, and direct digest rendering.
- Modify `src/styles.css`: add `.digest-toolbar`, `.digest-toolbar button`, and mobile wrapping styles.
- Modify `src/App.test.tsx`: update `/digests` tests to expect viewer behavior, navigation, datepicker, and missing digest empty state.

## Task 1: Date Viewer Page Behavior

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/pages/DigestsPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests for `/digests` date viewer**

Update `src/App.test.tsx` mock and add tests inside `describe("App", () => { ... })`:

```tsx
const digestsApiMock = vi.hoisted(() => ({
  getDigest: vi.fn(),
}));

vi.mock("./api/digestsApi", () => ({
  listDigests: vi.fn().mockResolvedValue([]),
  getDigest: digestsApiMock.getDigest,
}));

function mockDigest(date: string, summary: string | null = "## Programming\n\n- Daily updates.") {
  return {
    id: `digest-${date}`,
    digest_date: date,
    title: `Daily RSS Digest: ${date}`,
    summary,
    item_count: 3,
    generated_at: `${date}T12:00:00.000Z`,
  };
}
```

Replace the root redirect test with:

```tsx
it("renders today's digest on the digests page", async () => {
  vi.setSystemTime(new Date("2026-05-29T08:00:00"));
  digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/"]}
    >
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
  expect(screen.getByDisplayValue("2026-05-29")).toBeInTheDocument();
  expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-29");
});
```

Add tests:

```tsx
it("moves between digest dates with previous and next buttons", async () => {
  vi.setSystemTime(new Date("2026-05-29T08:00:00"));
  digestsApiMock.getDigest.mockImplementation((date: string) => Promise.resolve(mockDigest(date)));

  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/digests"]}
    >
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-28" })).toBeInTheDocument();
  expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-28");

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
});

it("loads a digest selected with the datepicker", async () => {
  vi.setSystemTime(new Date("2026-05-29T08:00:00"));
  digestsApiMock.getDigest.mockImplementation((date: string) => Promise.resolve(mockDigest(date)));

  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/digests"]}
    >
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-05-27" } });

  expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-27" })).toBeInTheDocument();
  expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-27");
});

it("shows an empty state when selected date has no digest", async () => {
  vi.setSystemTime(new Date("2026-05-29T08:00:00"));
  digestsApiMock.getDigest.mockRejectedValue(new Error("JSON object requested, multiple (or no) rows returned"));

  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/digests"]}
    >
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByText("No digest for this date")).toBeInTheDocument();
  expect(screen.getByText("No digest was generated for 2026-05-29."))).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- src/App.test.tsx`

Expected: tests fail because `/digests` still renders `DigestList` and never calls `getDigest`.

- [ ] **Step 3: Implement date viewer in `DigestsPage`**

Replace `src/pages/DigestsPage.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { getDigest, type DailyDigest } from "../api/digestsApi";
import { DatePicker } from "../components/DatePicker";
import { DigestViewer } from "../components/DigestViewer";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function isMissingDigestError(error: unknown) {
  return error instanceof Error && error.message.includes("no) rows returned");
}

export function DigestsPage() {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missingDigest, setMissingDigest] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);
    setDigest(null);
    setMissingDigest(false);

    getDigest(selectedDate)
      .then((nextDigest) => {
        if (active) setDigest(nextDigest);
      })
      .catch((err: unknown) => {
        if (!active) return;

        if (isMissingDigestError(err)) {
          setMissingDigest(true);
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load digest.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDate]);

  return (
    <section>
      <div className="digest-toolbar">
        <button type="button" onClick={() => setSelectedDate((date) => shiftDate(date, -1))}>
          Previous
        </button>
        <button type="button" onClick={() => setSelectedDate((date) => shiftDate(date, 1))}>
          Next
        </button>
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
      </div>

      {loading && <p>Loading digest...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && !error && missingDigest && (
        <EmptyState title="No digest for this date" body={`No digest was generated for ${selectedDate}.`} />
      )}
      {!loading && !error && digest && (
        <article>
          <h1>{digest.title}</h1>
          <p>
            {digest.digest_date} · {digest.item_count} items
          </p>
          {digest.summary ? (
            <DigestViewer markdown={digest.summary} />
          ) : (
            <EmptyState title="No summary available" body="This digest does not have a stored summary." />
          )}
        </article>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add compact toolbar styles**

Add to `src/styles.css` near digest styles:

```css
.digest-toolbar {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.digest-toolbar button {
  background: #102820;
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  padding: 10px 12px;
}

.date-picker {
  display: grid;
  gap: 6px;
}
```

- [ ] **Step 5: Run app tests**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run full verification**

Run: `npm run test`

Expected: PASS.

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

## Self-Review

- Spec coverage: plan covers today default, previous/next, datepicker, direct viewer, missing digest empty state, stale response handling, and verification.
- Placeholder scan: no placeholders or TODOs.
- Type consistency: `DailyDigest`, `getDigest`, `DatePicker`, `DigestViewer`, `EmptyState`, and `ErrorNotice` match existing code names.
