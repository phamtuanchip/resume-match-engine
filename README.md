# Resume Match Engine

Parse resumes, extract structured candidate data, and rank candidates against a job description — fully offline (rule-based) or AI-assisted (Anthropic/OpenAI).

---

## Code Structure

```
src/
├── main.ts                         # NestJS bootstrap
├── app.module.ts
├── common/
│   ├── config/app-config.ts        # Env / CLI option resolution
│   ├── database/base.repository.ts # Generic JSON-on-disk repository
│   ├── errors/                     # Typed error classes
│   └── io/                         # FileLoader, JsonFileStore
├── core/
│   ├── canonical/                  # Shared data contracts
│   │   ├── candidate-profile.ts    # CanonicalCandidateProfile
│   │   ├── job-spec.ts             # CanonicalJobSpec
│   │   └── match-result.ts         # MatchResult + breakdown
│   ├── application/                # Use-case layer (entry points)
│   │   ├── parse-resumes.usecase.ts
│   │   ├── match-candidates.usecase.ts
│   │   └── convert-input.usecase.ts
│   ├── conversion/                 # Input converters + output renderers
│   │   ├── converters/             # pdf, plaintext, markdown, json, freetext
│   │   ├── renderers/              # table, json, csv
│   │   ├── converter.registry.ts
│   │   └── renderer.registry.ts
│   ├── parsing/                    # Resume field extractors
│   │   ├── resume-parser.service.ts
│   │   ├── skill-normalizer.service.ts
│   │   ├── experience-calculator.service.ts
│   │   └── extractors/             # name, contact, dates, education, work-history, sections
│   ├── pii/                        # Pseudonymisation vault
│   │   ├── pii-extractor.service.ts
│   │   └── pii-index.repository.ts
│   └── matching/                   # Scoring & ranking
│       ├── scoring.service.ts
│       ├── ranking.service.ts
│       ├── engines/                # rule-based, llm, hybrid
│       ├── providers/              # anthropic, openai
│       ├── engine.registry.ts
│       └── provider.registry.ts
└── presentation/
    └── cli/
        ├── commands/               # parse-resumes, match, score, convert
        └── controllers/            # parse, match
```

**Key design rule:** `core/canonical/` is the single internal contract. Every converter produces it; every engine and renderer consumes it. No layer below `application/` knows about CLI, file paths, or output format.

---

## Data Flow

```
CLI args
   │
   ▼
[commands/]  parse args, load files
   │
   ▼
[application/]  use-case orchestration
   │
   ├──▶ [conversion/converters/]  raw file → CanonicalCandidateProfile / CanonicalJobSpec
   │         PDF → pdf-extractor → plaintext-resume.converter
   │         .txt / .md → plaintext-resume.converter
   │         .json job → structured-job.converter
   │         free-text job → freetext-job.converter
   │
   ├──▶ [pii/]  extract name+contact → pii-index.json vault, redact from profile
   │
   ├──▶ [parsing/]  extractors fill skills[], workHistory[], education[]
   │         section-splitter → name/contact/dates/education/work-history extractors
   │         skill-normalizer (alias map)  →  experience-calculator (merged date ranges)
   │
   ├──▶ [matching/engines/]  CanonicalCandidateProfile × CanonicalJobSpec → MatchResult
   │         rule-based: weighted formula (deterministic)
   │         llm:        Anthropic/OpenAI API call → coerced MatchResult
   │         hybrid:     rule-based numbers + LLM explanation
   │         fallback:   any engine failure → rule-based, per candidate
   │
   └──▶ [conversion/renderers/]  MatchResult[] → table / JSON / CSV
```

**PII flow:**
```
raw CV file
   │  pii-extractor strips name, email, phone
   ▼
pii-vault/pii-index.json   ← identity (name, contact, original path)
data/parsed/<idx>-*.json   ← PII-free canonical profile (fullName: null)
```

---

## Quick Start

