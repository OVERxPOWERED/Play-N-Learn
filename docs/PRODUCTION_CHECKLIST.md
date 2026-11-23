# Core
NEXT_PUBLIC_APP_URL=https://app.example.com
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Auth (NextAuth.js)
NEXTAUTH_SECRET=<rotated-256-bit-key>
NEXTAUTH_URL=https://app.example.com
AUTH_GITHUB_ID=<client-id>
AUTH_GITHUB_SECRET=<client-secret>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
DATABASE_POOL_SIZE=20

# Redis / Upstash
REDIS_URL=redis://:token@host:6379
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=<token>

# Observability
SENTRY_DSN=https://<key>@sentry.io/<project>
SENTRY_ORG=<org>
SENTRY_PROJECT=<project>
SENTRY_AUTH_TOKEN=<token>

# Feature Flags
NEXT_PUBLIC_FLAG_GAME_ENGINE_V2=true
NEXT_PUBLIC_FLAG_ANALYTICS=true
```

### 1.2 Secret Rotation Protocol

| Secret | Rotation Frequency | Last Rotated | Next Rotation | Rotation Procedure |
|--------|-------------------|--------------|---------------|-------------------|
| `NEXTAUTH_SECRET` | 90 days | YYYY-MM-DD | YYYY-MM-DD | `pnpm run secrets:rotate nextauth` |
| `DATABASE_URL` (password) | 90 days | YYYY-MM-DD | YYYY-MM-DD | AWS Secrets Manager rotation |
| `AUTH_GITHUB_SECRET` | 180 days | YYYY-MM-DD | YYYY-MM-DD | GitHub Developer Settings |
| `UPSTASH_REDIS_REST_TOKEN` | 180 days | YYYY-MM-DD | YYYY-MM-DD | Upstash Console |
| `SENTRY_AUTH_TOKEN` | 365 days | YYYY-MM-DD | YYYY-MM-DD | Sentry API Settings |

**Rotation Checklist:**
- [ ] Generate new secret in secure password manager
- [ ] Update in Vercel/AWS Parameter Store
- [ ] Deploy with new secret (zero-downtime)
- [ ] Verify application health
- [ ] Revoke old secret
- [ ] Document rotation in audit log

### 1.3 Dependency Audit

```bash
# Run full audit pipeline
pnpm audit --prod --audit-level=high
pnpm audit:ci  # CI-friendly output

# Check for outdated packages
pnpm outdated --prod

# License compliance
pnpm licenses list --prod --json > licenses-report.json
```

| Audit Category | Threshold | Current Status | Action Required |
|----------------|-----------|----------------|-----------------|
| Critical Vulnerabilities | 0 | ☐ | Block deployment |
| High Vulnerabilities | 0 | ☐ | Block deployment |
| Moderate Vulnerabilities | ≤ 5 | ☐ | Review & schedule fix |
| Low Vulnerabilities | ≤ 20 | ☐ | Monitor |
| License Violations | 0 (GPL/AGPL) | ☐ | Legal review |

**Allowed Exceptions** (documented in `audit-exceptions.json`):
- `package-name@version`: CVE-XXXX-XXXX - Mitigation: [description], Expires: YYYY-MM-DD

### 1.4 Bundle Size Analysis

```bash
# Production build with analysis
ANALYZE=true pnpm build
pnpm next-analyze

# Bundle size thresholds (gzipped)
```

| Metric | Threshold | Current | Status |
|--------|-----------|---------|--------|
| Total JS (First Load) | < 170 KB | ___ KB | ☐ |
| Main Chunk (app/layout) | < 50 KB | ___ KB | ☐ |
| Game Engine Chunk | < 80 KB | ___ KB | ☐ |
| Vendor Chunk (React, GSAP, OGL) | < 100 KB | ___ KB | ☐ |
| CSS Total | < 30 KB | ___ KB | ☐ |
| Font Files (woff2) | < 50 KB | ___ KB | ☐ |

**Bundle Analysis Commands:**
```bash
# Visual analysis
npx @next/bundle-analyzer

# Webpack bundle analyzer
ANALYZE=server pnpm build
ANALYZE=browser pnpm build

# Check for duplicate dependencies
pnpm dedupe
pnpm ls --depth=0 --prod | grep -E "deduped|extraneous"
```

---

## 2. Performance Benchmarks

### 2.1 Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor | Target | Measurement Tool |
|--------|------|-------------------|------|--------|------------------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | 2.5s - 4.0s | > 4.0s | **< 2.0s** | Chrome UX Report, Lighthouse, `web-vitals` lib |
| **INP** (Interaction to Next Paint) | ≤ 200ms | 200ms - 500ms | > 500ms | **< 150ms** | Chrome UX Report, `web-vitals` lib |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1 - 0.25 | > 0.25 | **< 0.05** | Chrome UX Report, Lighthouse |
| **FCP** (First Contentful Paint) | ≤ 1.8s | 1.8s - 3.0s | > 3.0s | **< 1.5s** | Lighthouse, `web-vitals` lib |
| **TTFB** (Time to First Byte) | ≤ 800ms | 800ms - 1.8s | > 1.8s | **< 600ms** | Server timing, `web-vitals` lib |

**Measurement Implementation** (see `docs/API_GUIDE.md`):
```typescript
// lib/performance/performanceProfilerService.ts
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

