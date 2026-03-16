# scrape-do-mcp

[English Docs](./README.md) | 中文文档

这是一个把 Scrape.do 官方文档中主要 API 能力封装成 MCP 工具的包：主抓取 API、Google Search API、Amazon Scraper API、Async API，以及 Proxy Mode 配置辅助工具。

官方文档：https://scrape.do/documentation/

## 覆盖范围

- `scrape_url`：主 Scrape.do 抓取 API，支持 JS 渲染、地理定位、会话保持、截图、ReturnJSON、浏览器交互、Cookie、Header 转发。
- `google_search`：结构化 Google 搜索 API，支持 `google_domain`、`location`、`uule`、`lr`、`cr`、`safe`、`nfpr`、`filter`、分页、原始 HTML。
- `amazon_product`：Amazon PDP 接口。
- `amazon_offer_listing`：Amazon 卖家报价接口。
- `amazon_search`：Amazon 搜索 / 类目结果接口。
- `amazon_raw_html`：Amazon 原始 HTML 接口。
- `async_create_job`、`async_get_job`、`async_get_task`、`async_list_jobs`、`async_cancel_job`、`async_get_account`：Async API。
- `proxy_mode_config`：生成 Proxy Mode 的连接信息和参数字符串，不会在工具输出里泄露你的 token。

## 兼容性说明

- `scrape_url` 同时支持 MCP 友好的别名和官方参数名：
  - `render_js` 或 `render`
  - `super_proxy` 或 `super`
  - `screenshot` 或 `screenShot`
- `google_search` 同时支持：
  - `query` 或 `q`
  - `country` 或 `gl`
  - `language` 或 `hl`
  - `domain` 或 `google_domain`
  - `includeHtml` 或 `include_html`
- `scrape_url` 里的 Header 转发请使用 `headers` + `header_mode`（`custom` / `extra` / `forward`）。
- 截图结果会以 MCP 图片内容返回，而不是单纯的 base64 文本。
- `scrape_url` 在未启用 ReturnJSON 时默认使用 `output="markdown"`，更适合 LLM 读取；如果你想更贴近原始 HTTP API 的行为，请手动设置 `output="raw"`。

## 安装

### 快速安装

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

添加到 `~/.claude.json`：

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

Token 获取地址：https://app.scrape.do

## 可用工具

| 工具 | 用途 |
|------|------|
| `scrape_url` | 主 Scrape.do 抓取 API |
| `google_search` | 结构化 Google 搜索结果 |
| `amazon_product` | Amazon PDP 结构化数据 |
| `amazon_offer_listing` | Amazon 全量卖家报价 |
| `amazon_search` | Amazon 搜索 / 类目结果 |
| `amazon_raw_html` | Amazon 原始 HTML |
| `async_create_job` | 创建 Async API 任务 |
| `async_get_job` | 查询 Async job 详情 |
| `async_get_task` | 查询 Async task 详情 |
| `async_list_jobs` | 列出 Async jobs |
| `async_cancel_job` | 取消 Async job |
| `async_get_account` | 查询 Async 账户 / 并发信息 |
| `proxy_mode_config` | 生成 Proxy Mode 配置 |

## 示例提示词

```text
抓取 https://example.com，开启 render=true，并等待 #app 出现。
```

```text
搜索 "open source MCP servers"，并设置 google_domain=google.co.uk 与 lr=lang_en。
```

```text
获取 Amazon ASIN B0C7BKZ883 在美国 zipcode=10001 下的 PDP 数据。
```

```text
帮我为这 20 个 URL 创建一个异步抓取任务，并返回 job ID。
```

## 开发

```bash
npm install
npm run build
npm run dev
```

## 许可证

MIT
