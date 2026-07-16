import { Module } from '@nestjs/common';
import { PiiExtractorService } from './pii-extractor.service';
import { PiiIndexRepository } from './pii-index.repository';

@Module({
  providers: [PiiExtractorService, PiiIndexRepository],
  exports: [PiiExtractorService, PiiIndexRepository],
})
export class PiiModule {}
