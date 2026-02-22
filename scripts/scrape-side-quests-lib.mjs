import { JSDOM } from 'jsdom';

export const FAQ_URL = 'https://www.tpkbrewing.com/faq';
export const SERVICE_PAGE_URL =
  'https://www.tpkbrewing.com/service-page/private-game-leyfarer-content-4-hr?category=36816173-529a-40ff-b6d5-769c978b58a3';
export const BOOK_ONLINE_URL =
  'https://www.tpkbrewing.com/book-online?category=b90cf4ec-ae00-4071-9766-9ea7454a5708';

export const SOURCE_URLS = [FAQ_URL, SERVICE_PAGE_URL, BOOK_ONLINE_URL];

export const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

export const normalizeQuestKey = (value) =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const stripTrailingMarker = (value) =>
  value
    .replace(/\s*-\s*Available\s+\d{1,2}\/\d{1,2}\s*$/i, '')
    .replace(/\s*\((?:Level[^)]*|\d{1,2}\/\d{1,2}|[^)]*Scaling[^)]*)\)\s*$/i, '')
    .trim();

export const normalizeQuestName = (value) => {
  const stripped = normalizeWhitespace(value)
    .replace(/^[-•]\s*/, '')
    .replace(/^Leyfarer Quest:\s*/i, '');

  return stripTrailingMarker(stripped);
};

export const fetchDocument = async (url) => {
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }

  const html = await response.text();
  return new JSDOM(html).window.document;
};

const parseHtml = (html) => new JSDOM(html).window.document;

const normalizeUrl = (href, baseUrl) => {
  const text = normalizeWhitespace(href ?? '');
  if (!text) {
    return undefined;
  }

  try {
    return new globalThis.URL(text, baseUrl).toString();
  } catch {
    return undefined;
  }
};

export const parseFaqEntries = (document) => {
  const names = new Set();

  document.querySelectorAll('ul.EG7tb li').forEach((item) => {
    const titleNode = item.querySelector('strong');
    if (!titleNode) {
      return;
    }

    const raw = normalizeWhitespace(titleNode.textContent ?? '');
    const name = normalizeQuestName(raw);
    if (name) {
      names.add(name);
    }
  });

  return Array.from(names).map((name) => ({ name }));
};

export const parseFaqEntriesFromHtml = (html) => parseFaqEntries(parseHtml(html));

const parseServiceDescriptionLines = (document) => {
  const descriptionNode = document.querySelector('p[data-hook="description"]');
  const text = descriptionNode?.textContent ?? '';
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

export const parseServicePageEntries = (document) => {
  const lines = parseServiceDescriptionLines(document);
  const entriesByKey = new Map();

  let section = 'none';
  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.includes('leyfarer side quests')) {
      section = 'side-quests';
      continue;
    }

    if (lower.includes("val'ruvina backstory") || lower.includes('val’ruvina backstory')) {
      section = 'backstory';
      continue;
    }

    if (!line.startsWith('-')) {
      continue;
    }

    if (section === 'side-quests') {
      const name = normalizeQuestName(line);
      if (!name) {
        continue;
      }

      entriesByKey.set(normalizeQuestKey(name), { name });
      continue;
    }

    if (section === 'backstory') {
      const trimmed = line.replace(/^[-•]\s*/, '').trim();
      const separator = trimmed.indexOf(':');
      if (separator < 1) {
        continue;
      }

      const name = normalizeQuestName(trimmed.slice(0, separator));
      const description = normalizeWhitespace(
        trimmed
          .slice(separator + 1)
          .replace(/\s*\(Level[^)]*\)\s*$/i, '')
      );

      if (!name) {
        continue;
      }

      entriesByKey.set(normalizeQuestKey(name), {
        name,
        ...(description ? { description } : {})
      });
    }
  }

  return Array.from(entriesByKey.values());
};

export const parseServicePageEntriesFromHtml = (html) => parseServicePageEntries(parseHtml(html));

