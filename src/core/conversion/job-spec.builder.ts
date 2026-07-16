import { CanonicalJobSpec, SCHEMA_VERSION, Seniority, WeightedSkill } from '@core/canonical';
import { sourceId } from './input-converter.interface';

/**
 * Builder for CanonicalJobSpec. Both job converters (structured + free-text) assemble the same
 * ten-field shape with identical boilerplate — id derivation, `externalRef: null`, the source
 * envelope, and `schemaVersion`. The builder centralizes that so each converter only supplies
 * the fields it actually parses, with sensible defaults for the rest.
 */
export class JobSpecBuilder {
  private titleValue = 'Untitled role';
  private seniorityValue: Seniority = 'mid';
  private minYearsValue = 0;
  private requiredValue: WeightedSkill[] = [];
  private niceValue: string[] = [];
  private warningsValue: string[] = [];

  private constructor(
    private readonly id: string,
    private readonly format: 'json' | 'free-text',
    private readonly converter: string,
  ) {}

  /** Seeds the id (from the source uri) and the source envelope. */
  static fromSource(uri: string, format: 'json' | 'free-text', converter: string): JobSpecBuilder {
    return new JobSpecBuilder(sourceId(uri), format, converter);
  }

  title(value: string): this {
    this.titleValue = value;
    return this;
  }

  seniority(value: Seniority): this {
    this.seniorityValue = value;
    return this;
  }

  minYears(value: number): this {
    this.minYearsValue = value;
    return this;
  }

  requiredSkills(value: WeightedSkill[]): this {
    this.requiredValue = value;
    return this;
  }

  niceToHave(value: string[]): this {
    this.niceValue = value;
    return this;
  }

  warnings(value: string[]): this {
    this.warningsValue = value;
    return this;
  }

  build(): CanonicalJobSpec {
    return {
      id: this.id,
      externalRef: null,
      title: this.titleValue,
      seniority: this.seniorityValue,
      minYearsExperience: this.minYearsValue,
      requiredSkills: this.requiredValue,
      niceToHaveSkills: this.niceValue,
      source: { format: this.format, converter: this.converter },
      warnings: this.warningsValue,
      schemaVersion: SCHEMA_VERSION,
    };
  }
}
