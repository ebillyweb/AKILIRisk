# Phase 1: Authentication & Security - Research

**Researched:** 2026-02-17
**Domain:** Web application authentication, session management, multi-factor authentication
**Confidence:** HIGH

## Summary

Modern full-stack JavaScript authentication in 2026 requires balancing security rigor with developer velocity. High-net-worth client data mandates enterprise-grade protection: Argon2id password hashing, AES-256 encryption, TLS 1.3 transport security, and mandatory MFA. The ecosystem has converged on three viable approaches: Auth.js v5 (full control, self-hosted), Clerk (fastest implementation, managed), and WorkOS (enterprise SSO ready). For this phase, **Auth.js v5 + PostgreSQL + Prisma** provides optimal balance of security control, cost predictability, and technical flexibility without vendor lock-in.

Authentication failures remain #7 in OWASP Top 10:2025, with credential stuffing, session fixation, and weak password policies as primary attack vectors. Cookie-based sessions with HttpOnly flags, rolling expiration, and server-side validation prevent XSS and CSRF attacks. Password reset flows require cryptographically random tokens (32+ bytes), 15-60 minute expiration, and hashed storage. TOTP-based MFA using established standards (RFC 6238) with backup codes provides practical security for user assessments without introducing passkey complexity in MVP.

**Primary recommendation:** Use Auth.js v5 with Prisma adapter, PostgreSQL database, Argon2id password hashing, Resend for transactional emails, and TOTP MFA implementation. This stack delivers production-grade security while maintaining full data control and avoiding per-user pricing that scales with business success.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Auth.js (NextAuth.js) | v5 (beta) | Authentication framework | Purpose-built for Next.js App Router, universal `auth()` function across all contexts, 20+ database adapters |
| Prisma | 6.x | Database ORM with type safety | Industry standard for TypeScript + PostgreSQL, automatic type generation, Auth.js native adapter |
| PostgreSQL | 16+ | Relational database | GDPR/HIPAA compliant, ACID guarantees, battle-tested for financial/HNW data |
| argon2 | Latest | Password hashing | OWASP recommended (2026), winner of Password Hashing Competition, memory-hard design resists GPU attacks |
| Resend | Latest | Transactional email | Developer-centric, React Email support, adjusts IPs dynamically, free 3k emails/month |
| speakeasy (fork: libotp) | Latest | TOTP MFA generation | RFC 6238 compliant, Google Authenticator compatible, time-drift handling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @auth/prisma-adapter | Latest | Auth.js + Prisma integration | Required to persist sessions/users in PostgreSQL via Prisma |
| crypto (Node.js) | Built-in | Token generation | Password reset tokens - use `crypto.randomBytes(32)` minimum |
| qrcode | Latest | QR code generation | MFA enrollment - display TOTP secret for authenticator apps |
| zod | Latest | Input validation | Validate email format, password strength, token format before database operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js v5 | Clerk | Clerk: 15-min setup, $25-100+/mo per-MAU pricing scales poorly. Auth.js: 3-6 weeks setup, $0 recurring except infrastructure |
| Auth.js v5 | WorkOS | WorkOS: Enterprise SSO/SCIM ready, usage-based pricing. Overkill for B2C MVP, defer until B2B enterprise customers |
| PostgreSQL | MongoDB | MongoDB: Flexible schema, but lacks relational integrity for user→session→account relationships. PostgreSQL better for financial compliance |
| Resend | SendGrid | SendGrid: Larger, more mature, but deliverability issues on shared IPs. Resend: Modern, cleaner API, React Email integration |
| Argon2id | bcrypt | bcrypt: Still secure with cost factor 13-14, but Argon2id is OWASP 2026 recommendation and resists GPU attacks better |

