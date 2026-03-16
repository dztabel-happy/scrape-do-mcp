# scrape-do-mcp

[English Docs](./README.md) | 中文文档

Scrape.do 网页抓取和 Google 搜索 MCP 服务器 - 支持反机器人保护

## 功能特点

- **scrape_url**: 抓取任意网页并返回 Markdown 格式内容。自动绕过 Cloudflare、WAF、CAPTCHA 和反爬虫保护。支持 JavaScript 渲染、截图、地理定位（150+ 国家）、设备模拟、会话保持、自定义请求头/Cookie、超时控制等。
- **google_search**: 搜索 Google 并返回结构化的 SERP 结果 JSON。包含自然搜索结果、知识图谱、本地商家、新闻、相关问题等。支持地理定位和设备筛选。

## 可用工具

| 工具 | 描述 |
|------|------|
| `scrape_url` | 全功能网页抓取，反机器人绕过。支持：JavaScript 渲染、截图（PNG）、地理定位（150+ 国家）、设备模拟（桌面/手机/平板）、会话保持、自定义请求头/Cookie、超时控制等。 |
| `google_search` | Google SERP 结构化抓取，返回 JSON。支持：自然搜索结果、知识图谱、本地商家、新闻、People Also Ask、视频结果等，支持地理定位、设备筛选、时间筛选。 |

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
// 完整参数
{
  // 必需
  url: string,                    // 要抓取的网址

  // 代理和渲染
  render_js?: boolean,            // 渲染 JavaScript（默认 false）
  super_proxy?: boolean,           // 使用住宅/移动代理（消耗 10 积分）
  geoCode?: string,               // 国家代码（如 'us', 'cn', 'gb'）
  regionalGeoCode?: string,       // 区域（如 'asia', 'europe'）
  device?: "desktop" | "mobile" | "tablet",  // 设备类型
  sessionId?: number,             // 保持相同 IP 的会话

  // 超时和重试
  timeout?: number,               // 最大超时时间（毫秒，默认 60000）
  retryTimeout?: number,          // 重试超时（毫秒）
  disableRetry?: boolean,         // 禁用自动重试

  // 输出格式
  output?: "markdown" | "raw",  // 输出格式（默认 markdown）
  returnJSON?: boolean,           // 以 JSON 形式返回网络请求
  transparentResponse?: boolean,   // 返回原始响应

  // 截图
  screenshot?: boolean,           // 截图（PNG）
  fullScreenShot?: boolean,      // 全页截图
  particularScreenShot?: string,  // 元素截图（CSS 选择器）

  // 浏览器控制
  waitSelector?: string,          // 等待元素（CSS 选择器）
  customWait?: number,           // 加载后等待时间（毫秒）
  waitUntil?: "domcontentloaded" | "load" | "networkidle" | "networkidle0" | "networkidle2",
  width?: number,                // 视口宽度（默认 1920）
  height?: number,               // 视口高度（默认 1080）
  blockResources?: boolean,       // 阻止 CSS/图片/字体（默认 true）

  // 请求头和 Cookie
  customHeaders?: boolean,        // 处理所有请求头
  extraHeaders?: boolean,       // 添加额外请求头
  forwardHeaders?: boolean,      // 转发你的请求头
  setCookies?: string,          // 设置 Cookie（格式：'name=value; name2=value2'）
  pureCookies?: boolean,        // 返回原始 Cookie

  // 其他
  disableRedirection?: boolean, // 禁用重定向
  callback?: string             // Webhook URL 异步接收结果
}
```

### google_search

搜索 Google 并获取结构化结果。

```typescript
// 完整参数
{
  // 必需
  query: string,                  // 搜索关键词

  // 搜索选项
  country?: string,                // 国家代码（默认 'us'）
  language?: string,              // 界面语言（默认 'en'）
  domain?: string,               // Google 域名（如 'com', 'co.uk'）
  page?: number,                  // 页码（默认 1）
  num?: number,                  // 每页结果数（默认 10）
  time_period?: "" | "last_hour" | "last_day" | "last_week" | "last_month" | "last_year",
  device?: "desktop" | "mobile", // 设备类型

  // 高级
  includeHtml?: boolean           // 在响应中包含原始 HTML
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

### 地理定位抓取
```
用日本（geoCode: jp）的 IP 抓取 https://www.amazon.com/product/12345
```

### 移动设备模拟
```
用移动设备抓取 https://example.com 来查看移动版页面。
```

### 截图
```
截取 https://example.com 的屏幕截图并返回图片。
```

### 等待元素加载
```
抓取 https://example.com 但先等待 id 为 "content" 的元素加载完成。
```

### 会话保持
```
使用会话 ID 12345 抓取 https://example.com 的多个页面，以保持相同的 IP。
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

**免费：每月 1,000 积分** - 无需信用卡：https://app.scrape.do

## 开发

```bash
npm install
npm run build
npm run dev  # 开发模式运行
```

## 许可证

MIT
