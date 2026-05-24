import { MarkdownRenderer } from "./MarkdownRenderer";

export function DigestViewer({ markdown }: { markdown: string }) {
  return <MarkdownRenderer markdown={markdown} />;
}