**Installation:**
```bash
npm install next-auth@beta @auth/prisma-adapter @prisma/client prisma argon2 resend qrcode zod
npm install -D @types/qrcode
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── api/auth/[...nextauth]/    # Auth.js route handlers
│   ├── (auth)/                     # Auth pages: sign-in, sign-up, reset
│   └── (protected)/                # Protected routes requiring auth
├── lib/
│   ├── auth.ts                     # Auth.js configuration
│   ├── db.ts                       # Prisma client singleton
│   ├── email.ts                    # Resend client + templates
│   └── mfa.ts                      # TOTP generation/verification
├── middleware.ts                   # Route protection via clerkMiddleware alternative
└── prisma/
    └── schema.prisma               # User, Session, Account, VerificationToken models
```

### Pattern 1: Auth.js v5 Configuration
**What:** Centralized authentication configuration with providers, callbacks, and session strategy
**When to use:** Required setup for Auth.js v5
**Example:**
```typescript
// Source: https://authjs.dev/getting-started/installation
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/db"
import argon2 from "argon2"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" }, // Server-side sessions for security
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        if (!user) return null

        const valid = await argon2.verify(user.password, credentials.password)
        return valid ? { id: user.id, email: user.email } : null
      }
    })
  ],
  callbacks: {
    async session({ session, user }) {
      // Attach MFA status to session
      const mfaEnabled = await prisma.user.findUnique({
        where: { id: user.id },
        select: { mfaEnabled: true }
      })
      session.user.mfaEnabled = mfaEnabled?.mfaEnabled
      return session
    }
  }
})
```

### Pattern 2: Middleware Route Protection
**What:** Edge-compatible middleware that validates sessions before rendering protected routes
**When to use:** Protect all routes under `/dashboard`, `/assessment`, etc.
**Example:**
```typescript
// Source: https://authjs.dev/getting-started/session-management/protecting
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isAuthenticated = !!req.auth
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard")

  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/signin", req.url))
  }

  // Check MFA requirement for assessment routes
  if (req.nextUrl.pathname.startsWith("/assessment") && !req.auth?.user?.mfaVerified) {
    return NextResponse.redirect(new URL("/mfa/verify", req.url))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
}
```

### Pattern 3: Password Reset Flow
**What:** Time-limited, single-use tokens for secure password reset
**When to use:** "Forgot password" functionality
**Example:**
```typescript
// Source: https://blog.logrocket.com/implementing-secure-password-reset-node-js/
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { sendEmail } from "@/lib/email"

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return // Don't reveal if email exists (security)

  // Generate cryptographically random token (32 bytes = 256 bits)
  const resetToken = crypto.randomBytes(32).toString("hex")
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex")

  // Store hashed token with 15-minute expiration
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    }
  })

  const resetUrl = `${process.env.NEXT_PUBLIC_URL}/reset-password?token=${resetToken}`
  await sendEmail({
    to: email,
    subject: "Reset your password",
    html: `Click here to reset: <a href="${resetUrl}">Reset Password</a>`
  })
}

export async function resetPassword(token: string, newPassword: string) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token: hashedToken,
      expires: { gt: new Date() } // Not expired
    }
  })

  if (!verificationToken) {
    throw new Error("Invalid or expired token")
  }

  const hashedPassword = await argon2.hash(newPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 1
  })

  await prisma.user.update({
    where: { email: verificationToken.identifier },
    data: { password: hashedPassword }
  })

  // Delete used token
  await prisma.verificationToken.delete({
    where: { token: hashedToken }
  })
}
```

