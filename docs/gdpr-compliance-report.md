# GDPR Compliance Report — resume-match-engine

**Date:** 2026-07-16 · **Scope:** the tool's processing of candidate personal data
**Assumed deployment:** a company (controller) runs the tool to screen job applicants (data
subjects) in or from the EU. The tool itself is software — most GDPR duties fall on the
operating organization; this report covers what the software *enables, enforces, or blocks*.

## Executive summary

The architecture is **compliance-friendly by design** (PII isolated to known fields, explainable
scoring, exportable canonical JSON, existing delete seam) but the tool is **not
production-compliant as shipped**: personal data is stored in plaintext with no retention,
erasure command, or transfer safeguards, and one engine sends the candidate's name to a
third-party API. **Verdict: suitable for demo/assignment use with synthetic data; 4 gaps must be
closed before processing real candidate data.**

| ID | Article(s) | Status | Issue |
|----|-----------|--------|-------|
| GDPR-01 | 5(1)(c) minimization | ⚠ Gap | Full resume text (`rawText`) retained in every stored profile |
| GDPR-02 | 5(1)(e), 17 | ⚠ Gap | No retention limit or erasure command; profiles persist indefinitely |
| GDPR-03 | 32 | ⚠ Gap | Plaintext JSON at rest; no encryption or access control |
| GDPR-04 | 5(1)(c), 44+ | ⚠ Gap | Hybrid engine transfers candidate name to Anthropic API (third country) |
| GDPR-05 | 22 profiling | ⚠ Conditional | Automated scoring/ranking of candidates = profiling; needs human-in-the-loop |
| GDPR-06 | 28, 30, 13/14 | ◻ Organizational | DPA with Anthropic, records of processing, privacy notices — operator duties |
| GDPR-07 | 15, 20 | ✅ Supported | Access & portability well served by canonical JSON |

## 1. Personal data inventory (Art. 30 basis)

| Data | Where it lives | Category |
|------|----------------|----------|
| Full name | `CanonicalCandidateProfile.fullName`; echoed in `MatchResult.candidateName` and CLI/CSV output | Personal data |
| Email, phone, location, links | `contact` | Personal data (direct identifiers) |
| Employment history (companies, titles, dates, responsibilities) | `workHistory` | Personal data |
| Education | `education` | Personal data |
| **Entire resume text** | `rawText` | Personal data — may incidentally contain **special-category data** (Art. 9) if the candidate wrote it (nationality, disability, union membership…) |
| Computed profile (years, normalized skills, seniority, 0–100 score) | `MatchResult` | **Derived/profiling data** |
| External identity | `externalRef { system, id }` | Pseudonymous linkage to HRM records |

Storage: plaintext JSON files under `data/parsed/` (and `data/results/` if exported).
Flows: local disk → (optional, `--engine llm|hybrid` only) Anthropic API (US).

## 2. Findings

### GDPR-01 — Data minimization: `rawText` stored wholesale

Every stored profile embeds the full resume text (kept for the LLM engine and debugging —
`resume-parser.service.ts`). Structured fields alone would serve rule-based matching. Because
free-text resumes can contain Art. 9 special-category data, retaining `rawText` silently raises
the risk class of the whole store.
**Remediation:** add a `--no-raw-text` option (or make dropping it the default and opt *in* for
LLM workflows); document that `rawText` inherits whatever the candidate wrote.

### GDPR-02 — No retention or erasure path (Art. 5(1)(e), 17)

Profiles persist until manually deleted. The erasure *seam* exists (`BaseRepository.delete`,
`JsonFileStore.delete`) but no CLI command exposes it, so a data subject's erasure request
requires manual file surgery.
**Remediation:** add a `delete-candidate <id>` command (one thin command over the existing
repository method) and a documented retention policy (e.g. purge parsed profiles N days after
the requisition closes). Erasure must also cover `data/results/` exports.

### GDPR-03 — Security of processing (Art. 32)

