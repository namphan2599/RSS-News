const DEFAULT_MAX_LENGTH = 500;

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  apos: "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    return ENTITY_MAP[entity.toLowerCase()] ?? match;
  });
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, Math.max(0, maxLength)).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const text = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;

  return `${text}...`;
}

export function cleanDescription(
  description: string | null | undefined,
  maxLength = DEFAULT_MAX_LENGTH,
): string {
  if (!description) {
    return "";
  }

  const withoutUnsafeBlocks = description
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutUnsafeBlocks.replace(/<[^>]+>/g, " ");
  const decoded = decodeEntities(withoutTags);
  const normalized = decoded.replace(/\s+/g, " ").trim();

  return truncateAtWord(normalized, maxLength);
}
