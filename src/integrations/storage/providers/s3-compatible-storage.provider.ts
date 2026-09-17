import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { requiredEnv } from '../../../common/config/required-env';
import {
  StorageGetInput,
  StorageObjectRef,
  StorageProvider,
  StoragePutInput,
} from '../storage-provider.interface';

@Injectable()
export class S3CompatibleStorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly endpoint: string;

  constructor(config: ConfigService) {
    this.endpoint = requiredEnv(config, 'AWS_ENDPOINT_URL_S3');
    this.client = new S3Client({
      region: requiredEnv(config, 'AWS_REGION'),
      endpoint: this.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: requiredEnv(config, 'AWS_ACCESS_KEY_ID'),
        secretAccessKey: requiredEnv(config, 'AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  async put(input: StoragePutInput): Promise<StorageObjectRef> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    );

    return {
      bucket: input.bucket,
      key: input.key,
      endpointConfigured: Boolean(this.endpoint),
    };
  }

  async get(input: StorageGetInput): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
      }),
    );

    if (!response.Body) {
      return Buffer.alloc(0);
    }

    return this.streamToBuffer(response.Body as Readable);
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