### Pattern 4: TOTP MFA Implementation
**What:** Time-based one-time password MFA using RFC 6238
**When to use:** Required for AUTH-05 - MFA for assessment data access
**Example:**
```typescript
// Source: https://blog.logrocket.com/implementing-two-factor-authentication-using-speakeasy/
// Note: Consider using libotp (maintained fork) instead of unmaintained speakeasy
import speakeasy from "speakeasy"
import qrcode from "qrcode"
import { prisma } from "@/lib/db"

export async function enrollMFA(userId: string) {
  const secret = speakeasy.generateSecret({
    name: `AKILI Risk (${userId})`,
    length: 32
  })

  // Store secret (encrypted at database level)
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: secret.base32, mfaEnabled: false } // Not enabled until verified
  })

  // Generate QR code for authenticator app
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url)

  return { secret: secret.base32, qrCodeUrl }
}

export async function verifyMFAToken(userId: string, token: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true }
  })

  if (!user?.mfaSecret) return false

  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: "base32",
    token,
    window: 1 // Allow 30s time drift
  })

  return verified
}

export async function enableMFA(userId: string, token: string) {
  const verified = await verifyMFAToken(userId, token)
  if (!verified) throw new Error("Invalid MFA token")

  // Only enable after successful verification
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true }
  })
}
```

