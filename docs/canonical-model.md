# Canonical Data Model (schemaVersion 1.0)

The single internal contract: all converters produce it, all engines/renderers consume it.
Source of truth: `src/core/canonical/*.ts`. Full field tables in `../../PLAN.md` §4.

## CanonicalCandidateProfile

- `id` — slug of the source filename
- `externalRef` — `{ system, id } | null`; set by inbound HRM converters, echoed on every
  `MatchResult` so scores can be written back to the owning record
- `source` — provenance: fileName, fileType, convertedAt, converter
- `fullName`, `contact { email, phone, links? }`
- `totalYearsExperience` — **computed** from merged work-history ranges, never a stated number
- `skills[]` — `{ canonical, rawMatches[], source: skills-section | work-history }`
- `education[]`, `workHistory[]` (company, title, ISO start/end, responsibilities, raw)
- `rawText` — retained for the LLM engine and debugging
- `warnings[]` — the graceful-degradation trail
- `schemaVersion`

## CanonicalJobSpec

- `id`, `externalRef`, `title`
- `seniority` — `junior | mid | senior | lead`
- `minYearsExperience`, `requiredSkills[] { skill, weight 1..5 }`, `niceToHaveSkills[]`
- `source { format: json | free-text, converter }`, `warnings[]`, `schemaVersion`

Skills on **both** types pass through the same `SkillNormalizerService`, so candidate and job
always speak one vocabulary — that is what makes matching correct.

## MatchResult

- `candidateId`, `candidateName`, `candidateExternalRef`, `engine`, `score` (0–100), `warnings[]`
- `breakdown` — per-skill match + contribution, skill coverage, experience fit/gap, seniority
  alignment, nice-to-have bonus, component scores, optional LLM `explanation`
