#!/usr/bin/env node

import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SERVER_VERSION = "0.3.0";
const SCRAPE_DO_TOKEN = process.env.SCRAPE_DO_TOKEN || "";
const SCRAPE_API_BASE = "https://api.scrape.do";
const ASYNC_API_BASE = "https://q.scrape.do";

const headerValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const headerRecordSchema = z.record(z.string(), headerValueSchema);
const browserActionSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
const headerModeSchema = z.enum(["custom", "extra", "forward"]);
const scrapeWaitUntilSchema = z.enum(["domcontentloaded", "load", "networkidle", "networkidle0", "networkidle2"]);
const asyncWaitUntilSchema = z.enum(["domcontentloaded", "networkidle0", "networkidle2"]);
const googleTimePeriodSchema = z.enum(["last_hour", "last_day", "last_week", "last_month", "last_year"]);
const asyncMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "HEAD", "DELETE"]);

type HeaderRecord = Record<string, string | number | boolean>;
type HeaderMode = z.infer<typeof headerModeSchema>;
type ImageMatch = {
  data: string;
  mimeType: string;
};

const server = new McpServer({
  name: "scrape-do-mcp",
  version: SERVER_VERSION,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactObject<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function stringifyUnknown(value: unknown): string {
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
  } catch {
    return String(value);
  }
}

function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function createErrorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function createTextResult(text: string, structuredContent?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

function createJsonResult(value: unknown) {
  if (isRecord(value)) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
      structuredContent: value,
    };
  }

  return createTextResult(JSON.stringify(value, null, 2));
}

function createImageResult(images: ImageMatch[], note?: string) {
  const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];

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

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
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

async function requestText(config: AxiosRequestConfig): Promise<{ text: string; headers: Record<string, string | string[] | undefined> }> {
  const response = await axios.request<unknown>({
    ...config,
    responseType: "text",
    transformResponse: [(value) => value],
  });

  return {
    text: stringifyUnknown(response.data),
    headers: response.headers as Record<string, string | string[] | undefined>,
  };
}

function normalizeHeaderRecord(value?: HeaderRecord): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry)]));
}