export function initWebVitalsCollection() {
  onLCP(sendToAnalytics);
  onINP(sendToAnalytics);
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
```

### 2.2 Game Engine Performance (60 FPS Verification)

| Test Scenario | Duration | Target Frame Time | Max Frame Drops | Status |
|---------------|----------|-------------------|-----------------|--------|
| Idle Scene (no entities) | 60s | < 16.67ms (60fps) | 0 | ☐ |
| 100 Entities (static) | 60s | < 16.67ms | ≤ 2 | ☐ |
| 100 Entities (animated) | 60s | < 16.67ms | ≤ 5 | ☐ |
| 500 Entities (animated) | 60s | < 16.67ms | ≤ 10 | ☐ |
| Particle System (1000 particles) | 30s | < 16.67ms | ≤ 5 | ☐ |
| Post-processing (Bloom + FXAA) | 30s | < 16.67ms | ≤ 3 | ☐ |
| Scene Transition (GSAP + OGL) | 5s | < 16.67ms | 0 | ☐ |
| Memory Pressure (GC cycles) | 120s | < 16.67ms | ≤ 5 | ☐ |

**Automated Test Script:**
```bash
# Run performance test suite
pnpm test:performance:game-engine

# Profile with Chrome DevTools Protocol
pnpm test:performance:trace --url=http://localhost:3000/game --duration=60000
```

**Frame Time Budget Breakdown (16.67ms target):**
| Phase | Budget | Current Avg | Status |
|-------|--------|-------------|--------|
| Input Processing | 1.0ms | ___ms | ☐ |
| Physics/Simulation | 3.0ms | ___ms | ☐ |
| Animation (GSAP) | 2.0ms | ___ms | ☐ |
| OGL Render | 6.0ms | ___ms | ☐ |
| Post-processing | 2.0ms | ___ms | ☐ |
| React Reconciliation | 1.5ms | ___ms | ☐ |
| **Total** | **15.5ms** | **___ms** | ☐ |

### 2.3 Memory Leak Testing (OGL / GSAP)

| Test | Duration | Heap Growth Threshold | Verification Method | Status |
|------|----------|----------------------|---------------------|--------|
| Scene Mount/Unmount (x50) | 5 min | < 10 MB | Chrome DevTools Heap Snapshots | ☐ |
| GSAP Timeline Create/Kill (x100) | 3 min | < 5 MB | `performance.memory` API | ☐ |
| OGL Texture Load/Unload (x200) | 5 min | < 15 MB | WebGL Inspector | ☐ |
| Particle System Emit/Destroy (x500) | 5 min | < 10 MB | Custom memory tracker | ☐ |
| Long-running Session (idle) | 30 min | < 5 MB/hr | `performanceProfilerService` | ☐ |
| Navigation Stress Test (x100) | 10 min | < 20 MB | Lighthouse CI | ☐ |

**Memory Leak Detection Commands:**
```bash
# Run memory leak detection suite
pnpm test:memory:leaks

# Generate heap snapshots for comparison
node scripts/memory-heap-snapshot.js --iterations=50 --scenario=scene-mount

# Analyze with clinic.js
clinic doctor -- node server.js
clinic flame -- node server.js
```

### 2.4 Network Performance

| Metric | Target | Measurement | Status |
|--------|--------|-------------|--------|
| Critical CSS Inlined | Yes | View Source | ☐ |
| Font Preload (woff2) | Yes | Network Tab | ☐ |
| Resource Hints (preconnect, dns-prefetch) | Configured | View Source | ☐ |
| Service Worker Caching | Active | Application Tab | ☐ |
| Brotli Compression | Enabled | Response Headers | ☐ |
| HTTP/2 or HTTP/3 | Enabled | Network Tab | ☐ |
| CDN Cache Hit Ratio | > 95% | CDN Analytics | ☐ |
| Edge Function Latency (p99) | < 100ms | Vercel/Cloudflare Logs | ☐ |

---

## 3. Security Audit

### 3.1 Content Security Policy (CSP)

**Production CSP Header:**
```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://js.sentry-cdn.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  img-src 'self' data: https: blob:;
  connect-src 'self' https://api.github.com https://sentry.io https://*.upstash.io wss://*.upstash.io;
  frame-src 'self' https://github.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
  block-all-mixed-content;
```

| Directive | Configured | Nonce/Hash Used | Report-Only Tested | Status |
|-----------|------------|-----------------|-------------------|--------|
| default-src | ☐ | N/A | ☐ | ☐ |
| script-src | ☐ | ☐ (nonces) | ☐ | ☐ |
| style-src | ☐ | ☐ (hashes) | ☐ | ☐ |
| connect-src | ☐ | N/A | ☐ | ☐ |
| img-src | ☐ | N/A | ☐ | ☐ |
| font-src | ☐ | N/A | ☐ | ☐ |
| frame-ancestors | ☐ | N/A | ☐ | ☐ |
| report-uri | ☐ | N/A | ☐ | ☐ |

**CSP Testing:**
```bash
# Test with CSP Evaluator
pnpm test:csp:evaluator

# Report-only mode verification
pnpm test:csp:report-only --duration=3600
```

### 3.2 Security Headers

| Header | Value | Verified | Status |
|--------|-------|----------|--------|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | ☐ | ☐ |
| X-Content-Type-Options | `nosniff` | ☐ | ☐ |
| X-Frame-Options | `DENY` | ☐ | ☐ |
| X-XSS-Protection | `1; mode=block` | ☐ | ☐ |
| Referrer-Policy | `strict-origin-when-cross-origin` | ☐ | ☐ |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | ☐ | ☐ |
| Cross-Origin-Opener-Policy | `same-origin` | ☐ | ☐ |
| Cross-Origin-Resource-Policy | `same-origin` | ☐ | ☐ |
| Cross-Origin-Embedder-Policy | `require-corp` | ☐ | ☐ |

### 3.3 CORS Configuration

```typescript
// next.config.js - Verified Configuration
const corsOptions = {
  origin: process.env.NEXT_PUBLIC_APP_URL,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};