### Pattern 5: Prisma Schema for Authentication
**What:** Database models for User, Session, Account, and VerificationToken
**When to use:** Required schema for Auth.js + Prisma adapter
**Example:**
```prisma
// Source: https://authjs.dev/getting-started/adapters/prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  password      String    // Argon2id hashed
  name          String?
  image         String?
  mfaEnabled    Boolean   @default(false)
  mfaSecret     String?   // TOTP secret (encrypt at rest)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### Anti-Patterns to Avoid
- **Client-side only authentication checks:** Layout components don't re-render on navigation, leaving routes unprotected. Always use middleware + server-side checks.
- **Storing sensitive data in JWTs:** JWTs are signed, not encrypted. Never put PII or sensitive assessment data in JWT payload. Use database sessions.
- **Password validation in client only:** Client validation is UX, not security. Always validate password strength, email format server-side with Zod.
- **Predictable password reset tokens:** Never use timestamps, sequential numbers, or UUIDs. Use `crypto.randomBytes(32)` minimum.
- **Long token expiration:** Password reset tokens >60 minutes create attack windows. Use 15-minute expiration, force users to retry if expired.
- **Not rate limiting:** Brute force and credential stuffing attacks exploit unlimited login attempts. Rate limit to 5 attempts per 15 minutes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth provider integration | Custom OAuth flow handlers | Auth.js providers | OAuth has 20+ security edge cases (CSRF, PKCE, state validation). Auth.js handles all RFCs correctly. |
| Session management | Custom session tokens, cookie logic | Auth.js database sessions | Session fixation, CSRF, XSS, timing attacks require expertise. Auth.js provides secure defaults (HttpOnly, SameSite, rolling expiration). |
| Password hashing | MD5, SHA-256, custom salt generation | argon2 npm package | Password hashing algorithms require specific parameters (memory cost, time cost, parallelism). Argon2 won Password Hashing Competition, OWASP approved. |
| Email verification | Custom token generation, expiry logic | Auth.js VerificationToken model + adapter | Email verification has race conditions, token reuse attacks, timing vulnerabilities. Auth.js adapter handles atomically. |
| Rate limiting | In-memory counters, custom throttling | Upstash Rate Limit or next-rate-limit | Distributed rate limiting across serverless functions requires Redis/external state. In-memory fails in multi-instance deployments. |
| TOTP generation | Custom time-slicing, HMAC-SHA1 | speakeasy or libotp | RFC 6238 TOTP has precise time-window calculations, secret encoding, drift handling. Use battle-tested library. |

**Key insight:** Authentication has decades of accumulated attack patterns. OWASP Top 10:2025 A07 (Authentication Failures) shows professionals still get it wrong. Every "simple" auth flow (password reset, session management, OAuth) has 10+ security edge cases that take years to discover. Use libraries that encode expert knowledge.

## Common Pitfalls

### Pitfall 1: Weak Password Storage
**What goes wrong:** Storing plaintext passwords, using bcrypt with cost factor <10, or using MD5/SHA hashes instead of password-specific algorithms
**Why it happens:** Developers confuse hashing (one-way) with encryption (reversible), or use cryptographic hashes (fast, designed for data integrity) instead of password hashes (slow, designed to resist brute force)
**How to avoid:** Use Argon2id with minimum config: `{ type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 }`. OWASP 2026 recommendation. Memory-hard design makes GPU attacks economically infeasible.
**Warning signs:** User reports "password reminder" email (means passwords stored reversibly), login response time <50ms (hash computation should take 250-500ms), database backup shows readable passwords

### Pitfall 2: Session Fixation and Hijacking
**What goes wrong:** Session IDs don't regenerate after login, session tokens stored in localStorage (accessible to XSS), or sessions don't expire
**Why it happens:** Misunderstanding difference between authentication (who are you) and session management (prove you're still you). Developers create sessions before authentication, allowing attackers to "fix" a session ID then wait for victim to log in.
**How to avoid:** Use Auth.js database sessions with `strategy: "database"`. Always regenerate session ID after successful login. Store session tokens in HttpOnly cookies (JavaScript can't access). Set rolling expiration (session refreshes on activity, expires after 7-30 days idle).
**Warning signs:** Session tokens in URL query parameters, localStorage containing tokens, users logged out unexpectedly, inability to force logout compromised sessions

### Pitfall 3: Missing or Bypassable MFA
**What goes wrong:** MFA required for enrollment but not enforced on subsequent logins, MFA disable feature without re-authentication, backup codes generated without secure random source
**Why it happens:** Adding MFA as bolt-on feature after authentication system built, treating MFA as binary "enabled/disabled" without state machine for enrollment → verification → active
**How to avoid:** Check `mfaEnabled` flag in middleware before allowing access to `/assessment` routes. Require current password or MFA token to disable MFA. Generate backup codes with `crypto.randomBytes(8)` per code, hash before storage, allow one-time use only. Store MFA secret encrypted at database level.
**Warning signs:** Can disable MFA from settings without re-auth, MFA prompt shows after already accessing protected data, backup codes are sequential or predictable, MFA secret visible in database plaintext

### Pitfall 4: Password Reset Token Vulnerabilities
**What goes wrong:** Reset tokens that don't expire, tokens stored unhashed in database, tokens reusable after password change, user enumeration via "email not found" vs "email sent" responses
**Why it happens:** Password reset flow treated as edge case, not designed with same rigor as primary authentication. Developers forget tokens are credentials (like passwords) requiring hashing.
**How to avoid:** Generate tokens with `crypto.randomBytes(32)`, hash with SHA-256 before database storage, expire after 15 minutes, delete immediately after use. Return same "if email exists, reset link sent" message for all emails (don't reveal if account exists). Rate limit reset requests to 3 per hour per IP.
**Warning signs:** Password reset works hours after requesting, can reuse reset link multiple times, error messages differ for valid vs invalid emails, no rate limiting on reset endpoint

### Pitfall 5: Insufficient Transport Security
**What goes wrong:** Sensitive data transmitted over HTTP, TLS 1.0/1.1 still accepted, certificate validation disabled in development (then deployed to production), cookies without Secure flag
**Why it happens:** Local development uses HTTP, developers disable SSL verification to avoid cert warnings, then forget to re-enable for production. Cookie flags not tested in development (Secure flag only works over HTTPS).
**How to avoid:** Enforce HTTPS in production via middleware (redirect HTTP → HTTPS), use TLS 1.3 minimum (configured at hosting layer - Vercel, AWS, etc.), set cookie flags `Secure; HttpOnly; SameSite=Lax` in Auth.js config, test in production-like environment with valid TLS cert before launch.
**Warning signs:** Browser shows "Not secure" on login page, cookies visible in browser DevTools Network tab, TLS 1.0/1.1 shown in security report, session tokens work when sent over HTTP

### Pitfall 6: Credential Stuffing Without Detection
**What goes wrong:** Attackers use stolen credentials from breached sites to access accounts, no rate limiting or anomaly detection, no breach monitoring
**Why it happens:** Assumption that strong passwords alone prevent unauthorized access, forgetting users reuse passwords across sites
**How to avoid:** Implement rate limiting (5 failed logins per 15 min per IP and per email), log all authentication attempts with IP/user agent, consider integrating HaveIBeenPwned API to reject compromised passwords at registration, require MFA for high-value operations (viewing assessment results, downloading reports)
**Warning signs:** Multiple failed login attempts from different IPs, successful logins from unusual geolocations, users reporting unauthorized access despite "secure password"

### Pitfall 7: Database Session Storage Without Encryption
**What goes wrong:** Session data, MFA secrets, or password reset tokens stored in database without encryption at rest, DBA or database backup exposes sensitive data
**Why it happens:** Focus on transport security (HTTPS) but neglecting data at rest, belief that hashing is sufficient (hashing is one-way, encryption is reversible)
**How to avoid:** Enable PostgreSQL encryption at rest (cloud providers: enable by default on AWS RDS, GCP Cloud SQL, Azure Database), encrypt MFA secrets at application layer using KMS or secrets manager before storage, use database-level encryption for compliance (HIPAA, GDPR), regular audit of backup security
**Warning signs:** Database export shows readable session tokens or MFA secrets, compliance audit flags unencrypted PII, MFA secret visible in Prisma Studio

## Code Examples

Verified patterns from official sources:

### Environment Configuration
```bash
# Source: https://authjs.dev/getting-started/installation
# Generate with: npx auth secret
AUTH_SECRET=<generated-secret-here>
DATABASE_URL=postgresql://user:password@localhost:5432/belvedere
RESEND_API_KEY=re_<your-resend-key>
NEXT_PUBLIC_URL=https://yourdomain.com
```

### User Registration with Argon2id
```typescript
// Source: https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/
import argon2 from "argon2"
import { prisma } from "@/lib/db"
import { z } from "zod"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
    "Password must contain uppercase, lowercase, number, and special character"
  )
})