```bash
# 1. Install & build
npm install
npm run build

# 2. Parse resumes (PDF, txt, md) → canonical JSON profiles
npm run cli -- parse-resumes ./data/resumes \
  --out ./data/parsed \
  --pii-dir ./data/pii-vault

# 3. Rank all parsed candidates against a job spec
npm run cli -- match --job ./data/jobs/senior-node.json

# 4. AI-assisted match (requires API key)
export ANTHROPIC_API_KEY="sk-ant-..."        # bash
# $env:ANTHROPIC_API_KEY="sk-ant-..."        # PowerShell
npm run cli -- match --job ./data/jobs/senior-node.json --engine hybrid
```

---

## CLI Commands

### `parse-resumes <input-dir>`

Converts and parses every resume in `<input-dir>`. Each file is assigned a 4-digit index, PII is extracted to the vault, and a PII-free canonical profile is written to `--out`.

| Option | Default | Description |
|--------|---------|-------------|
| `--out <dir>` | `./data/parsed` | Output directory for canonical JSON profiles |
| `--pii-dir <dir>` | `./data/pii-vault` | PII vault directory (`pii-index.json`) |
| `--format table\|json\|csv` | `table` | Parse-summary output format |
| `--verbose` | false | Show per-file warnings |

```bash
npm run cli -- parse-resumes ./data/resumes --out ./data/parsed --pii-dir ./data/pii-vault
```

---

### `match`

Ranks all parsed candidates against one job description. Loads profiles from `--resumes`, scores against `--job`, prints ranked output.

| Option | Default | Description |
|--------|---------|-------------|
| `--job <file>` | *(required)* | Job spec: `.json` (structured) or `.txt` (free-text) |
| `--resumes <dir>` | `./data/parsed` | Directory of canonical candidate profiles |
| `--engine rule-based\|llm\|hybrid` | `rule-based` | Matching engine |
| `--model <id>` | provider default | LLM model override |
| `--top <n>` | all | Limit output to top N candidates |
| `--format table\|json\|csv` | `table` | Output format |
| `--verbose` | false | Show warnings per candidate |

```bash
# Structured job, table output (default)
npm run cli -- match --job ./data/jobs/senior-node.json

# Free-text job, top 3, JSON output
npm run cli -- match --job ./data/jobs/free-text-jd.txt --top 3 --format json

# AI-assisted, CSV export
npm run cli -- match --job ./data/jobs/senior-node.json --engine hybrid --format csv
```

---

### `score`

Scores a single candidate against a job. Useful for debugging a specific profile.

```bash
npm run cli -- score \
  --job ./data/jobs/senior-node.json \
  --resume ./data/parsed/0003-tuan-pham.json \
  --engine rule-based
```

---

### `convert <input>`

Shows the canonical form of any input file without persisting anything. Useful for debugging converters.

| Option | Default | Description |
|--------|---------|-------------|
| `--kind resume\|job` | auto-detected | Force input type |
| `--format table\|json\|csv` | `table` | Output format |

```bash
npm run cli -- convert ./data/jobs/free-text-jd.txt --kind job --format json
npm run cli -- convert ./data/resumes/0003-tuan-pham.txt --kind resume
```

---

## Testing

```bash
# All tests (unit + e2e; live LLM auto-skipped when no API key)
npm test

# Unit tests only — scoring, parsing, conversion, renderers (~140 cases)
npx jest test/unit

# E2E tests — full CLI commands against the compiled binary (~15 cases)
npx jest test/e2e

# Live integration — hits the real Anthropic API (requires key)
export ANTHROPIC_API_KEY="sk-ant-..."
npx jest test/integration/llm-live.spec.ts --testTimeout=60000

# Coverage report
npm run test:cov
```

| Suite | Location | What it covers |
|-------|----------|----------------|
| Unit | `test/unit/` | Scoring formula, experience calculator, skill normalizer, all converters, parser edge cases, renderers, PII extractor |
| E2E | `test/e2e/` | Full `parse-resumes` + `match` CLI commands against the compiled binary with fixture files |
| Live LLM | `test/integration/` | Real Anthropic API: provider smoke test, engine output shape, PII-free prompt check |

The live suite skips itself when `ANTHROPIC_API_KEY` is absent — `npm test` always passes in CI without a key.
