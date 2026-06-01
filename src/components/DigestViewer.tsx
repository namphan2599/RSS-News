import { MarkdownRenderer } from "./MarkdownRenderer.js";

export function DigestViewer({ markdown }: { markdown: string }) {
  return <MarkdownRenderer markdown={markdown} />;
}