export async function registerUser(input: unknown) {
  const { email, password } = registerSchema.parse(input)

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error("Email already registered")

  // Hash password with Argon2id (OWASP 2026 recommendation)
  const hashedPassword = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,        // 3 iterations
    parallelism: 1      // Single thread
  })

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword
    }
  })

  return { id: user.id, email: user.email }
}
```

### Rate Limiting Middleware
```typescript
// Source: Pattern from OWASP Top 10:2025 A07 prevention guidelines
import { NextRequest, NextResponse } from "next/server"

const loginAttempts = new Map<string, { count: number, resetAt: number }>()

export function rateLimitLogin(req: NextRequest): boolean {
  const identifier = req.headers.get("x-forwarded-for") || "unknown"
  const now = Date.now()
  const limit = 5
  const windowMs = 15 * 60 * 1000 // 15 minutes

  const record = loginAttempts.get(identifier)

  if (!record || now > record.resetAt) {
    loginAttempts.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false // Rate limit exceeded
  }

  record.count++
  return true
}

// Usage in API route
export async function POST(req: NextRequest) {
  if (!rateLimitLogin(req)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 }
    )
  }

  // ... proceed with login
}
```

### Resend Email Integration
```typescript
// Source: https://resend.com/docs/send-with-nextjs
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const { data, error } = await resend.emails.send({
    from: "AKILI Risk <noreply@yourdomain.com>",
    to: email,
    subject: "Reset your password",
    html: `
      <h1>Reset your password</h1>
      <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If you didn't request this, ignore this email.</p>
    `
  })

  if (error) {
    console.error("Failed to send email:", error)
    throw new Error("Failed to send password reset email")
  }

  return data
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bcrypt password hashing | Argon2id password hashing | 2015 (Argon2 won PHC), OWASP endorsed 2021+ | Argon2id resists GPU/ASIC attacks via memory hardness. bcrypt still secure but Argon2id preferred for new systems |
| JWT-only sessions | Database sessions or hybrid (short JWT + refresh token) | 2020-2023 trend shift | JWTs can't be revoked without complex blocklists. Database sessions allow instant logout/revocation at cost of database lookup |
| NextAuth.js v4 (Pages Router) | Auth.js v5 (App Router) | 2024-2025 | v5 rewrite for React Server Components, universal `auth()` function, cleaner API. v4 still maintained but v5 required for App Router |
| SMS-based 2FA | TOTP or passkeys | 2022+ (SMS vulnerabilities widely known) | SIM swapping attacks bypass SMS 2FA. TOTP (Google Authenticator) more secure. Passkeys (WebAuthn) emerging standard for 2026+ |
| OAuth 2.0 | OAuth 2.1 + PKCE mandatory | OAuth 2.1 draft 2023, finalized 2024 | PKCE (Proof Key for Code Exchange) prevents authorization code interception. OAuth 2.1 deprecates implicit flow, mandates PKCE for all clients |
| TLS 1.2 | TLS 1.3 | TLS 1.3 released 2018, industry standard 2024+ | TLS 1.3 removes vulnerable cipher suites, faster handshake (1-RTT vs 2-RTT), forward secrecy by default |

