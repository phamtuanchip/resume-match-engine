# Bonus Notes (Part C)

## 1. LLM-assisted matching — trade-offs

Implemented as two optional engines behind the same `MatchingEngine` interface (`--engine llm|hybrid`),
with rule-based as the always-available default.

| Dimension | rule-based | llm | hybrid |
|-----------|-----------|-----|--------|
| Cost | zero | ~1 API call/candidate | LLM used for explanations only |
| Latency | µs | network RTT per candidate | fast numbers + bounded LLM calls |
| Determinism | full | low (temperature, model drift) | numbers deterministic; prose not |
| Fuzzy semantics | canonical-vocabulary only | strong (synonyms, implied seniority) | anchored + enriched |
| Testability | golden tests | mocked responses, schema+fallback asserted | rule core golden-tested |

**Recommendation shipped as default:** rule-based for scoring, hybrid when explanations are worth
one API call per candidate. Pure `llm` scoring is best treated as a *second opinion*, not the
system of record — reproducibility matters when a candidate asks "why was I ranked below X?".

**Fallback:** no key/unreachable → whole run downgrades to rule-based with a warning; a mid-run
LLM failure downgrades that one candidate. A run always completes with a valid ranking. Keys are
read from `ANTHROPIC_API_KEY` (preferred) or `--api-key` and are never logged.

## 2. Candidate PII

- The canonical profile isolates PII in two fields (`fullName`, `contact`) — easy to encrypt at
  rest or redact in exports; `rawText` also contains PII and should get the same treatment.
- Production posture: field-level encryption, role-based access to contact data, audit log on
  profile reads, retention policy with deletion (the file-store `delete` seam already exists),
  and **PII-stripped prompts** for the LLM engine (the current prompt already sends skills/years/
  titles, not contact info; the candidate name is omitted in the llm engine prompt).

## 3. Scaling to 100k resumes/day with sub-second matching

Parsing and matching are already split by the canonical model, which is what makes this scale:

1. **Ingest** — a queue worker adapter (`presentation/worker/`) consumes upload events and runs
   the same `ParseResumesUseCase`; parsing is embarrassingly parallel (100k/day ≈ 1.2/s sustained).
2. **Store** — canonical profiles in Postgres; skills into an inverted index / precomputed
   candidate-skill vectors keyed by the canonical vocabulary.
3. **Match** — because scoring is a weighted dot-product over canonical skills plus scalar
   experience/seniority terms, a match query becomes an **index lookup + rescoring of the top-K**,
   not a full recomputation — sub-second for millions of profiles.
4. **LLM tier** — only re-rank/explain the top 10–20 (the hybrid pattern), keeping cost bounded.
