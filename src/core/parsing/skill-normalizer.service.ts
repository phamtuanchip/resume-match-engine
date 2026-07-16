import { Injectable } from '@nestjs/common';

/**
 * Canonical skill vocabulary. Candidate skills AND job skills both pass through here,
 * so "JS" == "JavaScript" end-to-end. Curated alias map, extensible — not a full taxonomy.
 */
const SKILL_ALIASES: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ecmascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  react: 'React',
  reactjs: 'React',
  'react.js': 'React',
  nest: 'NestJS',
  nestjs: 'NestJS',
  express: 'Express',
  expressjs: 'Express',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  'c#': 'C#',
  csharp: 'C#',
  '.net': '.NET',
  dotnet: '.NET',
  go: 'Go',
  golang: 'Go',
  sql: 'SQL',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  redis: 'Redis',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  docker: 'Docker',
  aws: 'AWS',
  'amazon web services': 'AWS',
  gcp: 'Google Cloud',
  'google cloud': 'Google Cloud',
  azure: 'Azure',
  graphql: 'GraphQL',
  rest: 'REST',
  'rest api': 'REST',
  'rest apis': 'REST',
  html: 'HTML',
  css: 'CSS',
  sass: 'Sass',
  scss: 'Sass',
  vue: 'Vue.js',
  vuejs: 'Vue.js',
  'vue.js': 'Vue.js',
  angular: 'Angular',
  spring: 'Spring',
  'spring boot': 'Spring',
  git: 'Git',
  'ci/cd': 'CI/CD',
  jenkins: 'Jenkins',
  kafka: 'Kafka',
  rabbitmq: 'RabbitMQ',
  elasticsearch: 'Elasticsearch',
  jest: 'Jest',
  cypress: 'Cypress',
  terraform: 'Terraform',
};

/** Aliases too ambiguous to scan for inside prose (they normalize fine when listed explicitly). */
const SCAN_EXCLUDE = new Set(['go', 'rest']);

/**
 * Word-boundary matchers for every scannable alias, compiled once at module load. findInText
 * runs on every parsed resume, so recompiling ~60 RegExps per call was pure waste.
 */
const SCAN_PATTERNS: { alias: string; canonical: string; re: RegExp }[] = Object.entries(
  SKILL_ALIASES,
)
  .filter(([alias]) => !SCAN_EXCLUDE.has(alias))
  .map(([alias, canonical]) => ({
    alias,
    canonical,
    re: new RegExp(
      `(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`,
      'i',
    ),
  }));

@Injectable()
export class SkillNormalizerService {
  /** Normalizes one explicitly-listed skill. Unknown skills pass through trimmed. */
  normalize(raw: string): string {
    const key = raw
      .trim()
      .toLowerCase()
      .replace(/[.,;]+$/, '');
    return SKILL_ALIASES[key] ?? raw.trim();
  }

  /** Finds known skills mentioned in free text (work-history bullets, free-text JDs). */
  findInText(text: string): { canonical: string; raw: string }[] {
    const found = new Map<string, string>();
    for (const { alias, canonical, re } of SCAN_PATTERNS) {
      if (!found.has(canonical) && re.test(text)) {
        found.set(canonical, alias);
      }
    }
    return [...found.entries()].map(([canonical, raw]) => ({ canonical, raw }));
  }
}
