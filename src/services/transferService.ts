import { APP_VERSION, STORAGE } from '../config/constants';
import type { Item } from '../domain/types';
import { DomainValidationError, ensureAttunementLimit, normalizeItems } from '../domain/validators';
import type { StorageService } from '../storage';

const PORTABLE_SCHEMA_VERSION = 3;
const QR_PREFIX = 'LFIQR1';
const DEFAULT_QR_CHUNK_SIZE = 700;

export type ImportStrategy = 'replace' | 'merge';

export interface PortablePayloadV3 {
  schemaVersion: 3;
  exportedAt: string;
  appVersion: string;
  items: Item[];
}

interface PortablePayloadV2Legacy {
  schemaVersion?: 2;
  exportedAt?: unknown;
  appVersion?: unknown;
  items?: unknown;
}

interface PortablePayloadV1Legacy {
  schemaVersion?: 1;
  items?: unknown;
}

export interface PortableImportResult {
  strategy: ImportStrategy;
  importedItems: number;
}

export class PortableTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortableTransferError';
  }
}

const normalizeDateString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PortableTransferError(`payload.${field} is required`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PortableTransferError(`payload.${field} must be a valid date string`);
  }

  return date.toISOString();
};

const normalizePortablePayload = (value: unknown): PortablePayloadV3 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PortableTransferError('Import payload must be an object');
  }

  const payload = value as Record<string, unknown>;
  const schemaVersionRaw = payload.schemaVersion;
  const schemaVersion = typeof schemaVersionRaw === 'number' ? schemaVersionRaw : 1;

  if (schemaVersion === 1) {
    const legacy = payload as PortablePayloadV1Legacy;
    const migratedItems = normalizeItems(legacy.items);
    ensureAttunementLimit(migratedItems);

    return {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      appVersion: 'legacy',
      items: migratedItems
    };
  }

  if (schemaVersion === 2) {
    const legacy = payload as PortablePayloadV2Legacy;
    const items = normalizeItems(legacy.items);
    ensureAttunementLimit(items);

    return {
      schemaVersion: 3,
      exportedAt: normalizeDateString(legacy.exportedAt, 'exportedAt'),
      appVersion:
        typeof legacy.appVersion === 'string' && legacy.appVersion.trim()
          ? legacy.appVersion.trim()
          : 'legacy',
      items
    };
  }

  if (schemaVersion !== PORTABLE_SCHEMA_VERSION) {
    throw new PortableTransferError(
      `Unsupported payload schemaVersion ${String(schemaVersionRaw)}. Expected ${PORTABLE_SCHEMA_VERSION}, 2, or 1.`
    );
  }

  const items = normalizeItems(payload.items);
  ensureAttunementLimit(items);

  return {
    schemaVersion: 3,
    exportedAt: normalizeDateString(payload.exportedAt, 'exportedAt'),
    appVersion:
      typeof payload.appVersion === 'string' && payload.appVersion.trim()
        ? payload.appVersion.trim()
        : APP_VERSION,
    items
  };
};