export const parseBookOnlineEntries = (document) => {
  const entriesByKey = new Map();

  document.querySelectorAll('section[data-hook="service-card-default-card"]').forEach((card) => {
    const titleNode = card.querySelector('[data-hook="service-info-title-text"]');
    const rawTitle = normalizeWhitespace(titleNode?.textContent ?? '');

    if (!/^Leyfarer Quest:/i.test(rawTitle)) {
      return;
    }

    const name = normalizeQuestName(rawTitle);
    if (!name) {
      return;
    }

    const readMoreHref =
      card.querySelector('[data-hook="more-info-button-root"]')?.getAttribute('href') ??
      card.querySelector('[data-hook="service-info-title-link"]')?.getAttribute('href');

    const bookingUrl = normalizeUrl(readMoreHref, BOOK_ONLINE_URL);
    const key = normalizeQuestKey(name);

    const existing = entriesByKey.get(key);
    if (!existing) {
      entriesByKey.set(key, {
        name,
        ...(bookingUrl ? { 'booking-url': bookingUrl } : {})
      });
      return;
    }

    if (!existing['booking-url'] && bookingUrl) {
      entriesByKey.set(key, {
        ...existing,
        'booking-url': bookingUrl
      });
    }
  });

  return Array.from(entriesByKey.values());
};

export const parseBookOnlineEntriesFromHtml = (html) => parseBookOnlineEntries(parseHtml(html));

export const parseBookingPageDescription = (document) => {
  const descriptionNode = document.querySelector('p[data-hook="description"]');
  const text = normalizeWhitespace(descriptionNode?.textContent ?? '');
  return text || undefined;
};

export const parseBookingPageDescriptionFromHtml = (html) =>
  parseBookingPageDescription(parseHtml(html));

export const mergeEntries = (...entryGroups) => {
  const mergedByKey = new Map();

  entryGroups.flat().forEach((entry) => {
    const name = normalizeQuestName(entry.name ?? '');
    if (!name) {
      return;
    }

    const key = normalizeQuestKey(name);
    const existing = mergedByKey.get(key);
    if (!existing) {
      mergedByKey.set(key, {
        name,
        ...(entry.description ? { description: normalizeWhitespace(entry.description) } : {}),
        ...(entry['booking-url'] ? { 'booking-url': entry['booking-url'] } : {})
      });
      return;
    }

    mergedByKey.set(key, {
      ...existing,
      ...(entry.description ? { description: normalizeWhitespace(entry.description) } : {}),
      ...(entry['booking-url'] ? { 'booking-url': entry['booking-url'] } : {})
    });
  });

  return Array.from(mergedByKey.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const attachBookingDescriptions = async (entries) => {
  const withDescriptions = [];

  for (const entry of entries) {
    if (!entry['booking-url']) {
      withDescriptions.push(entry);
      continue;
    }

    try {
      const bookingDocument = await fetchDocument(entry['booking-url']);
      const bookingDescription = parseBookingPageDescription(bookingDocument);

      withDescriptions.push(
        bookingDescription
          ? {
              ...entry,
              description: bookingDescription
            }
          : entry
      );
    } catch (error) {
      globalThis.console.warn(
        `[warn] ${entry['booking-url']}: ${error instanceof Error ? error.message : String(error)}`
      );
      withDescriptions.push(entry);
    }
  }

  return withDescriptions;
};

export const scrapeSideQuests = async () => {
  const [faqDocument, serviceDocument, bookOnlineDocument] = await Promise.all([
    fetchDocument(FAQ_URL),
    fetchDocument(SERVICE_PAGE_URL),
    fetchDocument(BOOK_ONLINE_URL)
  ]);

  const faqEntries = parseFaqEntries(faqDocument);
  const serviceEntries = parseServicePageEntries(serviceDocument);
  const bookOnlineEntries = parseBookOnlineEntries(bookOnlineDocument);
  const bookOnlineWithDescriptions = await attachBookingDescriptions(bookOnlineEntries);

  return mergeEntries(faqEntries, serviceEntries, bookOnlineWithDescriptions);
};