**Deprecated/outdated:**
- **Passport.js:** While functional, not designed for modern Next.js App Router. Requires manual session management. Auth.js provides better DX.
- **bcrypt cost factor <10:** Modern GPUs make cost <10 brute-forceable. Minimum cost 12 for bcrypt, but prefer Argon2id.
- **MD5/SHA-1 password hashing:** Cryptographic hashes designed for speed (bad for passwords). Never use for passwords.
- **Storing passwords reversibly:** "Password reminder" feature means passwords encrypted (reversible) not hashed. Major security violation.
- **Session IDs in URLs:** Leak in Referer header, browser history, server logs. Always use HttpOnly cookies.
- **speakeasy library (unmaintained):** Last commit 2017. Use libotp (maintained TypeScript fork) for new projects.

## Open Questions

1. **Should we implement passkeys (WebAuthn) in Phase 1?**
   - What we know: Passkeys becoming default authentication in 2026, phishing-resistant, better UX than passwords + MFA
   - What's unclear: Implementation complexity for MVP, browser support for target audience (HNW families likely use latest browsers), fallback strategy if hardware key lost
   - Recommendation: Defer to Phase 1.5 or Phase 2. Implement password + TOTP MFA first (proven, understood), add passkeys as alternative once core auth stable. Passkeys require WebAuthn API, device registration flow, recovery mechanisms - adds weeks to timeline.

2. **Which database: PostgreSQL or MongoDB?**
   - What we know: Auth.js supports both via adapters. PostgreSQL = relational integrity, MongoDB = flexible schema
   - What's unclear: Will assessment data (Phase 2) benefit from relational structure (User → Assessment → Responses) or document model (nested JSON)?
   - Recommendation: **PostgreSQL with Prisma**. Assessment likely has structured relationships (user → multiple assessments → scored responses). Financial/HNW compliance favors relational databases. Prisma provides type safety and migrations. If schema flexibility critical later, can add JSONB columns.

3. **Self-host email (SMTP) or use transactional service?**
   - What we know: Self-hosted = full control, $0 cost. Transactional service (Resend/Postmark) = better deliverability, time cost
   - What's unclear: MVP email volume (likely <1000 emails/month), importance of inbox placement for password reset emails
   - Recommendation: **Resend for MVP**. Free tier covers 3k emails/month. Password reset emails must reach inbox (not spam). Deliverability expertise hard - let Resend handle. Self-host later if cost becomes issue (unlikely for HNW B2C product).

4. **Rate limiting strategy for serverless (Vercel)?**
   - What we know: In-memory rate limiting fails across serverless function instances. Need external state (Redis, edge KV)
   - What's unclear: Best solution for Next.js on Vercel - Upstash Redis, Vercel KV, or middleware-only approach
   - Recommendation: Start with **Vercel Edge Config + middleware** for rate limiting. Persists across functions, edge-native, included in Vercel Pro plan. Upstash Redis more powerful but adds dependency. For MVP, Edge Config sufficient for login rate limiting (5 attempts per 15 min).

