# Vitest V8 coverage baseline

Issue #68 established the first focused-suite coverage baseline on Node 24 with
Vitest and `@vitest/coverage-v8` 4.1.10.

Command:

```bash
npm run test:coverage
```

Measured baseline after the assertion-parity review fixes:

| Metric | Measured | Configured floor |
|---|---:|---:|
| Statements | 83.37% (1826/2190) | 82% |
| Branches | 75.01% (1426/1901) | 74% |
| Functions | 85.79% (290/338) | 84% |
| Lines | 86.93% (1657/1906) | 85% |

The floors provide less than two percentage points of stability headroom while
remaining anchored to the measured baseline. Branches are lower because the
included production surface contains platform/error recovery paths (callback
port fallback, filesystem rollback, response-body variants, and defensive tool
adapters) that are not safe to force merely for percentage. Security-critical
state, endpoint pinning, cancellation, redaction, entitlement, routing/header,
cache invalidation, and fail-closed tool branches are covered directly.

Coverage includes `extensions/**/*.ts` and excludes only the constants module.
Tests, fixtures, generated coverage output, compatibility scripts, and setup CLI
code are outside the extension-runtime threshold. Terminal text, JSON summary,
and LCOV reports are produced; `coverage/` is ignored by Git and npm packing.
