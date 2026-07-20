# Scoring Formula — Design & Justification

```
score = 100 × ( 0.55·S_skills + 0.25·S_exp + 0.12·S_sen + 0.08·S_nice )
```

Every component is 0..1. Implemented in `src/core/matching/scoring.service.ts`; this is the
`rule-based` engine and the deterministic anchor inside `hybrid`.

## Components

| Component | Definition | Why |
|-----------|------------|-----|
| **S_skills** (0.55) | Σ(weights of matched required skills) ÷ Σ(all required weights) | Weighted coverage is the strongest signal, and the 1–5 weights come straight from the job author — the formula amplifies *their* priorities, not ours. |
| **S_exp** (0.25) | `min(candidateYears / minYears, 1)`; 1 when `minYears = 0` | Meets-the-bar gets full credit; a shortfall gets *graded* partial credit (2.5y against a 5y bar scores 0.5, not 0). A hard cutoff would zero out otherwise strong candidates over an arbitrary line. |
| **S_sen** (0.12) | Ordinal distance between inferred and required seniority → {1, 0.6, 0.3, 0} | Soft secondary signal. Seniority correlates with years, so over-weighting it would double-count experience. Inference: latest title keywords first (`lead`, `senior`, `junior`), else years (<2 junior, <5 mid, <9 senior, 9+ lead). |
| **S_nice** (0.08) | Fraction of nice-to-have skills matched | A nudge that breaks ties between otherwise equal candidates; never dominates required fit. |

## Design principles

1. **Transparent** — every point is traceable: the breakdown lists each required skill's
   matched/unmatched status and its exact contribution.
2. **Weight-driven** — the job author controls emphasis via the 1–5 weights; the component
   weights (0.55/0.25/0.12/0.08) are defaults, documented and centralized in one constant.
3. **Graceful** — partial credit everywhere; no component can NaN or crash on missing data.
   A candidate with an unparseable work history scores 0 on experience but still gets skill credit.
4. **Deterministic** — a pure function of canonical inputs; golden-number tests pin the math.

## Edge cases (tested)

- **Empty required-skills list** → S_skills = 1 (nothing was required), no division by zero.
- **Job defines no nice-to-haves** → the 0.08 weight is redistributed proportionally across the
  other components, so candidates are not capped at 92 for a field the job author left empty.
- **Overqualified candidates** (lead applying to senior) → distance 1 → 0.6 alignment. This is a
  deliberate soft penalty (flight-risk/cost signal), and is visible in the breakdown, not hidden.

## Worked example

Job: Node.js(5), TypeScript(5), NestJS(4), PostgreSQL(3), Docker(2) · min 5y · senior ·
nice: K8s, Kafka, AWS. Candidate: all 5 skills, 12y, "Lead …" title, all 3 nice-to-haves.

- S_skills = 19/19 = 1 → 55.0
- S_exp = min(12/5, 1) = 1 → 25.0
- S_sen = lead vs senior = 0.6 → 7.2
- S_nice = 3/3 = 1 → 8.0
- **score = 95** — matches `match --job data/jobs/senior-node.json` for `tuan-pham.txt`.