PII rests in plaintext JSON with only filesystem permissions. Acceptable for a single-operator
demo; not for real candidate data on shared machines or servers.
**Remediation (production path, PLAN.md §17):** encrypt at rest (disk- or field-level for
`fullName`/`contact`/`rawText`), restrict access by role, add audit logging of profile reads.
See the companion security audit (SEC-03/04/05) for processing-integrity items.

### GDPR-04 — Third-country transfer includes direct identifier

With `--engine llm|hybrid`, candidate data leaves the operator's machine for Anthropic (US):
skills, computed years, job titles, companies, education — and, in the **hybrid** engine only,
the **candidate's full name** (`hybrid.engine.ts:49`; the `llm` engine correctly omits it).
The name adds nothing to explanation quality — this is an unnecessary identifier transfer that
also contradicts `docs/bonus-notes.md`.
**Remediation:** (code) send `candidateId` instead of the name — one-line change; (operator)
execute Anthropic's DPA, verify SCCs/adequacy for the transfer, and disclose the recipient in
the privacy notice. Note the tool is **safe by default** here: the default engine (`rule-based`)
performs zero external transfer, and losing the key merely falls back to local scoring.

### GDPR-05 — Automated decision-making (Art. 22)

Scoring and ranking candidates is **profiling**. If hiring decisions were made *solely* on this
output, Art. 22 rights (human intervention, contestation) would be triggered.
**What the design already provides:** full per-skill breakdown, component scores, warnings, and
optional natural-language explanation — exactly the transparency needed to keep a human
meaningfully in the loop and to answer a candidate's "why was I ranked there?".
**Remediation:** document (README + operator policy) that scores are decision *support*; a human
reviews before any rejection. No code change required.

### GDPR-06 — Organizational duties (operator checklist)

Not enforceable by the software; required of whoever runs it on real data:
- **Lawful basis** (Art. 6): typically legitimate interest or pre-contractual necessity for
  recruitment; document the assessment.
- **Privacy notice** (Art. 13/14): inform candidates about automated scoring and the optional
  LLM processor.
- **Processor contract** (Art. 28): DPA with Anthropic before enabling `llm`/`hybrid`.
- **Records of processing** (Art. 30): the inventory in §1 is a ready-made starting point.
- **Breach notification** (Art. 33/34): plaintext local files mean a lost laptop is a
  reportable breach unless GDPR-03 is remediated (disk encryption largely resolves this).

### GDPR-07 — Data-subject rights: access & portability (✅ positive)

`convert --kind resume` / the stored canonical JSON give a complete, structured,
machine-readable export per candidate — Art. 15 (access) and Art. 20 (portability) are
essentially one command away. `externalRef` keeps identity linkage explicit rather than smeared
across systems.

## 3. Compliance-positive design properties

- PII is **isolated to two named fields** (`fullName`, `contact`) plus `rawText` — encryption,
  redaction, and minimization have exact targets (this is why GDPR-01's fix is cheap).
- **Explainable scoring** — every point traceable; supports Art. 22 safeguards and candidate
  disputes.
- **No hidden data flows** — network egress exists in exactly one class, only for opt-in
  engines, with documented fallback to fully-local processing.
- **`schemaVersion`** on stored data enables future migrations (e.g. adding field-level
  encryption) without breaking existing stores.
- API keys and personal data never appear in logs or error contexts.

## 4. Remediation roadmap

| Priority | Action | Effort |
|----------|--------|--------|
| 1 (before any real data) | GDPR-04 code fix: drop `fullName` from hybrid prompt | 1 line |
| 1 | GDPR-02: `delete-candidate` command + retention note in README | ~1 h |
| 2 | GDPR-01: `rawText` opt-out/default-off | ~1 h |
| 2 | GDPR-03: document "run on encrypted disk" now; field-level encryption in the production adapter | doc now / design later |
| 3 | GDPR-05/06: operator policy docs (human-in-the-loop, DPA, notices, ROPA) | organizational |

---
*This report is a technical compliance review, not legal advice; the operating organization
should validate conclusions with its DPO/counsel before processing real candidate data.*
