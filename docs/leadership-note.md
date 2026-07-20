# Leadership Track Addendum (Part D)

How I would run this assignment as a real feature with a team of 2–3 engineers.

## 1. Ticket breakdown — what to sequence, what to parallelize

**Sequence first (day 1, whole team):** the canonical contract. `CanonicalCandidateProfile`,
`CanonicalJobSpec`, `MatchResult` (`docs/canonical-model.md`) are the interface every other
ticket codes against. This is a half-day design session ending in merged types + fixture
builders (`test/unit/fixtures.ts`) — *not* parallelizable, because getting it wrong taxes every
downstream ticket.

**Then three parallel tracks**, split along the module seams that exist in `src/core/`:

| Track | Tickets | Owner |
|-------|---------|-------|
| **A — Ingestion** | A1 plaintext converter + section splitter · A2 field extractors (name/contact/dates/work-history) · A3 experience calculator (merged ranges) · A4 PDF converter · A5 PII extraction + vault | Eng 1 |
| **B — Matching** | B1 job-spec converters (JSON + free-text) · B2 skill normalizer (shared with A — see below) · B3 scoring service + breakdown · B4 ranking · B5 LLM/hybrid engines behind the registry | Eng 2 |
| **C — Delivery** | C1 CLI commands + error-code boundary · C2 renderers (table/json/csv) · C3 e2e suite against the compiled binary · C4 docs & sample data | Eng 3 (or split across 1–2) |

Cross-track rules: **B2 (skill normalizer) is the one shared component** — one owner, both
tracks consume it; it lands before A2/B3. Tracks integrate continuously against fixture data,
so C3's e2e suite runs from week 1 with stubs. LLM engines (B5) are explicitly *last* — the
rule-based engine must be the golden-tested baseline before anyone adds a nondeterministic path.

## 2. Code review checklist / Definition of Done

Review checklist (beyond lint/CI, which are gates, not review):

- **Degradation contract**: messy input produces `warnings[]` + partial output, never a throw
  (`resume-parser.service.ts:14` is the contract). A new extractor without a warning path is a
  rejection.
- **PII boundary**: nothing outside `core/pii` reads `fullName`/`contact` after extraction; no
  identifier in any LLM prompt, log line, or error context (tested pattern:
  `engines.spec.ts` PII-guard cases).
- **Bounds & determinism**: any scoring change keeps components in 0..1, weights summing to 1,
  and updates the golden-number tests — a score change without a golden-test change is a smell.
- **Contract discipline**: canonical types change only with a `schemaVersion` bump and a
  migration note.
- **Docs move with code**: if behavior referenced in `docs/` or README changed, the doc change
  is in the same PR. (Self-inflicted lesson: this repo shipped a security audit describing
  already-fixed behavior.)

Definition of Done per ticket: unit tests for happy + at least two degraded paths · e2e still
green offline (no key in env) · warnings human-readable · README/doc touched if user-visible ·
one sample under `data/` exercising the change · reviewed by the *other* track's engineer
(forces contract-level review, not just style).

## 3. Onboarding an engineer joining mid-project

Day 1 — **run it, don't read it**: setup from README, then `parse-resumes` + `match` on the
sample data; diff their `data/parsed` output against the committed ones. Read exactly two docs:
`docs/canonical-model.md` (the contract) and `docs/scoring.md` (the reasoning).

Day 2 — **trace one resume end-to-end** with a debugger: converter → parser → PII extraction →
scoring → renderer. The architecture is a straight pipeline over one data shape, so one trace
teaches 80% of the codebase.

Day 3 — **first PR from the starter-ticket shelf**: tasks that are real but one-file by design,
e.g. add a skill alias (+ prose-scan test), add a converter for a new extension, or promote one
of the unused fixtures (`test/fixtures/resumes/unicode-name.txt` …) into a covered test. Each
touches one registry seam and the full test loop.

Ongoing: pair-review their first three PRs with the checklist above; they inherit ownership of
one track's backlog by the end of week 1. The measure of onboarding done: they can explain why
a candidate got score X from the breakdown alone — if they can, they understand the system.