const encodeBase64Url = (value: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  const encoded = btoa(unescape(encodeURIComponent(value)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const decodeBase64Url = (value: string): string => {
  const withBase64Chars = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = withBase64Chars + '='.repeat((4 - (withBase64Chars.length % 4)) % 4);

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  return decodeURIComponent(escape(atob(padded)));
};

const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
  const map = new Map<string, T>();

  for (const entry of current) {
    map.set(entry.id, entry);
  }

  for (const entry of incoming) {
    map.set(entry.id, entry);
  }

  return Array.from(map.values());
};

const parseQrChunks = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

export class TransferService {
  constructor(private readonly storageService: StorageService) {}

  async exportPayload(): Promise<PortablePayloadV3> {
    const items = normalizeItems(await this.storageService.read(STORAGE.keys.items));
    ensureAttunementLimit(items);

    return {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      items
    };
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.exportPayload(), null, 2);
  }

  async importPayload(payload: unknown, strategy: ImportStrategy): Promise<PortableImportResult> {
    const normalized = normalizePortablePayload(payload);
    const importedItems = normalized.items;

    if (strategy === 'replace') {
      await this.storageService.write(STORAGE.keys.items, importedItems);
      return {
        strategy,
        importedItems: importedItems.length
      };
    }

    const currentItems = normalizeItems(await this.storageService.read(STORAGE.keys.items));
    const mergedItems = mergeById(currentItems, importedItems);
    ensureAttunementLimit(mergedItems);

    await this.storageService.write(STORAGE.keys.items, mergedItems);

    return {
      strategy,
      importedItems: mergedItems.length
    };
  }

  async importJson(jsonPayload: string, strategy: ImportStrategy): Promise<PortableImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonPayload);
    } catch {
      throw new PortableTransferError('Import failed: payload is not valid JSON');
    }

    return this.importPayload(parsed, strategy);
  }

  encodePayloadToQrChunks(payload: PortablePayloadV3, chunkSize = DEFAULT_QR_CHUNK_SIZE): string[] {
    if (!Number.isInteger(chunkSize) || chunkSize < 120) {
      throw new PortableTransferError('QR chunk size must be an integer greater than or equal to 120');
    }

    const encoded = encodeBase64Url(JSON.stringify(payload));
    const transferId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const total = Math.max(1, Math.ceil(encoded.length / chunkSize));

    return Array.from({ length: total }, (_, index) => {
      const start = index * chunkSize;
      const end = start + chunkSize;
      const chunk = encoded.slice(start, end);
      return `${QR_PREFIX}:${transferId}:${total}:${index + 1}:${chunk}`;
    });
  }

  decodePayloadFromQrChunks(scannedValue: string): PortablePayloadV3 {
    const chunks = parseQrChunks(scannedValue);
    if (chunks.length === 0) {
      throw new PortableTransferError('No QR data found. Paste one or more scanned chunks.');
    }

    let expectedTransferId: string | null = null;
    let expectedTotal = 0;
    const byIndex = new Map<number, string>();

    for (const chunk of chunks) {
      const parts = chunk.split(':');
      if (parts.length !== 5) {
        throw new PortableTransferError('Invalid QR chunk format. Expected 5 colon-separated fields.');
      }

      const [prefix, transferId, totalRaw, indexRaw, data] = parts;
      if (!prefix || !transferId || !totalRaw || !indexRaw || data === undefined) {
        throw new PortableTransferError('Invalid QR chunk format. Missing one or more fields.');
      }
      if (prefix !== QR_PREFIX) {
        throw new PortableTransferError('Invalid QR chunk prefix for this app.');
      }

      const total = Number.parseInt(totalRaw, 10);
      const index = Number.parseInt(indexRaw, 10);

      if (!Number.isInteger(total) || total <= 0) {
        throw new PortableTransferError('Invalid QR chunk total count.');
      }

      if (!Number.isInteger(index) || index <= 0 || index > total) {
        throw new PortableTransferError('Invalid QR chunk index.');
      }

      if (!data) {
        throw new PortableTransferError(`QR chunk ${index}/${total} is empty.`);
      }

      if (expectedTransferId === null) {
        expectedTransferId = transferId;
        expectedTotal = total;
      }

      if (transferId !== expectedTransferId || total !== expectedTotal) {
        throw new PortableTransferError('QR chunks belong to different transfers. Paste chunks from one export only.');
      }

      const existing = byIndex.get(index);
      if (existing && existing !== data) {
        throw new PortableTransferError(`Duplicate QR chunk ${index} has conflicting content.`);
      }

      byIndex.set(index, data);
    }

    const missing: number[] = [];
    for (let index = 1; index <= expectedTotal; index += 1) {
      if (!byIndex.has(index)) {
        missing.push(index);
      }
    }

    if (missing.length > 0) {
      throw new PortableTransferError(`Missing QR chunk(s): ${missing.join(', ')} of ${expectedTotal}`);
    }

    const encodedPayload = Array.from({ length: expectedTotal }, (_, index) => byIndex.get(index + 1) ?? '').join('');

    let decoded: unknown;
    try {
      decoded = JSON.parse(decodeBase64Url(encodedPayload));
    } catch {
      throw new PortableTransferError('QR decode failed. The scanned transfer data is corrupt or incomplete.');
    }

    try {
      return normalizePortablePayload(decoded);
    } catch (error) {
      if (error instanceof PortableTransferError) {
        throw error;
      }
      if (error instanceof DomainValidationError) {
        throw new PortableTransferError(`Import payload validation failed: ${error.message}`);
      }
      throw new PortableTransferError('Import payload validation failed.');
    }
  }

  async importFromQrChunks(scannedValue: string, strategy: ImportStrategy): Promise<PortableImportResult> {
    const payload = this.decodePayloadFromQrChunks(scannedValue);
    return this.importPayload(payload, strategy);
  }
}

export const createTransferService = (storageService: StorageService): TransferService =>
  new TransferService(storageService);
