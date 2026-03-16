# scrape-do-mcp

[English Docs](./README.md) | 中文文档

Scrape.do 网页抓取和 Google 搜索 MCP 服务器 - 支持反机器人保护

## 功能特点

- **scrape_url**: 抓取任意网页并返回 Markdown 格式内容。自动绕过 Cloudflare、WAF、CAPTCHA 和反爬虫保护。支持 JavaScript 渲染页面。
- **google_search**: 搜索 Google 并返回结构化的 SERP 结果 JSON。包含自然搜索结果、知识图谱、本地商家、新闻、相关问题（People Also Ask）等。

## 安装

### 快速安装（推荐）

在终端中运行以下命令：

```bash
claude mcp add-json scrape-do --scope user '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "scrape-do-mcp"],
  "env": {
    "SCRAPE_DO_TOKEN": "你的Token"
  }
}'
```

将 `你的Token` 替换为你在 https://app.scrape.do 获取的 API Token。

### Claude Desktop

添加到 `~/.claude.json`：

```json
{
  "mcpServers": {
    "scrape-do": {
      "command": "npx",
      "args": ["-y", "scrape-do-mcp"],
      "env": {
        "SCRAPE_DO_TOKEN": "你的Token"
      }
    }
  }
}
```

获取免费 API Token：https://app.scrape.do

## 使用方法

### scrape_url

抓取任意网页并获取 Markdown 内容。

```typescript
// 参数
{
  url: string,           // 要抓取的网址
  render_js?: boolean,  // 渲染 JavaScript（默认 false）
  super_proxy?: boolean, // 使用住宅代理（消耗 10 积分，默认 false）
  output?: "markdown" | "raw"  // 输出格式（默认 markdown）
}
```

### google_search

搜索 Google 并获取结构化结果。

```typescript
// 参数
{
  query: string,                      // 搜索关键词
  country?: string,                   // 国家代码（默认 "us"）
  language?: string,                  // 界面语言（默认 "en"）
  page?: number,                      // 页码（默认 1）
  time_period?: "" | "last_hour" | "last_day" | "last_week" | "last_month" | "last_year",
  device?: "desktop" | "mobile"       // 设备类型（默认 desktop）
}
```

## 使用示例

### 抓取网页
```
请抓取 https://github.com 并给我主要内容（Markdown 格式）。
```

### Google 搜索
```
搜索 "2026 年最佳 Python Web 框架"，返回前 5 个结果。
```

### 带筛选条件的搜索
```
用中文搜索 "AI 新闻"，限定为中国，过去一周的内容。
```

### JavaScript 渲染
```
抓取这个 React 单页应用：https://example-spa.com
使用 render_js=true 获取完整渲染内容。
```

### 获取原始 HTML
```
抓取 https://example.com 并返回原始 HTML 而不是 markdown。
```

## 与其他工具对比

| 功能 | scrape-do-mcp | Firecrawl | Browserbase |
|------|--------------|-----------|-------------|
| Google 搜索 | ✅ | ❌ | ❌ |
| 免费积分 | 1,000 | 500 | 无 |
| 价格 | 按量付费 | $19+/月 | $15+/月 |
| MCP 原生 | ✅ | ✅ | ❌ |
| 配置难度 | 无需配置 | 需要 API key | 需要 API key + 浏览器 |

### 为什么选择 scrape-do-mcp？

- **零配置**：获取 Token 后即可立即使用
- **一体化**：网页抓取和 Google 搜索集于一个 MCP
- **反爬虫绕过**：自动处理 Cloudflare、WAF、CAPTCHA
- **成本效益**：按需付费，免费额度可用

## 积分消耗

| 工具 | 积分消耗 |
|------|---------|
| scrape_url（普通） | 1 积分/次 |
| scrape_url（super_proxy） | 10 积分/次 |
| google_search | 1 积分/次 |

注册即送 **1,000 积分**：https://app.scrape.do

## 开发

```bash
npm install
npm run build
npm run dev  # 开发模式运行
```

## 许可证

MIT
