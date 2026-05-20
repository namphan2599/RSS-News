export function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function digestStoragePath(date: Date): string {
  const formattedDate = formatDateInTimezone(date, "UTC");
  const [year, month] = formattedDate.split("-");

  return `daily/${year}/${month}/${formattedDate}.md`;
}
