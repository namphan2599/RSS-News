# RSS Summary Link Reading Prompt Design

## Goal

Update the `rss-summary` Edge Function prompt so Gemini produces a daily digest by reading each article URL, not only the RSS title or snippet.

## Design

Keep the existing data flow unchanged: feeds are fetched, RSS items are parsed, and the collected items are sent to Gemini. Only `buildPrompt` changes.

The prompt will instruct Gemini to:

- Open and read each item URL before summarizing it.
- Start the digest with one short paragraph summarizing today's most notable stories.
- Group the rest of the digest by category or inferred topic.
- Include a markdown link for every mentioned news item.
- Stay concise and factual.

If an article URL cannot be accessed by the model, the prompt will tell Gemini to use the RSS title and snippet as fallback and make the summary conservative.

## Testing

Run the existing TypeScript/build verification available for this project after the prompt change.
