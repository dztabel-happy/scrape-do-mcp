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
    version: "0.2.0",
});
// ─── Tool 1: scrape_url ──────────────────────────────────────────────────────
server.tool("scrape_url", "Scrape any webpage and return its content as Markdown. Automatically bypasses Cloudflare, WAFs, CAPTCHAs, and anti-bot protection. Supports JavaScript-rendered pages, screenshots, geo-targeting, and more.", {
    // Required
    url: zod_1.z.string().url().describe("The target URL to scrape"),
    // Proxy & Rendering
    render_js: zod_1.z.boolean().optional().default(false).describe("Render JavaScript (use for React/Vue/SPA pages)"),
    super_proxy: zod_1.z.boolean().optional().default(false).describe("Use residential & mobile proxy networks (costs 10 credits instead of 1)"),
    geoCode: zod_1.z.string().optional().describe("Country code for geo-targeting (e.g., 'us', 'cn', 'gb', 'jp'). See full list at https://scrape.do/features/geo-targeting/"),
    regionalGeoCode: zod_1.z.string().optional().describe("Regional geo targeting (e.g., 'asia', 'europe', 'africa')"),
    device: zod_1.z.enum(["desktop", "mobile", "tablet"]).optional().default("desktop").describe("Device type to emulate"),
    sessionId: zod_1.z.number().optional().describe("Use the same IP address continuously with a session (0-999999999)"),
    // Timeout & Retry
    timeout: zod_1.z.number().optional().default(60000).describe("Maximum timeout for request in milliseconds (max 120000)"),
    retryTimeout: zod_1.z.number().optional().describe("Maximum timeout for retry mechanism in milliseconds"),
    disableRetry: zod_1.z.boolean().optional().default(false).describe("Disable automatic retry on failure"),
    // Output Format
    output: zod_1.z.enum(["markdown", "raw"]).optional().default("markdown").describe("Output format: markdown (default) or raw HTML"),
    returnJSON: zod_1.z.boolean().optional().default(false).describe("Returns network requests with content as JSON"),
    transparentResponse: zod_1.z.boolean().optional().default(false).describe("Return pure response without Scrape.do processing"),
    // Screenshot
    screenshot: zod_1.z.boolean().optional().default(false).describe("Return a screenshot from the webpage (PNG)"),
    fullScreenShot: zod_1.z.boolean().optional().default(false).describe("Return a full page screenshot"),
    particularScreenShot: zod_1.z.string().optional().describe("Return screenshot of a specific area (CSS selector)"),
    // Browser Control
    waitSelector: zod_1.z.string().optional().describe("CSS selector to wait for before returning"),
    customWait: zod_1.z.number().optional().describe("Wait time in milliseconds after content loaded"),
    waitUntil: zod_1.z.enum(["domcontentloaded", "load", "networkidle", "networkidle0", "networkidle2"]).optional().default("domcontentloaded").describe("When to consider page loaded"),
    width: zod_1.z.number().optional().default(1920).describe("Browser viewport width in pixels"),
    height: zod_1.z.number().optional().default(1080).describe("Browser viewport height in pixels"),
    blockResources: zod_1.z.boolean().optional().default(true).describe("Block CSS, images, and fonts to speed up loading"),
    // Headers & Cookies
    customHeaders: zod_1.z.boolean().optional().default(false).describe("Handle all request headers for the target webpage"),
    extraHeaders: zod_1.z.boolean().optional().default(false).describe("Add extra headers or change header values"),
    forwardHeaders: zod_1.z.boolean().optional().default(false).describe("Forward your own headers to the target website"),
    setCookies: zod_1.z.string().optional().describe("Set cookies for the target webpage (format: 'name=value; name2=value2')"),
    pureCookies: zod_1.z.boolean().optional().default(false).describe("Return original Set-Cookie headers from target website"),
    // Other
    disableRedirection: zod_1.z.boolean().optional().default(false).describe("Disable request redirection"),
    callback: zod_1.z.string().optional().describe("Get results via webhook URL without waiting"),
}, async (params) => {
    if (!SCRAPE_DO_TOKEN) {
        return {
            content: [{ type: "text", text: "Error: SCRAPE_DO_TOKEN is not set. Get your free token at https://app.scrape.do" }],
            isError: true,
        };
    }
    const { url, render_js, super_proxy, geoCode, regionalGeoCode, device, sessionId, timeout, retryTimeout, disableRetry, output, returnJSON, transparentResponse, screenshot, fullScreenShot, particularScreenShot, waitSelector, customWait, waitUntil, width, height, blockResources, customHeaders, extraHeaders, forwardHeaders, setCookies, pureCookies, disableRedirection, callback, } = params;
    try {
        const requestParams = {
            token: SCRAPE_DO_TOKEN,
            url,
            render: render_js,
            super: super_proxy,
            output,
        };
        // Add optional parameters if provided
        if (geoCode)
            requestParams.geoCode = geoCode;
        if (regionalGeoCode)
            requestParams.regionalGeoCode = regionalGeoCode;
        if (device && device !== "desktop")
            requestParams.device = device;
        if (sessionId)
            requestParams.sessionId = sessionId;
        if (timeout && timeout !== 60000)
            requestParams.timeout = timeout;
        if (retryTimeout)
            requestParams.retryTimeout = retryTimeout;
        if (disableRetry)
            requestParams.disableRetry = disableRetry;
        if (returnJSON)
            requestParams.returnJSON = returnJSON;
        if (transparentResponse)
            requestParams.transparentResponse = transparentResponse;
        if (screenshot)
            requestParams.screenShot = screenshot;
        if (fullScreenShot)
            requestParams.fullScreenShot = fullScreenShot;
        if (particularScreenShot)
            requestParams.particularScreenShot = particularScreenShot;
        if (waitSelector)
            requestParams.waitSelector = waitSelector;
        if (customWait)
            requestParams.customWait = customWait;
        if (waitUntil && waitUntil !== "domcontentloaded")
            requestParams.waitUntil = waitUntil;
        if (width && width !== 1920)
            requestParams.width = width;
        if (height && height !== 1080)
            requestParams.height = height;
        if (blockResources === false)
            requestParams.blockResources = false;
        if (customHeaders)
            requestParams.customHeaders = customHeaders;
        if (extraHeaders)
            requestParams.extraHeaders = extraHeaders;
        if (forwardHeaders)
            requestParams.forwardHeaders = forwardHeaders;
        if (setCookies)
            requestParams.setCookies = setCookies;
        if (pureCookies)
            requestParams.pureCookies = pureCookies;
        if (disableRedirection)
            requestParams.disableRedirection = disableRedirection;
        if (callback)
            requestParams.callback = callback;
        const response = await axios_1.default.get(SCRAPE_API_BASE, {
            params: requestParams,
            timeout: Math.min(timeout || 60000, 120000),
            responseType: screenshot || fullScreenShot || particularScreenShot ? 'arraybuffer' : 'text',
        });
        // If screenshot, return as base64
        if (screenshot || fullScreenShot || particularScreenShot) {
            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            return {
                content: [{ type: "text", text: `Screenshot (base64): ${base64}` }],
            };
        }
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
    // Required
    query: zod_1.z.string().describe("Search query, e.g. 'best python frameworks 2026'"),
    // Search Options
    country: zod_1.z.string().optional().default("us").describe("Country code for results (e.g., 'us', 'cn', 'gb', 'jp'). See: https://scrape.do/features/geo-targeting/"),
    language: zod_1.z.string().optional().default("en").describe("Interface language (e.g., 'en', 'zh', 'ja', 'de')"),
    domain: zod_1.z.string().optional().describe("Google domain (e.g., 'com', 'co.uk', 'de', 'fr')"),
    page: zod_1.z.number().optional().default(1).describe("Page number (1 = first page, 2 = second page)"),
    time_period: zod_1.z.enum(["", "last_hour", "last_day", "last_week", "last_month", "last_year"]).optional().default("").describe("Filter results by time period"),
    device: zod_1.z.enum(["desktop", "mobile"]).optional().default("desktop").describe("Device type affecting SERP layout"),
    // Advanced
    num: zod_1.z.number().optional().describe("Number of results per page (default: 10)"),
    includeHtml: zod_1.z.boolean().optional().default(false).describe("Include raw HTML alongside parsed JSON"),
}, async ({ query, country, language, domain, page, time_period, device, num, includeHtml }) => {
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
            start: (page - 1) * (num || 10),
            device,
        };
        if (domain)
            params.domain = domain;
        if (num)
            params.num = num;
        if (includeHtml)
            params.include_html = includeHtml;
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
