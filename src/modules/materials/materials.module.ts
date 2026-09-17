import { Module } from '@nestjs/common';
import { StorageModule } from '../../integrations/storage/storage.module';

@Module({
  imports: [StorageModule],
})
export class MaterialsModule {}
