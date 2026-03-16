#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const SERVER_VERSION = "0.3.0";
const SCRAPE_DO_TOKEN = process.env.SCRAPE_DO_TOKEN || "";
const SCRAPE_API_BASE = "https://api.scrape.do";
const ASYNC_API_BASE = "https://q.scrape.do";
const headerValueSchema = zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]);
const headerRecordSchema = zod_1.z.record(zod_1.z.string(), headerValueSchema);
const browserActionSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]));
const headerModeSchema = zod_1.z.enum(["custom", "extra", "forward"]);
const scrapeWaitUntilSchema = zod_1.z.enum(["domcontentloaded", "load", "networkidle", "networkidle0", "networkidle2"]);
const asyncWaitUntilSchema = zod_1.z.enum(["domcontentloaded", "networkidle0", "networkidle2"]);
const googleTimePeriodSchema = zod_1.z.enum(["last_hour", "last_day", "last_week", "last_month", "last_year"]);
const asyncMethodSchema = zod_1.z.enum(["GET", "POST", "PUT", "PATCH", "HEAD", "DELETE"]);
const server = new mcp_js_1.McpServer({
    name: "scrape-do-mcp",
    version: SERVER_VERSION,
});
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
function stringifyUnknown(value) {
    if (typeof value === "string") {
        return value;
    }
    if (value instanceof ArrayBuffer) {
        return Buffer.from(value).toString("utf8");
    }
    if (Buffer.isBuffer(value)) {
        return value.toString("utf8");
    }
    if (value === undefined || value === null) {
        return "";
    }
    try {
        return JSON.stringify(value, null, 2);
    }
    catch {
        return String(value);
    }
}
function tryParseJson(value) {
    try {
        return JSON.parse(value);
    }
    catch {
        return undefined;
    }
}
function createErrorResult(message) {
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
function createTextResult(text, structuredContent) {
    return {
        content: [{ type: "text", text }],
        ...(structuredContent ? { structuredContent } : {}),
    };
}
function createJsonResult(value) {
    if (isRecord(value)) {
        return {
            content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
            structuredContent: value,
        };
    }
    return createTextResult(JSON.stringify(value, null, 2));
}
function createImageResult(images, note) {
    const content = [];
    if (note) {
        content.push({ type: "text", text: note });
    }
    for (const image of images) {
        content.push({
            type: "image",
            data: image.data,
            mimeType: image.mimeType,
        });
    }
    return { content };
}
function getErrorMessage(error) {
    if (axios_1.default.isAxiosError(error)) {
        const responseData = error.response?.data;
        if (responseData !== undefined) {
            return stringifyUnknown(responseData);
        }
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
async function requestText(config) {
    const response = await axios_1.default.request({
        ...config,
        responseType: "text",
        transformResponse: [(value) => value],
    });
    return {
        text: stringifyUnknown(response.data),
        headers: response.headers,
    };
}
function normalizeHeaderRecord(value) {
    if (!value) {
        return undefined;
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry)]));
}
function resolveHeaderMode(input) {
    const modes = new Set();
    if (input.customHeaders) {
        modes.add("custom");
    }
    if (input.extraHeaders) {
        modes.add("extra");
    }
    if (input.forwardHeaders) {
        modes.add("forward");
    }
    const explicitMode = input.header_mode ?? input.headerMode;
    if (explicitMode) {
        modes.add(explicitMode);
    }
    if (modes.size > 1) {
        throw new Error("Choose only one header mode: custom, extra, or forward.");
    }
    if (modes.size === 1) {
        return [...modes][0];
    }
    if (input.headers) {
        return "custom";
    }
    return undefined;
}
function buildForwardedHeaders(headers, mode) {
    const normalizedHeaders = normalizeHeaderRecord(headers);
    if (!normalizedHeaders) {
        return undefined;
    }
    if (mode !== "extra") {
        return normalizedHeaders;
    }
    return Object.fromEntries(Object.entries(normalizedHeaders).map(([key, value]) => [key.toLowerCase().startsWith("sd-") ? key : `sd-${key}`, value]));
}
function inferMimeTypeFromBase64(value) {
    if (value.startsWith("iVBORw0KGgo")) {
        return "image/png";
    }
    if (value.startsWith("/9j/")) {
        return "image/jpeg";
    }
    if (value.startsWith("R0lGOD")) {
        return "image/gif";
    }
    if (value.startsWith("UklGR")) {
        return "image/webp";
    }
    if (value.startsWith("Qk0")) {
        return "image/bmp";
    }
    return undefined;
}
function maybeImageMatch(value) {
    const trimmedValue = value.trim();
    const dataUriMatch = trimmedValue.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (dataUriMatch) {
        return {
            mimeType: dataUriMatch[1],
            data: dataUriMatch[2].replace(/\s+/g, ""),
        };
    }
    const normalizedValue = trimmedValue.replace(/\s+/g, "");
    const mimeType = inferMimeTypeFromBase64(normalizedValue);
    if (!mimeType || normalizedValue.length < 100) {
        return undefined;
    }
    return {
        mimeType,
        data: normalizedValue,
    };
}
function collectImageMatches(value, results = [], seen = new Set()) {
    if (typeof value === "string") {
        const match = maybeImageMatch(value);
        if (match && !seen.has(match.data)) {
            seen.add(match.data);
            results.push(match);
        }
        return results;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectImageMatches(item, results, seen);
        }
        return results;
    }
    if (!isRecord(value)) {
        return results;
    }
    const prioritizedKeys = ["screenShot", "screenshot", "fullScreenShot", "particularScreenShot", "image", "images"];
    for (const key of prioritizedKeys) {
        if (key in value) {
            collectImageMatches(value[key], results, seen);
        }
    }
    for (const [key, entry] of Object.entries(value)) {
        if (!prioritizedKeys.includes(key)) {
            collectImageMatches(entry, results, seen);
        }
    }
    return results;
}
function buildProxyParameterString(params) {
    if (!params) {
        return "render=false";
    }
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        searchParams.set(key, String(value));
    }
    return searchParams.toString();
}
function ensureToken() {
    if (!SCRAPE_DO_TOKEN) {
        throw new Error("SCRAPE_DO_TOKEN is not set. Get your token at https://app.scrape.do");
    }
}
server.tool("scrape_url", "Scrape a webpage with the official Scrape.do API. Supports Markdown/raw output, JS rendering, screenshots, browser interactions, geo-targeting, header forwarding, session persistence, and ReturnJSON features.", {
    url: zod_1.z.string().url().describe("The target URL to scrape"),
    render_js: zod_1.z.boolean().optional().describe("Alias for render. Render JavaScript for SPA or dynamic pages."),
    render: zod_1.z.boolean().optional().describe("Official Scrape.do render parameter."),
    super_proxy: zod_1.z.boolean().optional().describe("Alias for super. Use residential/mobile proxies."),
    super: zod_1.z.boolean().optional().describe("Official Scrape.do super parameter."),
    geoCode: zod_1.z.string().optional().describe("Country code for geo-targeting."),
    regionalGeoCode: zod_1.z.string().optional().describe("Regional geo-targeting code."),
    device: zod_1.z.enum(["desktop", "mobile", "tablet"]).optional().default("desktop").describe("Device type to emulate."),
    sessionId: zod_1.z.union([zod_1.z.number().int(), zod_1.z.string()]).optional().describe("Sticky session ID."),
    timeout: zod_1.z.number().int().positive().optional().default(60000).describe("Maximum timeout in milliseconds."),
    retryTimeout: zod_1.z.number().int().positive().optional().describe("Retry timeout in milliseconds."),
    disableRetry: zod_1.z.boolean().optional().default(false).describe("Disable automatic retries."),
    output: zod_1.z.enum(["markdown", "raw"]).optional().describe("Output format. MCP defaults to markdown unless ReturnJSON is used."),
    returnJSON: zod_1.z.boolean().optional().default(false).describe("Return JSON with network requests/content."),
    transparentResponse: zod_1.z.boolean().optional().default(false).describe("Return the target response without Scrape.do post-processing."),
    screenshot: zod_1.z.boolean().optional().describe("Alias for screenShot. Capture a viewport screenshot."),
    screenShot: zod_1.z.boolean().optional().describe("Official Scrape.do screenshot parameter."),
    fullScreenShot: zod_1.z.boolean().optional().default(false).describe("Capture a full-page screenshot."),
    particularScreenShot: zod_1.z.string().optional().describe("Capture a screenshot of a specific CSS selector."),
    playWithBrowser: zod_1.z.array(browserActionSchema).optional().describe("Browser interaction script for Scrape.do."),
    waitSelector: zod_1.z.string().optional().describe("CSS selector to wait for."),
    customWait: zod_1.z.number().int().min(0).optional().describe("Additional wait time after load in milliseconds."),
    waitUntil: scrapeWaitUntilSchema.optional().default("domcontentloaded").describe("Browser load event to wait for."),
    width: zod_1.z.number().int().positive().optional().default(1920).describe("Viewport width."),
    height: zod_1.z.number().int().positive().optional().default(1080).describe("Viewport height."),
    blockResources: zod_1.z.boolean().optional().default(true).describe("Block CSS, images, and fonts."),
    showFrames: zod_1.z.boolean().optional().default(false).describe("Include iframe content in ReturnJSON responses."),
    showWebsocketRequests: zod_1.z.boolean().optional().default(false).describe("Include websocket requests in ReturnJSON responses."),
    headers: headerRecordSchema.optional().describe("Header values to forward to Scrape.do for custom/extra/forward modes."),
    header_mode: headerModeSchema.optional().describe("Header forwarding mode: custom, extra, or forward."),
    headerMode: headerModeSchema.optional().describe("CamelCase alias for header_mode."),
    customHeaders: zod_1.z.boolean().optional().describe("Enable official customHeaders mode."),
    extraHeaders: zod_1.z.boolean().optional().describe("Enable official extraHeaders mode."),
    forwardHeaders: zod_1.z.boolean().optional().describe("Enable official forwardHeaders mode."),
    setCookies: zod_1.z.string().optional().describe("Cookies to send to the target page."),
    pureCookies: zod_1.z.boolean().optional().default(false).describe("Return original Set-Cookie headers."),
    disableRedirection: zod_1.z.boolean().optional().default(false).describe("Disable redirect following."),
    callback: zod_1.z.string().url().optional().describe("Webhook callback URL."),
}, async (params) => {
    try {
        ensureToken();
        const screenshotRequested = (params.screenshot ?? params.screenShot ?? false) || params.fullScreenShot || Boolean(params.particularScreenShot);
        const interactionRequested = Boolean(params.playWithBrowser?.length);
        const screenshotModeCount = [params.screenshot ?? params.screenShot ?? false, params.fullScreenShot, Boolean(params.particularScreenShot)].filter(Boolean).length;
        if (screenshotModeCount > 1) {
            return createErrorResult("Use only one screenshot mode at a time: screenShot, fullScreenShot, or particularScreenShot.");
        }
        if (params.particularScreenShot && interactionRequested) {
            return createErrorResult("particularScreenShot cannot be used together with playWithBrowser.");
        }
        const headerMode = resolveHeaderMode(params);
        const effectiveRender = (params.render_js ?? params.render ?? false) || params.returnJSON || params.showFrames || params.showWebsocketRequests || screenshotRequested || interactionRequested;
        const effectiveReturnJSON = params.returnJSON || params.showFrames || params.showWebsocketRequests || screenshotRequested || interactionRequested;
        const effectiveBlockResources = screenshotRequested || interactionRequested ? false : params.blockResources;
        const effectiveOutput = effectiveReturnJSON ? params.output : params.output ?? "markdown";
        const requestParams = compactObject({
            token: SCRAPE_DO_TOKEN,
            url: params.url,
            render: effectiveRender || undefined,
            super: params.super_proxy ?? params.super,
            geoCode: params.geoCode,
            regionalGeoCode: params.regionalGeoCode,
            device: params.device !== "desktop" ? params.device : undefined,
            sessionId: params.sessionId,
            timeout: params.timeout !== 60000 ? params.timeout : undefined,
            retryTimeout: params.retryTimeout,
            disableRetry: params.disableRetry || undefined,
            output: effectiveOutput,
            returnJSON: effectiveReturnJSON || undefined,
            transparentResponse: params.transparentResponse || undefined,
            screenShot: (params.screenshot ?? params.screenShot ?? false) || undefined,
            fullScreenShot: params.fullScreenShot || undefined,
            particularScreenShot: params.particularScreenShot,
            playWithBrowser: params.playWithBrowser?.length ? JSON.stringify(params.playWithBrowser) : undefined,
            waitSelector: params.waitSelector,
            customWait: params.customWait,
            waitUntil: params.waitUntil !== "domcontentloaded" ? params.waitUntil : undefined,
            width: params.width !== 1920 ? params.width : undefined,
            height: params.height !== 1080 ? params.height : undefined,
            blockResources: effectiveBlockResources === false ? false : undefined,
            showFrames: params.showFrames || undefined,
            showWebsocketRequests: params.showWebsocketRequests || undefined,
            customHeaders: headerMode === "custom" || params.customHeaders ? true : undefined,
            extraHeaders: headerMode === "extra" || params.extraHeaders ? true : undefined,
            forwardHeaders: headerMode === "forward" || params.forwardHeaders ? true : undefined,
            setCookies: params.setCookies,
            pureCookies: params.pureCookies || undefined,
            disableRedirection: params.disableRedirection || undefined,
            callback: params.callback,
        });
        const headers = buildForwardedHeaders(params.headers, headerMode);
        const { text } = await requestText({
            method: "GET",
            url: SCRAPE_API_BASE,
            params: requestParams,
            headers,
            timeout: Math.min(params.timeout ?? 60000, 120000),
        });
        const parsed = tryParseJson(text);
        const images = screenshotRequested || interactionRequested ? collectImageMatches(parsed ?? text) : [];
        if (images.length > 0) {
            const note = images.length === 1 ? "Captured screenshot from Scrape.do." : `Captured ${images.length} screenshots from Scrape.do.`;
            return createImageResult(images, note);
        }
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("google_search", "Search Google with Scrape.do's structured SERP API. Supports localization, google_domain, UULE/location targeting, filters, pagination, and optional raw HTML.", {
    query: zod_1.z.string().optional().describe("Alias for q. Search query."),
    q: zod_1.z.string().optional().describe("Official Google Search query parameter."),
    country: zod_1.z.string().optional().default("us").describe("Alias for gl. Country code."),
    gl: zod_1.z.string().optional().describe("Official Google geo-location parameter."),
    language: zod_1.z.string().optional().default("en").describe("Alias for hl. Interface language."),
    hl: zod_1.z.string().optional().describe("Official Google interface language parameter."),
    domain: zod_1.z.string().optional().describe("Deprecated alias for google_domain."),
    google_domain: zod_1.z.string().optional().describe("Official Google domain parameter."),
    page: zod_1.z.number().int().positive().optional().default(1).describe("1-based page number."),
    start: zod_1.z.number().int().min(0).optional().describe("Official Google result offset. Overrides page."),
    num: zod_1.z.number().int().positive().optional().describe("Number of results per page."),
    time_period: googleTimePeriodSchema.optional().describe("Time-based search filter."),
    device: zod_1.z.enum(["desktop", "mobile"]).optional().default("desktop").describe("SERP layout device."),
    includeHtml: zod_1.z.boolean().optional().describe("Alias for include_html."),
    include_html: zod_1.z.boolean().optional().describe("Include raw Google HTML in the response."),
    location: zod_1.z.string().optional().describe("Canonical Google location string."),
    uule: zod_1.z.string().optional().describe("UULE-encoded location string."),
    lr: zod_1.z.string().optional().describe("Strict language filter such as lang_en."),
    cr: zod_1.z.string().optional().describe("Strict country filter such as countryUS."),
    safe: zod_1.z.string().optional().describe("SafeSearch mode. Use active to filter adult content."),
    nfpr: zod_1.z.boolean().optional().describe("Disable spelling correction."),
    filter: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().describe("Result filtering control. Use 0 to disable similar/omitted result filtering."),
}, async (params) => {
    try {
        ensureToken();
        const query = params.query ?? params.q;
        if (!query) {
            return createErrorResult("Error: query or q is required.");
        }
        const start = params.start ?? Math.max((params.page - 1) * (params.num ?? 10), 0);
        const requestParams = compactObject({
            token: SCRAPE_DO_TOKEN,
            q: query,
            gl: params.gl ?? params.country,
            hl: params.hl ?? params.language,
            google_domain: params.google_domain ?? params.domain,
            start,
            num: params.num,
            time_period: params.time_period,
            device: params.device,
            include_html: params.include_html ?? params.includeHtml ? true : undefined,
            location: params.location,
            uule: params.uule,
            lr: params.lr,
            cr: params.cr,
            safe: params.safe,
            nfpr: params.nfpr,
            filter: params.filter,
        });
        const { text } = await requestText({
            method: "GET",
            url: `${SCRAPE_API_BASE}/plugin/google/search`,
            params: requestParams,
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("amazon_product", "Get structured Amazon product detail data with the official Scrape.do Amazon PDP API.", {
    asin: zod_1.z.string().min(1).describe("Amazon ASIN."),
    geocode: zod_1.z.string().min(1).describe("Amazon marketplace country code."),
    zipcode: zod_1.z.string().min(1).describe("ZIP/postal code for geo-targeting."),
    super_proxy: zod_1.z.boolean().optional().describe("Alias for super."),
    super: zod_1.z.boolean().optional().describe("Official Amazon super proxy flag."),
    language: zod_1.z.string().optional().describe("ISO 639-1 language code."),
    includeHtml: zod_1.z.boolean().optional().describe("Alias for include_html."),
    include_html: zod_1.z.boolean().optional().describe("Include raw HTML in the JSON response."),
}, async (params) => {
    try {
        ensureToken();
        const requestParams = compactObject({
            token: SCRAPE_DO_TOKEN,
            asin: params.asin,
            geocode: params.geocode,
            zipcode: params.zipcode,
            super: params.super_proxy ?? params.super,
            language: params.language,
            include_html: params.include_html ?? params.includeHtml ? true : undefined,
        });
        const { text } = await requestText({
            method: "GET",
            url: `${SCRAPE_API_BASE}/plugin/amazon/pdp`,
            params: requestParams,
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("amazon_offer_listing", "Get all seller offers for an Amazon product with structured pricing, fulfillment, and Buy Box data.", {
    asin: zod_1.z.string().min(1).describe("Amazon ASIN."),
    geocode: zod_1.z.string().min(1).describe("Amazon marketplace country code."),
    zipcode: zod_1.z.string().min(1).describe("ZIP/postal code for geo-targeting."),
    super_proxy: zod_1.z.boolean().optional().describe("Alias for super."),
    super: zod_1.z.boolean().optional().describe("Official Amazon super proxy flag."),
    includeHtml: zod_1.z.boolean().optional().describe("Alias for include_html."),
    include_html: zod_1.z.boolean().optional().describe("Include raw HTML in the JSON response."),
}, async (params) => {
    try {
        ensureToken();
        const requestParams = compactObject({
            token: SCRAPE_DO_TOKEN,
            asin: params.asin,
            geocode: params.geocode,
            zipcode: params.zipcode,
            super: params.super_proxy ?? params.super,
            include_html: params.include_html ?? params.includeHtml ? true : undefined,
        });
        const { text } = await requestText({
            method: "GET",
            url: `${SCRAPE_API_BASE}/plugin/amazon/offer-listing`,
            params: requestParams,
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("amazon_search", "Search Amazon or scrape Amazon category-style result pages with structured product listings.", {
    keyword: zod_1.z.string().min(1).describe("Amazon keyword query."),
    geocode: zod_1.z.string().min(1).describe("Amazon marketplace country code."),
    zipcode: zod_1.z.string().min(1).describe("ZIP/postal code for geo-targeting."),
    page: zod_1.z.number().int().positive().optional().default(1).describe("Page number."),
    super_proxy: zod_1.z.boolean().optional().describe("Alias for super."),
    super: zod_1.z.boolean().optional().describe("Official Amazon super proxy flag."),
    language: zod_1.z.string().optional().describe("ISO 639-1 language code."),
    includeHtml: zod_1.z.boolean().optional().describe("Alias for include_html."),
    include_html: zod_1.z.boolean().optional().describe("Include raw HTML in the JSON response."),
}, async (params) => {
    try {
        ensureToken();
        const requestParams = compactObject({
            token: SCRAPE_DO_TOKEN,
            keyword: params.keyword,
            geocode: params.geocode,
            zipcode: params.zipcode,
            page: params.page !== 1 ? params.page : undefined,
            super: params.super_proxy ?? params.super,
            language: params.language,
            include_html: params.include_html ?? params.includeHtml ? true : undefined,
        });
        const { text } = await requestText({
            method: "GET",
            url: `${SCRAPE_API_BASE}/plugin/amazon/search`,
            params: requestParams,
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("amazon_raw_html", "Get raw HTML from any Amazon URL with ZIP-code geo-targeting.", {
    url: zod_1.z.string().url().describe("Full Amazon URL to scrape."),
    geocode: zod_1.z.string().min(1).describe("Amazon marketplace country code."),
    zipcode: zod_1.z.string().min(1).describe("ZIP/postal code for geo-targeting."),
    super_proxy: zod_1.z.boolean().optional().describe("Alias for super."),
    super: zod_1.z.boolean().optional().describe("Official Amazon super proxy flag."),
    language: zod_1.z.string().optional().describe("ISO 639-1 language code."),
    timeout: zod_1.z.number().int().positive().optional().describe("Request timeout in milliseconds."),
}, async (params) => {
    try {
        ensureToken();
        const requestParams = compactObject({
            token: SCRAPE_DO_TOKEN,
            url: params.url,
            geocode: params.geocode,
            zipcode: params.zipcode,
            output: "html",
            super: params.super_proxy ?? params.super,
            language: params.language,
            timeout: params.timeout,
        });
        const { text } = await requestText({
            method: "GET",
            url: `${SCRAPE_API_BASE}/plugin/amazon/`,
            params: requestParams,
            timeout: params.timeout ?? 60000,
        });
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("async_create_job", "Create a Scrape.do Async API job for batch/background scraping.", {
    targets: zod_1.z.array(zod_1.z.string().url()).min(1).describe("URLs to scrape."),
    method: asyncMethodSchema.optional().default("GET").describe("HTTP method for the job."),
    body: zod_1.z.string().optional().describe("Request body for POST/PUT/PATCH jobs."),
    geoCode: zod_1.z.string().optional().describe("Country code."),
    regionalGeoCode: zod_1.z.string().optional().describe("Regional code."),
    super_proxy: zod_1.z.boolean().optional().describe("Use residential/mobile proxies."),
    headers: headerRecordSchema.optional().describe("Headers to send with the upstream request."),
    forwardHeaders: zod_1.z.boolean().optional().describe("Use only provided headers instead of merging with Scrape.do headers."),
    sessionId: zod_1.z.union([zod_1.z.number().int(), zod_1.z.string()]).optional().describe("Sticky session ID."),
    device: zod_1.z.enum(["desktop", "mobile", "tablet"]).optional().describe("Device type."),
    setCookies: zod_1.z.string().optional().describe("Cookies to include."),
    timeout: zod_1.z.number().int().positive().optional().describe("Request timeout in milliseconds."),
    retryTimeout: zod_1.z.number().int().positive().optional().describe("Retry timeout in milliseconds."),
    disableRetry: zod_1.z.boolean().optional().describe("Disable automatic retries."),
    transparentResponse: zod_1.z.boolean().optional().describe("Return raw target response."),
    disableRedirection: zod_1.z.boolean().optional().describe("Disable redirects."),
    output: zod_1.z.enum(["raw", "markdown"]).optional().describe("Output format."),
    render: zod_1.z
        .object({
        blockResources: zod_1.z.boolean().optional(),
        waitUntil: asyncWaitUntilSchema.optional(),
        customWait: zod_1.z.number().int().min(0).max(35000).optional(),
        waitSelector: zod_1.z.string().optional(),
        playWithBrowser: zod_1.z.array(browserActionSchema).optional(),
        returnJSON: zod_1.z.boolean().optional(),
        showWebsocketRequests: zod_1.z.boolean().optional(),
        showFrames: zod_1.z.boolean().optional(),
        screenshot: zod_1.z.boolean().optional(),
        fullScreenshot: zod_1.z.boolean().optional(),
        particularScreenshot: zod_1.z.string().optional(),
    })
        .optional()
        .describe("Headless browser configuration."),
    webhookUrl: zod_1.z.string().url().optional().describe("Webhook URL to receive results."),
    webhookHeaders: headerRecordSchema.optional().describe("Extra headers for the webhook request."),
}, async (params) => {
    try {
        ensureToken();
        const render = params.render
            ? compactObject({
                BlockResources: params.render.blockResources,
                WaitUntil: params.render.waitUntil,
                CustomWait: params.render.customWait,
                WaitSelector: params.render.waitSelector,
                PlayWithBrowser: params.render.playWithBrowser,
                ReturnJSON: params.render.returnJSON,
                ShowWebsocketRequests: params.render.showWebsocketRequests,
                ShowFrames: params.render.showFrames,
                Screenshot: params.render.screenshot,
                FullScreenshot: params.render.fullScreenshot,
                ParticularScreenshot: params.render.particularScreenshot,
            })
            : undefined;
        const body = compactObject({
            Targets: params.targets,
            Method: params.method,
            Body: params.body,
            GeoCode: params.geoCode,
            RegionalGeoCode: params.regionalGeoCode,
            Super: params.super_proxy,
            Headers: normalizeHeaderRecord(params.headers),
            ForwardHeaders: params.forwardHeaders,
            SessionID: params.sessionId !== undefined ? String(params.sessionId) : undefined,
            Device: params.device,
            SetCookies: params.setCookies,
            Timeout: params.timeout,
            RetryTimeout: params.retryTimeout,
            DisableRetry: params.disableRetry,
            TransparentResponse: params.transparentResponse,
            DisableRedirection: params.disableRedirection,
            Output: params.output,
            Render: render && Object.keys(render).length > 0 ? render : undefined,
            WebhookURL: params.webhookUrl,
            WebhookHeaders: normalizeHeaderRecord(params.webhookHeaders),
        });
        const { text } = await requestText({
            method: "POST",
            url: `${ASYNC_API_BASE}/api/v1/jobs`,
            headers: {
                "Content-Type": "application/json",
                "X-Token": SCRAPE_DO_TOKEN,
            },
            data: body,
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("async_get_job", "Get Scrape.do Async API job details by job ID.", {
    jobId: zod_1.z.string().min(1).describe("Job ID returned by async_create_job."),
}, async ({ jobId }) => {
    try {
        ensureToken();
        const { text } = await requestText({
            method: "GET",
            url: `${ASYNC_API_BASE}/api/v1/jobs/${encodeURIComponent(jobId)}`,
            headers: {
                "X-Token": SCRAPE_DO_TOKEN,
            },
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("async_get_task", "Get Scrape.do Async API task details by job ID and task ID.", {
    jobId: zod_1.z.string().min(1).describe("Job ID."),
    taskId: zod_1.z.string().min(1).describe("Task ID."),
}, async ({ jobId, taskId }) => {
    try {
        ensureToken();
        const { text } = await requestText({
            method: "GET",
            url: `${ASYNC_API_BASE}/api/v1/jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(taskId)}`,
            headers: {
                "X-Token": SCRAPE_DO_TOKEN,
            },
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("async_list_jobs", "List Scrape.do Async API jobs with pagination.", {
    page: zod_1.z.number().int().positive().optional().default(1).describe("Page number."),
    pageSize: zod_1.z.number().int().positive().max(100).optional().default(10).describe("Items per page."),
}, async ({ page, pageSize }) => {
    try {
        ensureToken();
        const { text } = await requestText({
            method: "GET",
            url: `${ASYNC_API_BASE}/api/v1/jobs`,
            params: {
                page,
                page_size: pageSize,
            },
            headers: {
                "X-Token": SCRAPE_DO_TOKEN,
            },
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("async_cancel_job", "Cancel a Scrape.do Async API job.", {
    jobId: zod_1.z.string().min(1).describe("Job ID to cancel."),
}, async ({ jobId }) => {
    try {
        ensureToken();
        const { text } = await requestText({
            method: "DELETE",
            url: `${ASYNC_API_BASE}/api/v1/jobs/${encodeURIComponent(jobId)}`,
            headers: {
                "X-Token": SCRAPE_DO_TOKEN,
            },
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("async_get_account", "Get Scrape.do Async API account/concurrency information.", {}, async () => {
    try {
        ensureToken();
        const { text } = await requestText({
            method: "GET",
            url: `${ASYNC_API_BASE}/api/v1/me`,
            headers: {
                "X-Token": SCRAPE_DO_TOKEN,
            },
            timeout: 60000,
        });
        const parsed = tryParseJson(text);
        if (parsed !== undefined) {
            return createJsonResult(parsed);
        }
        return createTextResult(text);
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
server.tool("proxy_mode_config", "Generate Scrape.do Proxy Mode configuration and parameter strings without exposing your configured token.", {
    params: headerRecordSchema.optional().describe("Proxy mode query parameters to place into the password segment."),
}, async ({ params }) => {
    try {
        ensureToken();
        const parameterString = buildProxyParameterString(params);
        return createJsonResult({
            protocol: "http or https",
            host: "proxy.scrape.do",
            port: 8080,
            username: "<SCRAPE_DO_TOKEN>",
            password: parameterString,
            proxy_url_template: `http://<SCRAPE_DO_TOKEN>:${parameterString}@proxy.scrape.do:8080`,
            ca_certificate_url: "https://scrape.do/scrapedo_ca.crt",
        });
    }
    catch (error) {
        return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
