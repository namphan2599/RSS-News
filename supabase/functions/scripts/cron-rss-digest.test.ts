import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseCronDigestArgs } from "./cron-rss-digest.ts";

Deno.test("parseCronDigestArgs returns explicit date", () => {
  assertEquals(parseCronDigestArgs(["--date", "2026-05-28"]), {
    date: "2026-05-28",
  });
});

Deno.test("parseCronDigestArgs leaves date unset when no date is provided", () => {
  assertEquals(parseCronDigestArgs([]), { date: undefined });
});

Deno.test("parseCronDigestArgs rejects invalid date", () => {
  assertThrows(
    () => parseCronDigestArgs(["--date", "bad-date"]),
    Error,
    "--date must use YYYY-MM-DD",
  );
});

Deno.test("parseCronDigestArgs rejects unknown option", () => {
  assertThrows(
    () => parseCronDigestArgs(["--force"]),
    Error,
    "Unknown argument: --force",
  );
});
