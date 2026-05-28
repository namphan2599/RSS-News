import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  collectCandidatesAcrossPages,
  getLocalDayUtcBounds,
  limitCandidatesPerFeed,
} from "../_shared/digestJob.ts";
import { handleGenerateDailyDigest } from "./index.ts";

Deno.test("getLocalDayUtcBounds converts Asia/Saigon local day to UTC bounds", () => {
  assertEquals(getLocalDayUtcBounds("2026-05-20", "Asia/Saigon"), {
    start: "2026-05-19T17:00:00.000Z",
    end: "2026-05-20T17:00:00.000Z",
  });
});

Deno.test("getLocalDayUtcBounds handles DST edge lengths", () => {
  assertEquals(getLocalDayUtcBounds("2026-03-08", "America/New_York"), {
    start: "2026-03-08T05:00:00.000Z",
    end: "2026-03-09T04:00:00.000Z",
  });
});

Deno.test("limitCandidatesPerFeed prevents one feed from dominating candidates", () => {
  const candidates = [
    { id: "1", feeds: { url: "https://a.example/feed.xml" } },
    { id: "2", feeds: { url: "https://a.example/feed.xml" } },
    { id: "3", feeds: { url: "https://b.example/feed.xml" } },
    { id: "4", feeds: { url: "https://a.example/feed.xml" } },
    { id: "5", feeds: null },
  ];

  assertEquals(
    limitCandidatesPerFeed(candidates, 2, 4).map((item) => item.id),
    ["1", "2", "3", "5"],
  );
});

Deno.test("collectCandidatesAcrossPages keeps scanning past a noisy first page", async () => {
  const pages = [
    [
      { id: "a1", feeds: { url: "https://a.example/feed.xml" } },
      { id: "a2", feeds: { url: "https://a.example/feed.xml" } },
      { id: "a3", feeds: { url: "https://a.example/feed.xml" } },
    ],
    [
      { id: "b1", feeds: { url: "https://b.example/feed.xml" } },
      { id: "c1", feeds: { url: "https://c.example/feed.xml" } },
    ],
  ];
  const fetchedRanges: Array<[number, number]> = [];

  const selected = await collectCandidatesAcrossPages({
    maxItems: 4,
    maxItemsPerFeed: 1,
    maxPages: 3,
    pageSize: 3,
    fetchPage: (from, to) => {
      fetchedRanges.push([from, to]);
      return Promise.resolve(pages.shift() ?? []);
    },
  });

  assertEquals(selected.map((item) => item.id), ["a1", "b1", "c1"]);
  assertEquals(fetchedRanges, [[0, 2], [3, 5]]);
});

Deno.test("generate-daily-digest handler does not reject missing cron secret", async () => {
  const response = await handleGenerateDailyDigest(new Request("http://localhost/", {
    method: "POST",
    body: JSON.stringify({ date: "not-a-date" }),
    headers: { "Content-Type": "application/json" },
  }));

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "date must use YYYY-MM-DD" });
});
