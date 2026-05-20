import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cleanDescription } from "./html.ts";

Deno.test("cleanDescription strips unsafe markup and normalizes text", () => {
  const input = `
    <style>.hidden { display: none; }</style>
    <script>alert("x")</script>
    <p>Hello&nbsp;<strong>RSS</strong> &amp; friends.</p>
  `;

  assertEquals(cleanDescription(input), "Hello RSS & friends.");
});

Deno.test("cleanDescription truncates at a word boundary when possible", () => {
  assertEquals(
    cleanDescription("Alpha beta gamma delta", 16),
    "Alpha beta gamma...",
  );
});