5. **Token storage security: environment variables vs KMS?**
   - What we know: `AUTH_SECRET` used to encrypt sessions. If compromised, attacker can forge sessions. KMS (AWS Secrets Manager, GCP Secret Manager) more secure than `.env`
   - What's unclear: MVP threat model - is environment variable security sufficient for initial launch?
   - Recommendation: **Environment variables for MVP, plan KMS migration for production**. Vercel encrypts environment variables. For MVP launch (limited users, private beta), env vars acceptable. Before public launch or SOC2, migrate secrets to KMS. Document as Phase 5 (Productionization) task.

## Sources

### Primary (HIGH confidence)
- [Auth.js Getting Started - Installation](https://authjs.dev/getting-started/installation) - Auth.js v5 setup, configuration patterns
- [Auth.js Prisma Adapter](https://authjs.dev/getting-started/adapters/prisma) - Database schema, adapter configuration
- [Auth.js Session Management - Protecting Routes](https://authjs.dev/getting-started/session-management/protecting) - Middleware patterns
- [OWASP Top 10:2025 - A07 Authentication Failures](https://owasp.org/Top10/2025/A07_2025-Authentication_Failures/) - Current vulnerabilities, prevention strategies
- [Password Hashing Guide 2025: Argon2 vs Bcrypt](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) - Algorithm comparison, configuration
- [Prisma with Better Auth and Next.js](https://www.prisma.io/docs/guides/betterauth-nextjs) - Database schema patterns

### Secondary (MEDIUM confidence)
- [WorkOS: Top 5 Auth Solutions for Next.js 2026](https://workos.com/blog/top-authentication-solutions-nextjs-2026) - Vendor comparison
- [Clerk vs Auth.js vs Supabase: Production Reality](https://medium.com/better-dev-nextjs-react/clerk-vs-supabase-auth-vs-nextauth-js-the-production-reality-nobody-tells-you-a4b8f0993e1b) - Real-world tradeoffs
- [Postmark: 6 Best Transactional Email Providers 2025](https://postmarkapp.com/blog/transactional-email-providers) - Email service comparison
- [LogRocket: Secure Password Reset in Node.js](https://blog.logrocket.com/implementing-secure-password-reset-node-js/) - Token generation patterns
- [LogRocket: 2FA with Speakeasy](https://blog.logrocket.com/implementing-two-factor-authentication-using-speakeasy/) - TOTP implementation
- [Next.js Middleware Protected Routes](https://medium.com/codetodeploy/how-i-handle-authentication-protected-routes-in-next-js-without-overcomplicating-it-2dcb25a4bf89) - Route protection patterns
- [Web Application Security Best Practices 2026](https://latesthackingnews.com/2026/01/28/web-application-security-best-practices-best-practices-for-securing-web-applications/) - General security principles
- [Next.js Database Integration: Prisma vs Supabase vs MongoDB](https://vladimirsiedykh.com/blog/nextjs-database-integration-prisma-supabase-mongodb) - Database choice guidance

### Tertiary (LOW confidence - requires validation)
- [GitHub: speakeasy library](https://github.com/speakeasyjs/speakeasy) - Note: UNMAINTAINED (last commit 2017)
- [GitHub: libotp library](https://github.com/speakeasyjs/libotp) - Maintained fork of speakeasy in TypeScript

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Auth.js, Prisma, PostgreSQL, Argon2 well-documented with official sources, industry standard for 2026
- Architecture: HIGH - Patterns verified from Auth.js official docs, OWASP guidelines, established security practices
- Pitfalls: MEDIUM - Based on OWASP Top 10:2025 and multiple security articles, but specific scenarios require testing

**Research date:** 2026-02-17
**Valid until:** 2026-04-17 (60 days - authentication standards evolve slowly, Auth.js v5 stable)
