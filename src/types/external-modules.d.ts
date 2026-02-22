declare module 'qrcode' {
  export interface QRCodeToStringOptions {
    type?: 'svg' | 'utf8' | 'terminal';
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    width?: number;
  }

  export function toString(text: string, options?: QRCodeToStringOptions): Promise<string>;
}

declare module '../../scripts/scrape-side-quests-lib.mjs' {
  interface ScrapedEntry {
    name: string;
    description?: string;
    'booking-url'?: string;
  }

  export function normalizeQuestName(value: string): string;
  export function parseFaqEntriesFromHtml(html: string): ScrapedEntry[];
  export function parseServicePageEntriesFromHtml(html: string): ScrapedEntry[];
  export function parseBookOnlineEntriesFromHtml(html: string): ScrapedEntry[];
  export function parseBookingPageDescriptionFromHtml(html: string): string | undefined;
  export function mergeEntries(
    fromServicePage: ScrapedEntry[],
    fromBookOnline: ScrapedEntry[]
  ): ScrapedEntry[];
}

declare module '*.mjs';
