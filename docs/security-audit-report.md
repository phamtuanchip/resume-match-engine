# Security Audit Report — resume-match-engine

**Date:** 2026-07-16 · **Scope:** full source (`src/**`), dependencies, sample data pipeline
**Context:** local-first CLI processing untrusted resume/job files; optional egress to Anthropic API
**Method:** `npm audit`, dependency review, manual code review (input handling, secrets, regex, file I/O, network)

## Executive summary

No critical or high-severity vulnerabilities found. Dependency scan is clean (0 advisories).
The design isolates the risky surfaces well (converters are the only code touching raw bytes;
one client class owns all network I/O; secrets are never logged). **7 findings** (1 medium,
4 low, 2 informational), all with straightforward remediations. The most actionable is
**SEC-01: candidate full name sent to the external LLM API by the hybrid engine**, which also
contradicts the project's own documentation.

| ID | Severity | Finding |
|----|----------|---------|
| SEC-01 | **Medium** | Hybrid engine sends candidate `fullName` to external LLM API |
| SEC-02 | Low | `--api-key` CLI flag leaks via shell history / process listing |
| SEC-03 | Low | Unmaintained `pdf-parse` parses untrusted binary input |
| SEC-04 | Low | No input file-size limits (resource-exhaustion DoS) |
| SEC-05 | Low | Parsed-profile JSON re-loaded without schema re-validation |
| SEC-06 | Info | Output filename collisions from `sourceId` slugging |
| SEC-07 | Info | Error messages include absolute file paths |

## Findings

### SEC-01 — PII egress: hybrid engine includes full name in the LLM prompt (Medium)

**Evidence:** `src/core/matching/engines/hybrid.engine.ts:49` —
`CANDIDATE: ${JSON.stringify({ name: candidate.fullName, ... })}`.
The `llm` engine correctly omits name/contact (`llm.engine.ts` `buildPrompt` sends skills,
years, titles, education only), and `docs/bonus-notes.md` claims names are omitted from prompts —
**the hybrid engine violates both**. Candidate identity leaves the machine whenever
`--engine hybrid` runs.
**Risk:** unnecessary personal-data disclosure to a third party; documentation/behavior mismatch.
**Remediation:** replace `name: candidate.fullName` with the opaque `candidateId`; the
explanation quality does not depend on the real name. (Cross-referenced as GDPR-04.)

### SEC-02 — API key on the command line (Low)

**Evidence:** `--api-key <key>` option in `match.command.ts:62` and `score.command.ts:60`.
Values passed as CLI arguments persist in shell history and are visible in the OS process list
while running.
**Mitigations already present:** `ANTHROPIC_API_KEY` env var is the documented, preferred path;
the key is only ever written to the `x-api-key` header (`llm-client.ts:24`) — it is never logged,
never included in `EngineError` messages or context.
**Remediation:** keep the flag for scripting convenience but print a one-line warning when it is
used; document `setx`/`export` as the recommended flow (already in README).

### SEC-03 — `pdf-parse` is unmaintained and processes untrusted input (Low)

**Evidence:** `pdf-parse@1.1.4` (last meaningful upstream release ~2019) invoked in
`pdf-resume.converter.ts` on arbitrary user-supplied PDFs.
**Mitigations already present:** the call is wrapped — any parser throw degrades to a warning
and an empty profile, never a crash; the module is lazy-loaded; `npm audit` reports no advisory.
**Risk:** future disclosed vulnerabilities will not receive patches; PDF parsers are a classic
memory/CPU abuse target (in JS this is bounded to the Node process, not native memory).
**Remediation:** track `pdf-parse` for advisories or migrate to a maintained alternative
(`pdf.js`/`pdfjs-dist`); for server deployment (PLAN.md §17), parse PDFs in a sandboxed worker
with CPU/memory/time limits.

### SEC-04 — No file-size limits on inputs (Low)

**Evidence:** `file-loader.ts` `readBytes`/`readText` read entire files into memory with no cap;
a multi-GB "resume" or a PDF decompression bomb will exhaust memory or hang the run.
**Risk:** denial of service. Low for an operator-run local CLI (you choose your inputs); real
concern once a server/worker adapter accepts uploads.
**Remediation:** add a configurable max size (e.g. 10 MB default) in `FileLoader` and reject
larger files with `FileLoadError`; add a parse timeout around the PDF converter.

### SEC-05 — Parsed profiles trusted on re-load (Low)

**Evidence:** `json-file-store.ts` `load`/`loadAll` → `JSON.parse` of files in `data/parsed`
and the result is used directly as `CanonicalCandidateProfile` (no re-validation). The `match`
command therefore trusts whatever is in `--resumes <dir>`.
**Mitigations already present:** `JSON.parse` does not instantiate prototypes (a `__proto__` key
stays an own property — no prototype pollution); job specs, by contrast, ARE re-validated via
`class-validator` with `whitelist: true` on every load. Scoring only reads typed fields.
**Risk:** malformed/tampered profile files produce wrong scores or runtime errors, not code
execution. Matters when the parsed dir is shared between trust domains.
**Remediation:** validate `schemaVersion` and minimally assert shape on load; treat the parsed
dir as an internal cache, not an exchange format.

### SEC-06 — Output filename collisions (Informational)

`sourceId()` (`input-converter.interface.ts`) slugs filenames to `[a-z0-9-]`; `Resume(1).pdf`
and `resume-1.pdf` both become `resume-1` and silently overwrite each other in `data/parsed`,
and an all-symbol filename slugs to an empty id (`.json`). Data-integrity nit, not a
vulnerability (the slug cannot escape the output directory — path separators are stripped).
**Remediation:** append a short content hash to the id.

### SEC-07 — Absolute paths in error output (Informational)

`FileLoadError`/`InvalidJobSpecError` messages embed full local paths. Correct UX for a local
CLI; becomes information disclosure if the same errors are returned verbatim by a future
REST adapter. The `{ code, message, context }` error shape already supports redaction — do it
in the REST adapter, not in core.

## Reviewed and found sound

- **Dependencies:** `npm audit` — 0 advisories across 660+ resolved packages; NestJS 11.1.28,
  class-validator 0.14.4, class-transformer 0.5.1, nest-commander 3.20.1 current.
- **No command execution:** no `child_process`/`eval`/dynamic `require` of user input anywhere
  in `src/` (tests use `execFileSync` with an args array — no shell interpolation).
- **Network:** single egress point (`llm-client.ts`), HTTPS only, pinned `anthropic-version`,
  `AbortController` timeout, response treated as untrusted (schema-coerced, clamped 0–100,
  failures typed as `EngineError` and contained by the fallback path).
- **ReDoS:** all regexes reviewed — character-class quantifiers only, no nested quantifiers or
  overlapping alternations; skill aliases are regex-escaped before interpolation
  (`skill-normalizer.service.ts`).
- **Injection via output:** CSV renderer escapes quotes/commas/newlines; JSON output via
  `JSON.stringify` only.
- **Secrets hygiene:** no key material in logs, errors, or persisted JSON; `.env` is gitignored.

## Remediation priority

1. SEC-01 (one-line fix, do before any real candidate data is used with `--engine hybrid`)
2. SEC-04 + SEC-03 (required before exposing parsing as a service; optional for local CLI)
3. SEC-02, SEC-05, SEC-06, SEC-07 (hygiene; fold into the REST/worker adapter work in PLAN.md §17)
