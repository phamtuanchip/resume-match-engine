import { Module } from '@nestjs/common';
import { ExperienceCalculatorService } from './experience-calculator.service';
import { ResumeParserService } from './resume-parser.service';
import { SkillNormalizerService } from './skill-normalizer.service';

@Module({
  providers: [SkillNormalizerService, ExperienceCalculatorService, ResumeParserService],
  exports: [SkillNormalizerService, ExperienceCalculatorService, ResumeParserService],
})
export class ParsingModule {}
