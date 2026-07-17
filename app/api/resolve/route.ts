import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer, { Browser } from 'puppeteer-core';
import type {
    ResolveErrorCode,
    ResolveRequest,
    ResolveResponse
} from '@/lib/types';
import { validateTeraBoxUrl } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOG_PREFIX = '[api/resolve]';

class ResolveApiError extends Error {
    constructor(
        public code: ResolveErrorCode,
        message: string,
        public status: number
    ) {
        super(message);
    }
}

function logInfo(stage: string, message: string, meta?: unknown): void {
    if (meta !== undefined) {
        console.info(`${LOG_PREFIX} [${stage}] ${message}`, meta);
        return;
    }

    console.info(`${LOG_PREFIX} [${stage}] ${message}`);
}

function toErrorResponse(error: unknown): NextResponse {
    if (error instanceof ResolveApiError) {
        return NextResponse.json(
            { success: false, code: error.code, message: error.message },
            { status: error.status }
        );
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
        return NextResponse.json(
            {
                success: false,
                code: 'TIMEOUT',
                message: 'TeraBox took too long to respond. Please try again.'
            },
            { status: 504 }
        );
    }

    console.error(`${LOG_PREFIX} [unexpected]`, error);

    return NextResponse.json(
        {
            success: false,
            code: 'TERABOX_RESOLVE_FAILED',
            message: 'Failed to resolve this TeraBox link. Please try again later.'
        },
        { status: 502 }
    );
}

function mapLaunchError(error: unknown): ResolveApiError {
    if (!(error instanceof Error)) {
        return new ResolveApiError(
            'BROWSER_LAUNCH_FAILED',
            'Unable to launch the browser in serverless runtime.',
            500
        );
    }

    const message = error.message.toLowerCase();

    if (
        message.includes('could not find chrome') ||
        message.includes('could not find chromium') ||
        message.includes('executable')
    ) {
        return new ResolveApiError(
            'CHROME_NOT_FOUND',
            'Chrome executable is unavailable in this environment.',
            500
        );
    }

    if (error.name === 'TimeoutError' || message.includes('timeout')) {
        return new ResolveApiError(
            'TIMEOUT',
            'Browser launch timed out. Please try again.',
            504
        );
    }

    return new ResolveApiError(
        'BROWSER_LAUNCH_FAILED',
        'Unable to launch the browser in serverless runtime.',
        500
    );
}

