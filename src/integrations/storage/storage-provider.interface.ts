export interface StorageProvider {
  put(input: StoragePutInput): Promise<StorageObjectRef>;
  get(input: StorageGetInput): Promise<Buffer>;
}

export interface StoragePutInput {
  bucket: string;
  key: string;
  buffer: Buffer;
  contentType?: string;
}

export interface StorageGetInput {
  bucket: string;
  key: string;
}

export interface StorageObjectRef {
  bucket: string;
  key: string;
  endpointConfigured: boolean;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
