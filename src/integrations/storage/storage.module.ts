import { Module, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { STORAGE_PROVIDER } from "./storage-provider.interface";
import { S3CompatibleStorageProvider } from "./providers/s3-compatible-storage.provider";

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const enabled = config.get<string>("STORAGE_ENABLED") ?? "false";
        if (!["true", "false"].includes(enabled))
          throw new Error("Invalid STORAGE_ENABLED");
        if (enabled === "true") return new S3CompatibleStorageProvider(config);
        return {
          put: () =>
            Promise.reject(new ServiceUnavailableException("Storage disabled")),
          get: () =>
            Promise.reject(new ServiceUnavailableException("Storage disabled")),
        };
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
