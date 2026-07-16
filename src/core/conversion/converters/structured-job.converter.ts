import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InvalidJobSpecError } from '@common/errors';
import { CanonicalJobSpec, JobSpecDto } from '@core/canonical';
import { SkillNormalizerService } from '@core/parsing/skill-normalizer.service';
import { ConversionResult, InputConverter, SourceDescriptor } from '../input-converter.interface';
import { JobSpecBuilder } from '../job-spec.builder';

/** Structured (JSON) job spec — the primary job-spec path, validated via class-validator. */
@Injectable()
export class StructuredJobConverter implements InputConverter<CanonicalJobSpec> {
  readonly kind = 'job' as const;
  readonly name = 'structured-job';

  constructor(private readonly skillNormalizer: SkillNormalizerService) {}

  supports(source: SourceDescriptor): boolean {
    // `typeof null === 'object'`, so a null payload must be excluded explicitly — otherwise this
    // converter would claim a source it cannot handle and then crash in convert().
    return (
      source.ext === '.json' || (source.payload !== null && typeof source.payload === 'object')
    );
  }

  async convert(source: SourceDescriptor): Promise<ConversionResult<CanonicalJobSpec>> {
    let plain: unknown = source.payload;
    if (plain === undefined || plain === null) {
      const text = source.text ?? source.bytes?.toString('utf8') ?? '';
      try {
        plain = JSON.parse(text);
      } catch {
        throw new InvalidJobSpecError(`Job spec is not valid JSON: ${source.uri}`);
      }
    }

    const dto = plainToInstance(JobSpecDto, plain);
    const errors = validateSync(dto, { whitelist: true });
    if (errors.length > 0) {
      const details = errors
        .map((e) => Object.values(e.constraints ?? {}).join('; ') || e.property)
        .join(' | ');
      throw new InvalidJobSpecError(`Invalid job spec (${source.uri}): ${details}`);
    }

    const value = JobSpecBuilder.fromSource(source.uri, 'json', this.name)
      .title(dto.title)
      .seniority(dto.seniority)
      .minYears(dto.minYearsExperience)
      .requiredSkills(
        dto.requiredSkills.map((s) => ({
          skill: this.skillNormalizer.normalize(s.skill),
          weight: s.weight,
        })),
      )
      .niceToHave((dto.niceToHaveSkills ?? []).map((s) => this.skillNormalizer.normalize(s)))
      .build();
    return { value, warnings: [] };
  }
}
