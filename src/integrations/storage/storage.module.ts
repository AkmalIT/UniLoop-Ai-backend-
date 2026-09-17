import { Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { S3CompatibleStorageProvider } from './providers/s3-compatible-storage.provider';

@Module({
  providers: [
    S3CompatibleStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: S3CompatibleStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
