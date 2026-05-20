import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getLocalDayUtcBounds,
  limitCandidatesPerFeed,
} from "./index.ts";

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
