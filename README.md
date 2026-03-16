# scrape-do-mcp

[中文文档](./README-ZH.md) | English

MCP Server for Scrape.do - Web Scraping & Google Search with anti-bot bypass

## Features

- **scrape_url**: Scrape any webpage and return content as Markdown. Automatically bypasses Cloudflare, WAFs, CAPTCHAs, and anti-bot protection. Supports JavaScript rendering, screenshots, geo-targeting (150+ countries), device emulation, session persistence, and more.
- **google_search**: Search Google and return structured SERP results as JSON. Returns organic results, knowledge graph, local businesses, news stories, and more. Supports geo-targeting and device filtering.

## Available Tools

| Tool | Description |
|------|-------------|
| `scrape_url` | Full-featured web scraping with anti-bot bypass. Supports: JavaScript rendering, screenshots (PNG), geo-targeting (150+ countries), device emulation (desktop/mobile/tablet), session persistence, custom headers/cookies, timeout control, and more. |
| `google_search` | Google SERP scraping returning structured JSON. Supports: organic results, knowledge graph, local businesses, news, People Also Ask, video results, geo-targeting, device filtering, and time-based filtering. |

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
// All Parameters
{
  // Required
  url: string,                    // Target URL to scrape

  // Proxy & Rendering
  render_js?: boolean,            // Render JavaScript (default: false)
  super_proxy?: boolean,           // Use residential/mobile proxies (costs 10 credits)
  geoCode?: string,               // Country code (e.g., 'us', 'cn', 'gb')
  regionalGeoCode?: string,       // Region (e.g., 'asia', 'europe')
  device?: "desktop" | "mobile" | "tablet",  // Device type
  sessionId?: number,             // Keep same IP for session

  // Timeout & Retry
  timeout?: number,               // Max timeout in ms (default: 60000)
  retryTimeout?: number,          // Retry timeout in ms
  disableRetry?: boolean,         // Disable auto retry

  // Output Format
  output?: "markdown" | "raw",   // Output format (default: markdown)
  returnJSON?: boolean,           // Return network requests as JSON
  transparentResponse?: boolean,   // Return pure response

  // Screenshot
  screenshot?: boolean,           // Take screenshot (PNG)
  fullScreenShot?: boolean,       // Full page screenshot
  particularScreenShot?: string,   // Screenshot of element (CSS selector)

  // Browser Control
  waitSelector?: string,          // Wait for element (CSS selector)
  customWait?: number,            // Wait time after load (ms)
  waitUntil?: "domcontentloaded" | "load" | "networkidle" | "networkidle0" | "networkidle2",
  width?: number,                // Viewport width (default: 1920)
  height?: number,               // Viewport height (default: 1080)
  blockResources?: boolean,      // Block CSS/images/fonts (default: true)

  // Headers & Cookies
  customHeaders?: boolean,        // Handle all headers
  extraHeaders?: boolean,        // Add extra headers
  forwardHeaders?: boolean,      // Forward your headers
  setCookies?: string,           // Set cookies ('name=value; name2=value2')
  pureCookies?: boolean,         // Return original cookies

  // Other
  disableRedirection?: boolean,  // Disable redirect
  callback?: string              // Webhook URL for async results
}
```

### google_search

Search Google and get structured results.

```typescript
// All Parameters
{
  // Required
  query: string,                  // Search query

  // Search Options
  country?: string,                // Country code (default: 'us')
  language?: string,               // Interface language (default: 'en')
  domain?: string,                // Google domain (e.g., 'com', 'co.uk')
  page?: number,                  // Page number (default: 1)
  num?: number,                   // Results per page (default: 10)
  time_period?: "" | "last_hour" | "last_day" | "last_week" | "last_month" | "last_year",
  device?: "desktop" | "mobile", // Device type

  // Advanced
  includeHtml?: boolean           // Include raw HTML in response
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

### Geo-targeting
```
Scrape https://www.amazon.com/product/12345 as if I'm in Japan (geoCode: jp)
```

### Mobile Device
```
Scrape https://example.com using a mobile device to see the mobile version.
```

### Take Screenshot
```
Take a screenshot of https://example.com and return the image.
```

### Wait for Element
```
Scrape https://example.com but wait for the element with id "content" to load first.
```

### Session Persistence
```
Scrape multiple pages of https://example.com using sessionId 12345 to maintain the same IP.
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

**Free: 1,000 credits/month** - No credit card required: https://app.scrape.do

## Development

```bash
npm install
npm run build
npm run dev  # Run in development mode
```

## License

MIT
