# scrape-do-mcp

MCP Server for Scrape.do - Web Scraping & Google Search with anti-bot bypass

## Features

- **scrape_url**: Scrape any webpage and return content as Markdown. Automatically bypasses Cloudflare, WAFs, CAPTCHAs, and anti-bot protection. Supports JavaScript-rendered pages.
- **google_search**: Search Google and return structured SERP results as JSON. Returns organic results, knowledge graph, local businesses, news stories, and more.

## Installation

### Claude Code / Claude Desktop

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

### Smithery.ai

You can also install via [Smithery.ai](https://smithery.ai) for一键安装.

## Usage

### scrape_url

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
