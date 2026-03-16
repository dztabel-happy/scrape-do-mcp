#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import axios from "axios";
import http from "http";

const SCRAPE_DO_TOKEN = process.env.SCRAPE_DO_TOKEN || "";
const SCRAPE_API_BASE = "https://api.scrape.do";
const HTTP_PORT = process.env.PORT || process.env.HTTP_PORT || 3000;

const server = new McpServer({
  name: "scrape-do-mcp",
  version: "0.1.1",
});

// ─── Tool 1: scrape_url ──────────────────────────────────────────────────────

server.tool(
  "scrape_url",
  "Scrape any webpage and return its content as Markdown. Automatically bypasses Cloudflare, WAFs, CAPTCHAs, and anti-bot protection. Supports JavaScript-rendered pages.",
  {
    url: z.string().url().describe("The target URL to scrape"),
    render_js: z.boolean().optional().default(false).describe("Render JavaScript (use for React/Vue/SPA pages)"),
    super_proxy: z.boolean().optional().default(false).describe("Use residential/mobile proxies for harder-to-detect requests (costs 10 credits instead of 1)"),
    output: z.enum(["markdown", "raw"]).optional().default("markdown").describe("Output format: markdown (default) or raw HTML"),
  },
  async ({ url, render_js, super_proxy, output }) => {
    if (!SCRAPE_DO_TOKEN) {
      return {
        content: [{ type: "text", text: "Error: SCRAPE_DO_TOKEN is not set. Get your free token at https://app.scrape.do" }],
        isError: true,
      };
    }

    try {
      const response = await axios.get(SCRAPE_API_BASE, {
        params: {
          token: SCRAPE_DO_TOKEN,
          url,
          render: render_js,
          super: super_proxy,
          output,
        },
        timeout: 60000,
      });

      return {
        content: [{ type: "text", text: response.data }],
      };
    } catch (error: any) {
      const msg = error.response?.data || error.message;
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool 2: google_search ───────────────────────────────────────────────────

server.tool(
  "google_search",
  "Search Google and return structured SERP results as JSON. Returns organic results, knowledge graph, local businesses, news stories, related questions (People Also Ask), video results, and more.",
  {
    query: z.string().describe("Search query, e.g. 'best python frameworks 2026'"),
    country: z.string().optional().default("us").describe("Country code for results, e.g. 'us', 'cn', 'gb', 'jp'"),
    language: z.string().optional().default("en").describe("Interface language, e.g. 'en', 'zh', 'ja', 'de'"),
    page: z.number().optional().default(1).describe("Page number (1 = first page, 2 = second page)"),
    time_period: z.enum(["", "last_hour", "last_day", "last_week", "last_month", "last_year"]).optional().default("").describe("Filter results by time period"),
    device: z.enum(["desktop", "mobile"]).optional().default("desktop").describe("Device type affecting SERP layout"),
  },
  async ({ query, country, language, page, time_period, device }) => {
    if (!SCRAPE_DO_TOKEN) {
      return {
        content: [{ type: "text", text: "Error: SCRAPE_DO_TOKEN is not set. Get your free token at https://app.scrape.do" }],
        isError: true,
      };
    }

    try {
      const params: Record<string, any> = {
        token: SCRAPE_DO_TOKEN,
        q: query,
        gl: country,
        hl: language,
        start: (page - 1) * 10,
        device,
      };

      if (time_period) params.time_period = time_period;

      const response = await axios.get(`${SCRAPE_API_BASE}/plugin/google/search`, {
        params,
        timeout: 60000,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error: any) {
      const msg = error.response?.data || error.message;
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transportMode = process.env.TRANSPORT || "stdio";

  if (transportMode === "http" || transportMode === "streamable-http") {
    console.error(`Starting Streamable HTTP server on port ${HTTP_PORT}...`);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => Math.random().toString(36).substring(2, 15),
    });

    await server.connect(transport);

    const serverInstance = http.createServer();

    serverInstance.on("request", async (req, res) => {
      // Handle CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // Health check
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", name: "scrape-do-mcp", version: "0.1.1" }));
        return;
      }

      // MCP endpoint
      if (req.url === "/" || req.url?.startsWith("/mcp")) {
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    serverInstance.listen(parseInt(String(HTTP_PORT), 10), () => {
      console.error(`MCP server running on http://localhost:${HTTP_PORT}`);
    });
  } else {
    // Default to stdio mode
    console.error("Starting STDIO server...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch(console.error);
