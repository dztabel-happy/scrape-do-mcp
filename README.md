# scrape-do-mcp

[中文文档](./README-ZH.md) | English

An MCP server that wraps Scrape.do's documented APIs in one package: the main scraping API, Google Search API, Amazon Scraper API, Async API, and a Proxy Mode configuration helper.

Official docs: https://scrape.do/documentation/

## Coverage

- `scrape_url`: Main Scrape.do API with JS rendering, geo-targeting, session persistence, screenshots, ReturnJSON, browser interactions, cookies, and header forwarding.
- `google_search`: Structured Google SERP API with `google_domain`, `location`, `uule`, `lr`, `cr`, `safe`, `nfpr`, `filter`, pagination, and optional raw HTML.
- `amazon_product`: Amazon PDP endpoint.
- `amazon_offer_listing`: Amazon offer listing endpoint.
- `amazon_search`: Amazon search/category endpoint.
- `amazon_raw_html`: Raw HTML Amazon endpoint with geo-targeting.
- `async_create_job`, `async_get_job`, `async_get_task`, `async_list_jobs`, `async_cancel_job`, `async_get_account`: Async API coverage.
- `proxy_mode_config`: Builds Proxy Mode connection details and parameter strings without exposing your token in tool output.

## Compatibility Notes

- `scrape_url` supports both MCP-friendly aliases and official parameter names:
  - `render_js` or `render`
  - `super_proxy` or `super`
  - `screenshot` or `screenShot`
- `google_search` supports:
  - `query` or `q`
  - `country` or `gl`
  - `language` or `hl`
  - `domain` or `google_domain`
  - `includeHtml` or `include_html`
- For header forwarding in `scrape_url`, pass `headers` plus `header_mode` (`custom`, `extra`, or `forward`).
- Screenshot responses are returned as MCP image content instead of plain base64 text.
- `scrape_url` defaults to `output="markdown"` when ReturnJSON is not used so the tool stays LLM-friendly. Set `output="raw"` if you want the raw API-style output.

## Installation

### Quick Install

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

### Claude Desktop

Add this to `~/.claude.json`:

```json
{
  "mcpServers": {
    "scrape-do": {
      "command": "npx",
      "args": ["-y", "scrape-do-mcp"],
      "env": {
        "SCRAPE_DO_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Get your token at https://app.scrape.do

## Available Tools

| Tool | Purpose |
|------|---------|
| `scrape_url` | Main Scrape.do scraping API wrapper |
| `google_search` | Structured Google search results |
| `amazon_product` | Amazon PDP structured data |
| `amazon_offer_listing` | Amazon seller offers |
| `amazon_search` | Amazon keyword/category results |
| `amazon_raw_html` | Raw Amazon HTML with geo-targeting |
| `async_create_job` | Create Async API jobs |
| `async_get_job` | Fetch Async job details |
| `async_get_task` | Fetch Async task details |
| `async_list_jobs` | List Async jobs |
| `async_cancel_job` | Cancel Async jobs |
| `async_get_account` | Fetch Async account/concurrency info |
| `proxy_mode_config` | Generate Proxy Mode configuration |

## Example Prompts

```text
Scrape https://example.com with render=true and wait for #app.
```

```text
Search Google for "open source MCP servers" with google_domain=google.co.uk and lr=lang_en.
```

```text
Get the Amazon PDP for ASIN B0C7BKZ883 in the US with zipcode 10001.
```

```text
Create an async job for these 20 URLs and give me the job ID.
```

## Development

```bash
npm install
npm run build
npm run dev
```

## License

MIT