async function resolveWithBrowser(browser: Browser, url: string): Promise<ResolveResponse> {
    const page = await browser.newPage();
    logInfo('browser', 'New page created');

    await page.setRequestInterception(true);
    page.on('request', (request) => {
        request.continue();
    });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    logInfo('navigation', 'Navigating to TeraBox URL');
    await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    logInfo('extract', 'Extracting video metadata');

    const videoInfo = await page.evaluate(() => {
        const fileNameElement = document.querySelector('[class*="file-name"], [class*="fileName"], .filename, .file-name');
        const fileSizeElement = document.querySelector('[class*="file-size"], [class*="fileSize"], .filesize, .file-size');
        const videoElements = document.querySelectorAll('video');
        let videoSrc = null;

        if (videoElements.length > 0) {
            videoSrc = videoElements[0].src || videoElements[0].querySelector('source')?.src;
        }

        return {
            fileName: fileNameElement?.textContent?.trim() || 'video.mp4',
            fileSize: fileSizeElement?.textContent?.trim() || null,
            videoSrc
        };
    });

    if (videoInfo.videoSrc) {
        logInfo('extract', 'Resolved via video source URL');
        return {
            success: true,
            fileName: videoInfo.fileName,
            directUrl: videoInfo.videoSrc,
            size: videoInfo.fileSize || undefined,
            thumbnail: undefined,
            qualities: undefined
        };
    }

    logInfo('extract', 'Looking for download button fallback');

    try {
        await page.waitForSelector('a[href*="download"], [class*="download-btn"]', { timeout: 10000 });

        const downloadButton = await page.$('a[href*="download"], [class*="download-btn"]');

        if (downloadButton) {
            const downloadUrl = await new Promise<string>((resolve) => {
                const timeout = setTimeout(() => resolve(''), 10000);

                const responseListener = async (response: { url: () => string; headers: () => Record<string, string>; status: () => number; }) => {
                    const responseUrl = response.url();
                    const contentType = response.headers()['content-type'] || '';

                    if ((contentType.includes('video') || responseUrl.includes('.mp4')) &&
                        !responseUrl.includes('streaming') &&
                        !responseUrl.includes('m3u8')) {
                        clearTimeout(timeout);
                        page.off('response', responseListener);
                        resolve(responseUrl);
                    }

                    if (responseUrl.includes('download') && response.status() === 302) {
                        const location = response.headers()['location'];

                        if (location) {
                            clearTimeout(timeout);
                            page.off('response', responseListener);
                            resolve(location);
                        }
                    }
                };

                page.on('response', responseListener);

                downloadButton.click().catch(() => {
                    clearTimeout(timeout);
                    page.off('response', responseListener);
                    resolve('');
                });
            });

            if (downloadUrl) {
                logInfo('extract', 'Resolved via download button fallback');
                return {
                    success: true,
                    fileName: videoInfo.fileName,
                    directUrl: downloadUrl,
                    size: videoInfo.fileSize || undefined,
                    thumbnail: undefined,
                    qualities: undefined
                };
            }
        }
    } catch (error) {
        logInfo('extract', 'Download button fallback unavailable', error);
    }

    logInfo('extract', 'Trying script API fallback');

    const apiUrl = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));

        for (const script of scripts) {
            const content = script.textContent || '';
            const match = content.match(/download[^"']*["']([^"']+)/i);

            if (match) {
                return match[1];
            }
        }

        return null;
    });

    if (apiUrl) {
        try {
            const apiResponse = await page.evaluate(async (fetchUrl) => {
                const response = await fetch(fetchUrl);
                return await response.json();
            }, apiUrl);

            if (apiResponse && apiResponse.dlink) {
                logInfo('extract', 'Resolved via script API fallback');
                return {
                    success: true,
                    fileName: videoInfo.fileName,
                    directUrl: apiResponse.dlink,
                    size: videoInfo.fileSize || undefined,
                    thumbnail: undefined,
                    qualities: undefined
                };
            }
        } catch (error) {
            logInfo('extract', 'Script API fallback failed', error);
        }
    }

    throw new ResolveApiError(
        'TERABOX_RESOLVE_FAILED',
        'Unable to extract a direct video URL from this TeraBox link. The file may be private, blocked, or require login.',
        404
    );
}

/**
 * POST /api/resolve
 * Resolves a TeraBox share link using browser automation (Puppeteer)
 */
export async function POST(request: NextRequest) {
    let browser: Browser | null = null;

    try {
        let body: ResolveRequest;

        try {
            body = await request.json();
        } catch (error) {
            logInfo('request', 'Invalid JSON body', error);
            throw new ResolveApiError('INVALID_LINK', 'Invalid request format. Please provide a TeraBox URL.', 400);
        }

        if (!body?.url || typeof body.url !== 'string' || !validateTeraBoxUrl(body.url)) {
            throw new ResolveApiError(
                'INVALID_LINK',
                'Invalid TeraBox URL. Please paste a valid public TeraBox share link.',
                400
            );
        }

        logInfo('request', 'Starting TeraBox resolve', { url: body.url });

        try {
            const executablePath = await chromium.executablePath();

            browser = await puppeteer.launch({
                executablePath,
                args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
                headless: true
            });
        } catch (error) {
            throw mapLaunchError(error);
        }

        const response = await resolveWithBrowser(browser, body.url);
        logInfo('success', 'TeraBox resolve completed');
        return NextResponse.json(response, { status: 200 });
    } catch (error) {
        return toErrorResponse(error);
    } finally {
        if (browser) {
            try {
                await browser.close();
                logInfo('browser', 'Browser closed');
            } catch (closeError) {
                console.error(`${LOG_PREFIX} [browser] Failed to close browser`, closeError);
            }
        }
    }
}
