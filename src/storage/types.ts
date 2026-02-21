export type StorageValue = string | number | boolean | object | null;

export interface StorageService {
  init(): Promise<void>;
  read<T extends StorageValue>(key: string): Promise<T | undefined>;
  write<T extends StorageValue>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getSchemaVersion(): Promise<number | undefined>;
}