function resolveHeaderMode(input: {
  customHeaders?: boolean;
  extraHeaders?: boolean;
  forwardHeaders?: boolean;
  header_mode?: HeaderMode;
  headerMode?: HeaderMode;
  headers?: HeaderRecord;
}): HeaderMode | undefined {
  const modes = new Set<HeaderMode>();

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

function buildForwardedHeaders(headers: HeaderRecord | undefined, mode: HeaderMode | undefined): Record<string, string> | undefined {
  const normalizedHeaders = normalizeHeaderRecord(headers);

  if (!normalizedHeaders) {
    return undefined;
  }

  if (mode !== "extra") {
    return normalizedHeaders;
  }

  return Object.fromEntries(
    Object.entries(normalizedHeaders).map(([key, value]) => [key.toLowerCase().startsWith("sd-") ? key : `sd-${key}`, value]),
  );
}

function inferMimeTypeFromBase64(value: string): string | undefined {
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

function maybeImageMatch(value: string): ImageMatch | undefined {
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

function collectImageMatches(value: unknown, results: ImageMatch[] = [], seen = new Set<string>()): ImageMatch[] {
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

function buildProxyParameterString(params?: HeaderRecord): string {
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

server.tool(
  "scrape_url",
  "Scrape a webpage with the official Scrape.do API. Supports Markdown/raw output, JS rendering, screenshots, browser interactions, geo-targeting, header forwarding, session persistence, and ReturnJSON features.",
  {
    url: z.string().url().describe("The target URL to scrape"),
    render_js: z.boolean().optional().describe("Alias for render. Render JavaScript for SPA or dynamic pages."),
    render: z.boolean().optional().describe("Official Scrape.do render parameter."),
    super_proxy: z.boolean().optional().describe("Alias for super. Use residential/mobile proxies."),
    super: z.boolean().optional().describe("Official Scrape.do super parameter."),
    geoCode: z.string().optional().describe("Country code for geo-targeting."),
    regionalGeoCode: z.string().optional().describe("Regional geo-targeting code."),
    device: z.enum(["desktop", "mobile", "tablet"]).optional().default("desktop").describe("Device type to emulate."),
    sessionId: z.union([z.number().int(), z.string()]).optional().describe("Sticky session ID."),
    timeout: z.number().int().positive().optional().default(60000).describe("Maximum timeout in milliseconds."),
    retryTimeout: z.number().int().positive().optional().describe("Retry timeout in milliseconds."),
    disableRetry: z.boolean().optional().default(false).describe("Disable automatic retries."),
    output: z.enum(["markdown", "raw"]).optional().describe("Output format. MCP defaults to markdown unless ReturnJSON is used."),
    returnJSON: z.boolean().optional().default(false).describe("Return JSON with network requests/content."),
    transparentResponse: z.boolean().optional().default(false).describe("Return the target response without Scrape.do post-processing."),
    screenshot: z.boolean().optional().describe("Alias for screenShot. Capture a viewport screenshot."),
    screenShot: z.boolean().optional().describe("Official Scrape.do screenshot parameter."),
    fullScreenShot: z.boolean().optional().default(false).describe("Capture a full-page screenshot."),
    particularScreenShot: z.string().optional().describe("Capture a screenshot of a specific CSS selector."),
    playWithBrowser: z.array(browserActionSchema).optional().describe("Browser interaction script for Scrape.do."),
    waitSelector: z.string().optional().describe("CSS selector to wait for."),
    customWait: z.number().int().min(0).optional().describe("Additional wait time after load in milliseconds."),
    waitUntil: scrapeWaitUntilSchema.optional().default("domcontentloaded").describe("Browser load event to wait for."),
    width: z.number().int().positive().optional().default(1920).describe("Viewport width."),
    height: z.number().int().positive().optional().default(1080).describe("Viewport height."),
    blockResources: z.boolean().optional().default(true).describe("Block CSS, images, and fonts."),
    showFrames: z.boolean().optional().default(false).describe("Include iframe content in ReturnJSON responses."),
    showWebsocketRequests: z.boolean().optional().default(false).describe("Include websocket requests in ReturnJSON responses."),
    headers: headerRecordSchema.optional().describe("Header values to forward to Scrape.do for custom/extra/forward modes."),
    header_mode: headerModeSchema.optional().describe("Header forwarding mode: custom, extra, or forward."),
    headerMode: headerModeSchema.optional().describe("CamelCase alias for header_mode."),
    customHeaders: z.boolean().optional().describe("Enable official customHeaders mode."),
    extraHeaders: z.boolean().optional().describe("Enable official extraHeaders mode."),
    forwardHeaders: z.boolean().optional().describe("Enable official forwardHeaders mode."),
    setCookies: z.string().optional().describe("Cookies to send to the target page."),
    pureCookies: z.boolean().optional().default(false).describe("Return original Set-Cookie headers."),
    disableRedirection: z.boolean().optional().default(false).describe("Disable redirect following."),
    callback: z.string().url().optional().describe("Webhook callback URL."),
  },
  async (params) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "google_search",
  "Search Google with Scrape.do's structured SERP API. Supports localization, google_domain, UULE/location targeting, filters, pagination, and optional raw HTML.",
  {
    query: z.string().optional().describe("Alias for q. Search query."),
    q: z.string().optional().describe("Official Google Search query parameter."),
    country: z.string().optional().default("us").describe("Alias for gl. Country code."),
    gl: z.string().optional().describe("Official Google geo-location parameter."),
    language: z.string().optional().default("en").describe("Alias for hl. Interface language."),
    hl: z.string().optional().describe("Official Google interface language parameter."),
    domain: z.string().optional().describe("Deprecated alias for google_domain."),
    google_domain: z.string().optional().describe("Official Google domain parameter."),
    page: z.number().int().positive().optional().default(1).describe("1-based page number."),
    start: z.number().int().min(0).optional().describe("Official Google result offset. Overrides page."),
    num: z.number().int().positive().optional().describe("Number of results per page."),
    time_period: googleTimePeriodSchema.optional().describe("Time-based search filter."),
    device: z.enum(["desktop", "mobile"]).optional().default("desktop").describe("SERP layout device."),
    includeHtml: z.boolean().optional().describe("Alias for include_html."),
    include_html: z.boolean().optional().describe("Include raw Google HTML in the response."),
    location: z.string().optional().describe("Canonical Google location string."),
    uule: z.string().optional().describe("UULE-encoded location string."),
    lr: z.string().optional().describe("Strict language filter such as lang_en."),
    cr: z.string().optional().describe("Strict country filter such as countryUS."),
    safe: z.string().optional().describe("SafeSearch mode. Use active to filter adult content."),
    nfpr: z.boolean().optional().describe("Disable spelling correction."),
    filter: z.union([z.string(), z.number()]).optional().describe("Result filtering control. Use 0 to disable similar/omitted result filtering."),
  },
  async (params) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "amazon_product",
  "Get structured Amazon product detail data with the official Scrape.do Amazon PDP API.",
  {
    asin: z.string().min(1).describe("Amazon ASIN."),
    geocode: z.string().min(1).describe("Amazon marketplace country code."),
    zipcode: z.string().min(1).describe("ZIP/postal code for geo-targeting."),
    super_proxy: z.boolean().optional().describe("Alias for super."),
    super: z.boolean().optional().describe("Official Amazon super proxy flag."),
    language: z.string().optional().describe("ISO 639-1 language code."),
    includeHtml: z.boolean().optional().describe("Alias for include_html."),
    include_html: z.boolean().optional().describe("Include raw HTML in the JSON response."),
  },
  async (params) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "amazon_offer_listing",
  "Get all seller offers for an Amazon product with structured pricing, fulfillment, and Buy Box data.",
  {
    asin: z.string().min(1).describe("Amazon ASIN."),
    geocode: z.string().min(1).describe("Amazon marketplace country code."),
    zipcode: z.string().min(1).describe("ZIP/postal code for geo-targeting."),
    super_proxy: z.boolean().optional().describe("Alias for super."),
    super: z.boolean().optional().describe("Official Amazon super proxy flag."),
    includeHtml: z.boolean().optional().describe("Alias for include_html."),
    include_html: z.boolean().optional().describe("Include raw HTML in the JSON response."),
  },
  async (params) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "amazon_search",
  "Search Amazon or scrape Amazon category-style result pages with structured product listings.",
  {
    keyword: z.string().min(1).describe("Amazon keyword query."),
    geocode: z.string().min(1).describe("Amazon marketplace country code."),
    zipcode: z.string().min(1).describe("ZIP/postal code for geo-targeting."),
    page: z.number().int().positive().optional().default(1).describe("Page number."),
    super_proxy: z.boolean().optional().describe("Alias for super."),
    super: z.boolean().optional().describe("Official Amazon super proxy flag."),
    language: z.string().optional().describe("ISO 639-1 language code."),
    includeHtml: z.boolean().optional().describe("Alias for include_html."),
    include_html: z.boolean().optional().describe("Include raw HTML in the JSON response."),
  },
  async (params) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "amazon_raw_html",
  "Get raw HTML from any Amazon URL with ZIP-code geo-targeting.",
  {
    url: z.string().url().describe("Full Amazon URL to scrape."),
    geocode: z.string().min(1).describe("Amazon marketplace country code."),
    zipcode: z.string().min(1).describe("ZIP/postal code for geo-targeting."),
    super_proxy: z.boolean().optional().describe("Alias for super."),
    super: z.boolean().optional().describe("Official Amazon super proxy flag."),
    language: z.string().optional().describe("ISO 639-1 language code."),
    timeout: z.number().int().positive().optional().describe("Request timeout in milliseconds."),
  },
  async (params) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "async_create_job",
  "Create a Scrape.do Async API job for batch/background scraping.",
  {
    targets: z.array(z.string().url()).min(1).describe("URLs to scrape."),
    method: asyncMethodSchema.optional().default("GET").describe("HTTP method for the job."),
    body: z.string().optional().describe("Request body for POST/PUT/PATCH jobs."),
    geoCode: z.string().optional().describe("Country code."),
    regionalGeoCode: z.string().optional().describe("Regional code."),
    super_proxy: z.boolean().optional().describe("Use residential/mobile proxies."),
    headers: headerRecordSchema.optional().describe("Headers to send with the upstream request."),
    forwardHeaders: z.boolean().optional().describe("Use only provided headers instead of merging with Scrape.do headers."),
    sessionId: z.union([z.number().int(), z.string()]).optional().describe("Sticky session ID."),
    device: z.enum(["desktop", "mobile", "tablet"]).optional().describe("Device type."),
    setCookies: z.string().optional().describe("Cookies to include."),
    timeout: z.number().int().positive().optional().describe("Request timeout in milliseconds."),
    retryTimeout: z.number().int().positive().optional().describe("Retry timeout in milliseconds."),
    disableRetry: z.boolean().optional().describe("Disable automatic retries."),
    transparentResponse: z.boolean().optional().describe("Return raw target response."),
    disableRedirection: z.boolean().optional().describe("Disable redirects."),
    output: z.enum(["raw", "markdown"]).optional().describe("Output format."),
    render: z
      .object({
        blockResources: z.boolean().optional(),
        waitUntil: asyncWaitUntilSchema.optional(),
        customWait: z.number().int().min(0).max(35000).optional(),
        waitSelector: z.string().optional(),
        playWithBrowser: z.array(browserActionSchema).optional(),
        returnJSON: z.boolean().optional(),
        showWebsocketRequests: z.boolean().optional(),
        showFrames: z.boolean().optional(),
        screenshot: z.boolean().optional(),
        fullScreenshot: z.boolean().optional(),
        particularScreenshot: z.string().optional(),
      })
      .optional()
      .describe("Headless browser configuration."),
    webhookUrl: z.string().url().optional().describe("Webhook URL to receive results."),
    webhookHeaders: headerRecordSchema.optional().describe("Extra headers for the webhook request."),
  },
  async (params) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "async_get_job",
  "Get Scrape.do Async API job details by job ID.",
  {
    jobId: z.string().min(1).describe("Job ID returned by async_create_job."),
  },
  async ({ jobId }) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "async_get_task",
  "Get Scrape.do Async API task details by job ID and task ID.",
  {
    jobId: z.string().min(1).describe("Job ID."),
    taskId: z.string().min(1).describe("Task ID."),
  },
  async ({ jobId, taskId }) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "async_list_jobs",
  "List Scrape.do Async API jobs with pagination.",
  {
    page: z.number().int().positive().optional().default(1).describe("Page number."),
    pageSize: z.number().int().positive().max(100).optional().default(10).describe("Items per page."),
  },
  async ({ page, pageSize }) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "async_cancel_job",
  "Cancel a Scrape.do Async API job.",
  {
    jobId: z.string().min(1).describe("Job ID to cancel."),
  },
  async ({ jobId }) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "async_get_account",
  "Get Scrape.do Async API account/concurrency information.",
  {},
  async () => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

server.tool(
  "proxy_mode_config",
  "Generate Scrape.do Proxy Mode configuration and parameter strings without exposing your configured token.",
  {
    params: headerRecordSchema.optional().describe("Proxy mode query parameters to place into the password segment."),
  },
  async ({ params }) => {
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
    } catch (error) {
      return createErrorResult(`Error: ${getErrorMessage(error)}`);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
