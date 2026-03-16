# scrape-do-mcp

[中文文档](./README-ZH.md) | English

MCP Server for Scrape.do - Web Scraping & Google Search with anti-bot bypass

## Features

- **scrape_url**: Scrape any webpage and return content as Markdown. Automatically bypasses Cloudflare, WAFs, CAPTCHAs, and anti-bot protection. Supports JavaScript-rendered pages.
- **google_search**: Search Google and return structured SERP results as JSON. Returns organic results, knowledge graph, local businesses, news stories, and more.

## Available Tools

| Tool | Description |
|------|-------------|
| `scrape_url` | Scrape any webpage and return content as Markdown. Automatically bypasses Cloudflare, WAFs, CAPTCHAs, and anti-bot protection. Supports JavaScript-rendered pages. |
| `google_search` | Search Google and return structured SERP results as JSON. Returns organic results, knowledge graph, local businesses, news stories, related questions (People Also Ask), video results, and more. |

## Installation

### Quick Install (Recommended)

Run this command in your terminal:

```bash
claude mcp add-json scrape-do --scope user '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "scrape-do-mcp"],
  "env": {
    "SCRAPE_DO_TOKEN": "YOUR_TOKEN_HERE"
  }
}'
```

Replace `YOUR_TOKEN_HERE` with your Scrape.do API token from https://app.scrape.do

### Claude Desktop

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "scrape-do": {
      "command": "npx",
      "args": ["-y", "scrape-do-mcp"],
      "env": {
        "SCRAPE_DO_TOKEN": "your_token_here"
      }
    }
  }
}
```

Get your free API token at: https://app.scrape.do

## Usage

### scrape_url

Scrape any webpage and get content as Markdown.

```typescript
// Parameters
{
  url: string,           // Target URL to scrape
  render_js?: boolean,   // Render JavaScript (default: false)
  super_proxy?: boolean, // Use residential proxies (costs 10 credits, default: false)
  output?: "markdown" | "raw"  // Output format (default: markdown)
}
```

### google_search

Search Google and get structured results.

```typescript
// Parameters
{
  query: string,                      // Search query
  country?: string,                    // Country code (default: "us")
  language?: string,                   // Interface language (default: "en")
  page?: number,                       // Page number (default: 1)
  time_period?: "" | "last_hour" | "last_day" | "last_week" | "last_month" | "last_year",
  device?: "desktop" | "mobile"        // Device type (default: desktop)
}
```

## Example Prompts

Here are some prompts you can use to invoke the tools:

### Scrape a Website
```
Please scrape https://github.com and give me the main content as markdown.
```

### Search Google
```
Search Google for "best Python web frameworks 2026" and return the top 5 results.
```

### Search with Filters
```
Search for "AI news" in Chinese, from China, last week.
```

### JavaScript Rendering
```
Scrape this React Single Page Application: https://example-spa.com
Use render_js=true to get the fully rendered content.
```

### Get Raw HTML
```
Scrape https://example.com and return raw HTML instead of markdown.
```

## Comparison with Alternatives

| Feature | scrape-do-mcp | Firecrawl | Browserbase |
|---------|--------------|-----------|-------------|
| Google Search | ✅ | ❌ | ❌ |
| Free Credits | 1,000 | 500 | None |
| Pricing | Pay per use | $19+/mo | $15+/mo |
| MCP Native | ✅ | ✅ | ❌ |
| Setup Required | None | API key | API key + browser |

### Why scrape-do-mcp?

- **Zero setup**: Just get a token and use immediately
- **All-in-one**: Both web scraping AND Google search in one MCP
- **Anti-bot bypass**: Automatically handles Cloudflare, WAFs, CAPTCHAs
- **Cost-effective**: Pay only for what you use, free tier available

## Credit Usage

| Tool | Credit Cost |
|------|-------------|
| scrape_url (regular) | 1 credit/request |
| scrape_url (super_proxy) | 10 credits/request |
| google_search | 1 credit/request |

Free registration includes **1,000 credits**: https://app.scrape.do

## Development

```bash
npm install
npm run build
npm run dev  # Run in development mode
```

## License

MIT
