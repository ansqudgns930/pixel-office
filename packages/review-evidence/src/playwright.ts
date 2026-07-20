import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import type {
  FrontendCapture,
  FrontendCaptureAdapter,
  FrontendCaptureRequest,
  FrontendEvidenceManifest,
  FrontendState,
} from "./index.js";

const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex"),
  states: FrontendState[] = [
    "primary",
    "loading",
    "empty",
    "error",
    "permission",
  ];
export class PlaywrightFrontendCaptureAdapter
  implements FrontendCaptureAdapter
{
  constructor(
    private readonly executablePath: string,
    private readonly timeoutMs = 20_000,
  ) {}
  async capture(
    request: FrontendCaptureRequest,
  ): Promise<FrontendEvidenceManifest> {
    const captures: FrontendCapture[] = [],
      missingStates: FrontendState[] = [],
      browser = await chromium.launch({
        executablePath: this.executablePath,
        headless: true,
      });
    let observedVersion: string | null = null,
      failure: string | null = null;
    try {
      const context = await browser.newContext();
      const capture = async (
        state: FrontendState,
        viewport: "desktop" | "mobile",
        width: number,
        height: number,
        url: string,
      ) => {
        const page = await context.newPage();
        await page.setViewportSize({ width, height });
        try {
          await page.goto(url, {
            waitUntil: "networkidle",
            timeout: this.timeoutMs,
          });
          const version = await page
            .locator('meta[name="agent-company-build-version"]')
            .getAttribute("content");
          if (state === "primary" && viewport === "desktop")
            observedVersion = version;
          const bytes = await page.screenshot({ fullPage: true, type: "png" }),
            buffer = Buffer.from(bytes);
          captures.push({
            state,
            viewport,
            url,
            status: "captured",
            mimeType: "image/png",
            sha256: sha(buffer),
            dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
            width,
            height,
            capturedAt: new Date().toISOString(),
            failure: null,
          });
        } catch (error) {
          captures.push({
            state,
            viewport,
            url,
            status: "failed",
            mimeType: "image/png",
            sha256: null,
            dataUrl: null,
            width,
            height,
            capturedAt: null,
            failure: error instanceof Error ? error.message : String(error),
          });
          if (!missingStates.includes(state)) missingStates.push(state);
        } finally {
          await page.close();
        }
      };
      for (const state of states) {
        const route = request.routes[state];
        if (!route) {
          missingStates.push(state);
          continue;
        }
        const url = new URL(route, request.previewUrl).toString();
        await capture(state, "desktop", 1440, 1000, url);
        if (state === "primary") await capture(state, "mobile", 390, 844, url);
      }
      if (observedVersion !== request.expectedVersion) {
        failure = `preview version mismatch: expected ${request.expectedVersion}, observed ${observedVersion ?? "missing"}`;
        if (!missingStates.includes("primary")) missingStates.push("primary");
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    } finally {
      await browser.close();
    }
    const status = missingStates.length || failure ? "failed" : "captured";
    return {
      applicability: "web",
      status,
      previewUrl: request.previewUrl,
      expectedVersion: request.expectedVersion,
      observedVersion,
      scenario: request.scenario,
      manual: request.manual,
      captures,
      missingStates: [...new Set(missingStates)],
      failure,
      exemptionReason: null,
    };
  }
}
