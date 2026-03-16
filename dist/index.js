#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const SCRAPE_DO_TOKEN = process.env.SCRAPE_DO_TOKEN || "";
const SCRAPE_API_BASE = "https://api.scrape.do";
const server = new mcp_js_1.McpServer({
    name: "scrape-do-mcp",
    version: "0.1.0",
});
// ─── Tool 1: scrape_url ──────────────────────────────────────────────────────
server.tool("scrape_url", "Scrape any webpage and return its content as Markdown. Automatically bypasses Cloudflare, WAFs, CAPTCHAs, and anti-bot protection. Supports JavaScript-rendered pages.", {
    url: zod_1.z.string().url().describe("The target URL to scrape"),
    render_js: zod_1.z.boolean().optional().default(false).describe("Render JavaScript (use for React/Vue/SPA pages)"),
    super_proxy: zod_1.z.boolean().optional().default(false).describe("Use residential/mobile proxies for harder-to-detect requests (costs 10 credits instead of 1)"),
    output: zod_1.z.enum(["markdown", "raw"]).optional().default("markdown").describe("Output format: markdown (default) or raw HTML"),
}, async ({ url, render_js, super_proxy, output }) => {
    if (!SCRAPE_DO_TOKEN) {
        return {
            content: [{ type: "text", text: "Error: SCRAPE_DO_TOKEN is not set. Get your free token at https://app.scrape.do" }],
            isError: true,
        };
    }
    try {
        const response = await axios_1.default.get(SCRAPE_API_BASE, {
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
    }
    catch (error) {
        const msg = error.response?.data || error.message;
        return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
        };
    }
});
// ─── Tool 2: google_search ───────────────────────────────────────────────────
server.tool("google_search", "Search Google and return structured SERP results as JSON. Returns organic results, knowledge graph, local businesses, news stories, related questions (People Also Ask), video results, and more.", {
    query: zod_1.z.string().describe("Search query, e.g. 'best python frameworks 2026'"),
    country: zod_1.z.string().optional().default("us").describe("Country code for results, e.g. 'us', 'cn', 'gb', 'jp'"),
    language: zod_1.z.string().optional().default("en").describe("Interface language, e.g. 'en', 'zh', 'ja', 'de'"),
    page: zod_1.z.number().optional().default(1).describe("Page number (1 = first page, 2 = second page)"),
    time_period: zod_1.z.enum(["", "last_hour", "last_day", "last_week", "last_month", "last_year"]).optional().default("").describe("Filter results by time period"),
    device: zod_1.z.enum(["desktop", "mobile"]).optional().default("desktop").describe("Device type affecting SERP layout"),
}, async ({ query, country, language, page, time_period, device }) => {
    if (!SCRAPE_DO_TOKEN) {
        return {
            content: [{ type: "text", text: "Error: SCRAPE_DO_TOKEN is not set. Get your free token at https://app.scrape.do" }],
            isError: true,
        };
    }
    try {
        const params = {
            token: SCRAPE_DO_TOKEN,
            q: query,
            gl: country,
            hl: language,
            start: (page - 1) * 10,
            device,
        };
        if (time_period)
            params.time_period = time_period;
        const response = await axios_1.default.get(`${SCRAPE_API_BASE}/plugin/google/search`, {
            params,
            timeout: 60000,
        });
        return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
    }
    catch (error) {
        const msg = error.response?.data || error.message;
        return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
        };
    }
});
// ─── Start Server ────────────────────────────────────────────────────────────
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
