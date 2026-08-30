# Security and Non-Functional Requirements

**Status of this document:** written at the close of M5, verified against the codebase as it stands
on 2026-08-10 rather than from notes. Every claim below was re-checked against the actual files or
re-measured against the running stack while writing. Where a requirement is not met, this document
says so plainly rather than describing an intention.

**On the references below to `architecture.md`:** that is the project's design document, which sets
out the requirements and section numbers cited here. It is internal to the engagement and is not
part of this repository, so those citations will not resolve to a file. Every claim made here about
this codebase stands on its own and can be checked against the code.

---

## 1. Requirement status at a glance

Rows are the non-functional requirements from `architecture.md` section 3, in that document's order.

| Requirement | Status | Where |
|---|---|---|
| AI classification responds in under 800ms | **NOT MET as a guarantee, materially improved by M8-5: 133 of 150 calls, against 48 of 60 before** | section 7 |
| JWT verification on all endpoints | **Met, with two deliberate exceptions** | section 2 |
| Input sanitization against SQL injection and XSS | **Met** | section 5 |
| Max 10 ticket submissions per hour per authenticated user | **Met** | section 4 |
| Email and issue text encrypted in transit (TLS 1.3) and at rest (AES-256) | **NOT MET** | section 9 |
| Widget must not block the host page if the AI call is slow or fails | **Met** | section 7 |
| Widget runs across 4 pages without per-page custom code | **Met** | section 8 |
| Every ticket traceable to a user, page and timestamp | **Met** | section 2 |
| Observability: structured logging and basic metrics | **NOT MET** | section 10 |
| Testability: AI classification mockable without a live API | **Met** | section 10 |

One further row, which is not an `architecture.md` section 3 NFR but belongs in this table because a
reader checking "is the data protected" will look here and would otherwise not find it. It comes
from the privacy row of `architecture.md` section 5, which asks to "restrict read access":

| Requirement | Status | Where |
|---|---|---|
| Restrict read access to stored tickets | **Partially met: authenticated, but not role-based** | section 2 |
| Restrict who may change a stored ticket | **Partially met: authenticated, but any user may change any ticket's status** | section 2 |

---

## 2. Authentication and identity

`backend/src/middleware/auth.middleware.ts` verifies a bearer token on every protected request. Two
details are deliberate:

- **The algorithm is pinned to HS256.** `jwt.verify` is called with `algorithms: ["HS256"]`, so a
  forged token cannot select its own algorithm through the JWT header, including `none`.
- **Missing claims are rejected, not defaulted.** A token that verifies but carries no string
  `username` and `email` returns 401 rather than proceeding with an undefined identity.

**Identity is only ever derived from verified claims.** This was audited in M5-6 and the property is
enforced twice, independently, on purpose:

1. `validate.middleware.ts` allowlists exactly five body fields (`product_name`, `category`,
   `issue_description`, `ai_suggested_category`, `ai_mode_enabled`). A body containing `username` or
   `email` is rejected with `400 Unexpected field(s)` and never reaches business logic.
2. Even with that rejection removed, the payload has no route into storage. `ValidatedTicketBody`
   declares no identity fields, and `tickets.service.ts` explicitly maps `identity.username` and
   `identity.email` into the `NewTicket` passed to `insertTicket`.

Both were verified by request, not by reading. A valid token for `johndoe` sent alongside
`"username": "attacker"` returned 400, and calling the service directly with a payload carrying
`username: "attacker"` (bypassing validation entirely) still stored the row under the verified
identity. No row attributed to `attacker` was ever created. The redundancy is intentional and should
not be removed on the grounds that the other layer covers it.

**Timestamps are server-stamped.** `datetime` appears in neither the field allowlist nor the INSERT
column list, so Postgres supplies it via `DEFAULT NOW()`. A client cannot influence it.

Together with `product_name` (see section 8) this satisfies the auditability requirement: every row
carries a verified user, a detected page and a server-generated timestamp.

### Authorization: there is none, and that is a real limitation

Everything above is *authentication*. The system performs no *authorization* at all. This began as a
read-side exposure and, since M8-3, is a write-side one as well.

**`PATCH /api/v1/tickets/:ticket_id/status` (M8-3) reuses `authMiddleware` and nothing else, so any
valid token can change the status of any ticket, including another user's.** Same absent
authorization as the read side below, materially worse consequence: a reader sees data that is not
theirs, whereas this alters a record that is not theirs, and nothing in the schema records who
changed it or when. There is no status history, no `updated_at` and no audit trail, so a change is
indistinguishable afterwards from the ticket having always been in that state. The route chain is
`authMiddleware`, `validateStatusMiddleware`, `updateTicketStatusController`, deliberately without a
rate limiter, since the existing limiter counts submissions and this endpoint creates none.

The rest of this section is the read side, which came first.

**`GET /api/v1/tickets` (M6-2) reuses `authMiddleware` and nothing else. Any valid token reads every
ticket ever submitted, including other users' `email` and `issue_description`.** There is no role
system, no admin claim, no per-user filtering and no column that would support one. The route chain
is `authMiddleware` then `listTicketsController`, deliberately without the rate limiter, since that
limiter counts submissions.

This was a decision rather than an oversight. The specification asks for JWT verification on all
endpoints and never mentions roles, so a role model would have been scope the project was never
asked for, invented at the last milestone. It is recorded here as an accepted limitation with its
reasoning, which is not the same as saying it is safe.

**Two consequences to state plainly, because a deployer needs both before pointing this at real
users' reports:**

1. This is the first surface in the system that returns `email` and `issue_description` to any
   client at all. The create response deliberately omits both (`architecture.md` section 8), and
   until M6-2 `issue_description` was write-only from the outside. The asymmetry is intentional, in
   that an admin table whose purpose is reading issue text cannot omit the issue text, but it does
   mean the exposure is new rather than pre-existing.
2. The privacy row in `architecture.md` section 5 asks to "restrict read access". That is satisfied
   only in the weak sense of "a valid token is required". Every authenticated user of the host
   application is an administrator of this data in practice.

The admin table at `/admin` (M6-3) is the surface that makes this visible, and it is dev-server-only
(section 8), so today the exposure requires `DEV_AUTH_ENABLED` as well. That is a property of the
current deployment shape, not a control, and it disappears the moment the page is built for real.

**The two endpoints without JWT verification**, stated explicitly rather than glossed:

- `GET /health` returns only `{"status":"ok"}` and exposes no data.
- `POST /api/v1/dev/token` issues tokens and therefore cannot require one. It is the subject of
  section 3 and is not mounted at all in a normal deployment.

---

## 3. Development-mode token issuance

`POST /api/v1/dev/token` exists so the repository can complete a submission end to end without a
hand-crafted token. Before M5-1 the committed widget sent the literal string `mock-jwt-token`, which
`auth.middleware.ts` correctly rejected, so every verification since M2 had depended on a token
pasted in by hand and never committed.

It is not a login flow. `architecture.md` section 4 settles that the widget is embedded in an
already-authenticated host application and does not own authentication. What was missing was never
authentication, only a signed token the project could produce for itself.

Controls on it, all verified by request:

- **Gated by `DEV_AUTH_ENABLED`, which defaults to false.** `.env.example` ships
  `DEV_AUTH_ENABLED=false`. The comparison is a strict equality against the string `"true"`, so any
  unrecognised value (unset, `1`, `yes`, a typo) leaves it off. A flag whose wrong value is an
  authentication bypass fails closed.
- **The route is not mounted when the flag is off.** `app.ts` registers it inside an `if`, so a
  deployment with the flag off has no code path to it and the URL returns an ordinary 404. This was
  chosen over always mounting it and returning 403 from inside the handler, which would leave a live
  token-issuing endpoint in production whose safety rested on one comparison in a request handler.
- **It accepts no request body and issues one fixed identity** (`johndoe` /
  `johndoe@example.com`). An endpoint that signed a token for a caller-supplied username and email
  would be an identity-forgery endpoint. Fixed identity means the worst case, if the flag were ever
  enabled by mistake, is one well-known demo user rather than arbitrary impersonation.
- **Tokens expire after one hour.** The widget fetches on load, so a longer life buys nothing.
- **Enabling it logs a warning at boot**, so the state is never silent.

**This must never be enabled in a deployed environment.**

---

## 4. Rate limiting

`backend/src/middleware/rateLimit.middleware.ts` provides a `createRateLimiter` factory, from which
**two independent limiters** are built. Each closes over its own counter map, so they cannot share a
bucket by accident.

**Limiter 1: ticket submissions.** Enforces the specification's limit of 10 per hour per
authenticated user, returning 429 when exceeded. Verified against the running stack with a real
token: ten submissions returned 201 and the eleventh returned 429, and exactly ten rows reached the
database.

- **Keyed on `identity.email` from the verified token.** Never on IP, which would throttle a whole
  office together while letting one user bypass the limit by changing network, and never on a body
  field, which is attacker-controlled.
- **Fails closed if miswired.** If `req.identity` is absent the middleware throws rather than using
  a non-null assertion. A controller crashing on a missing identity is a crash; a rate limiter
  silently skipping is a security control failing open in silence.
- **The limit is configurable** via `RATE_LIMIT_MAX_PER_HOUR`, which defaults to 10.
  **Deployments are expected to run the default.** A non-integer or non-positive value refuses to
  start rather than defaulting, because a `NaN` limit would make every comparison false and silently
  accept unlimited requests while appearing configured.

**Three known limitations, none of them accidental:**

1. **In-memory, so single-instance only.** Per `architecture.md` section 6.3 this is an accepted
   simplification for a demo. A second backend instance would keep its own counts and the effective
   limit would double. A Redis-backed store is the production fix.
2. **Counts reset when the process restarts.** A restart grants every user a fresh quota.
3. **The window is fixed, not sliding.** The hour resets whole rather than rolling, so a user can
   send the limit twice across a boundary (ten at 59:59 and ten again at 60:01). This is what
   "hourly reset" in the specification describes, and correcting it would mean a sliding window.

**Ordering, and the trade it accepts.** The create-ticket chain is
`authMiddleware` then `validateMiddleware` then `rateLimitMiddleware` then `createTicketController`.
Auth must come first because the limiter needs a verified identity. Validation deliberately runs
*before* the limiter: the 429 message promises a number of tickets per hour, and the specification
says "10 ticket submissions per hour", so a request rejected as malformed never became a submission
and must not spend the user's quota. **The accepted exposure is that malformed requests are not
throttled by this middleware.** That is tolerable because rejection happens before any database or
AI work, but it is a real gap and is stated here rather than left implicit. This ordering was
verified rather than assumed: five requests rejected by validation consumed no quota, after which a
full ten valid submissions still succeeded.

### Limiter 2: AI classification requests (M7-1)

`POST /api/v1/tickets/classify` was authenticated and nothing else until M7-1. It had no length cap
and no rate limit, so any valid token could send arbitrarily large bodies to the paid AI provider
without limit. It is the only endpoint in the system that spends money per call.

**Why no earlier milestone caught it, since the reason is structural.** M5's scope was set by the
specification's wording, "10 ticket submissions per hour", and all of its exit checks are checks on
the create path. M5-5 then settled middleware ordering around the create chain specifically, and
M6-2 correctly argued the limiter must *not* be mounted on the read chain because it counts
submissions. Both decisions are right, and classify is neither a submission nor a read, so it fell
between them. This is the same shape as M0's `/health` exit check passing against an empty database.

Controls now in place, all verified against the running stack:

- **A separate bucket, not the submission one.** The submission limiter's 429 promises a number of
  *tickets* per hour, and M5-5's ordering rests on that promise being true. Counting suggestion
  requests against it would make it false, in the same way M6-2 argued mounting it on reads would.
  Each limiter's 429 names the action it actually counts.
- **100 per hour, via `CLASSIFY_RATE_LIMIT_MAX_PER_HOUR`.** Deliberately an order of magnitude above
  the submission limit: classify is called on a 500ms debounce as the user types, so one drafted
  ticket legitimately produces several requests, and a limit of 10 would break ordinary typing long
  before it stopped abuse. 100 is roughly ten suggestions per permitted ticket and bounds worst-case
  provider spend per user per hour to a known number. Validated at boot like the other limit.
- **The 5000-character cap now applies here too.** `ISSUE_DESCRIPTION_MAX_LENGTH` moved to
  `db/models/ticket.model.ts` and is imported by both validation paths, so the two endpoints cannot
  drift. An over-cap request is rejected in ~32ms against ~690ms for a real classification, which is
  the evidence the provider is never reached rather than the status code alone.
- **Chain order follows M5-5:** `authMiddleware` then `validateClassifyMiddleware` then
  `classifyRateLimitMiddleware` then the controller. Confirmed by observation rather than assumed:
  with the limit set to 5, the 429 landed on the sixth valid call and not the fifth, proving the
  over-cap 400 consumed no quota.
- **Bucket independence was verified directly**: with classify exhausted and returning 429, a ticket
  creation with the same token still returned 201.

**One accepted difference from the create path**, recorded rather than fixed: classify has no
unexpected-field allowlist. Tracing the chain confirms only `issue_description` is ever read, and
nothing else in the body is read, forwarded, logged, persisted or reflected in the response. The
consequence is that a client sending a stray field gets a silent no-op instead of a 400, which is a
consistency difference rather than a security one, and nothing on this path is stored so there is no
row for a stray field to corrupt.

---

## 5. Input handling: SQL injection and XSS

**SQL injection is closed by parameterization**, audited exhaustively rather than sampled. The
backend contains exactly two database queries, both in `backend/src/db/models/ticket.model.ts`, and
there is no string-concatenated or template-interpolated SQL anywhere in `backend/src`.

1. **`insertTicket`** binds `$1` through `$7` in a fixed column list. A payload of
   `'; DROP TABLE tickets; --` was submitted, stored as literal text, and the table was intact
   afterwards.
2. **`findTickets`** (added by M6-1 for the read side) assembles its `WHERE` clause at runtime from
   whichever filters were supplied, which is the shape that normally invites interpolation. **Only
   placeholders are ever assembled into the SQL text; every filter value goes into the parameter
   array.** A filter's presence changes the query, a filter's value never appears in it. Verified by
   calling `findTickets({ product_name: "' OR 1=1 --" })` directly: it returned zero rows and threw
   nothing, which is what proves the value was bound rather than interpolated.

The parameterization claim is therefore unchanged by the read side existing; only the count is. This
paragraph previously said "exactly one database query", written when `insertTicket` was the only one,
and was corrected once M6-1 landed.

**XSS is handled at the render boundary, not by mangling input on the way in.** This is a deliberate
deviation from the specification's parenthetical suggestion of "stripping/escaping HTML in
`issue_description`", and the reasoning is:

- `issue_description` is a bug-report field. It is precisely where users legitimately type markup
  and code. Stripping HTML on input would silently corrupt "the `<div>` overflows on export" and the
  corrupted version is what would be stored permanently.
- Input stripping provides no protection that output encoding does not already provide.
- The only thing that renders the field back to a user is M6-3's admin table, where React escapes by
  default.

Verified: `<script>alert(1)</script> & <img src=x onerror=alert(2)>` was stored and read back
byte-identical, and `grep` finds **zero** *uses* of `dangerouslySetInnerHTML` anywhere in
`frontend-widget`, so nothing bypasses React's default JSX encoding. The only textual match in the
repository is the comment in `admin/TicketsTable.tsx` forbidding it.

**Binding requirement on M6-3, now discharged.** The admin table renders `issue_description` as a
plain JSX expression child (`{ticket.issue_description}`), which React emits as a text node, so
stored markup is displayed rather than parsed. Verified in a browser: a ticket whose description is
`<img src=x onerror=alert(1)>` displays as that literal text, with no alert fired and no `img`
element in the DOM. The constraint is restated in a comment at that cell so it is visible to whoever
edits it next, and it must not be "optimised away": rendering markup there would reopen M5-7's
decision to store bug reports unmangled, not just change one component.

**One input is rejected.** A null byte in `issue_description` returns 400. Postgres `TEXT` cannot
hold `0x00`, so before this it produced a 500 for plainly bad input. The boundary is deliberately
narrow: other C0 control characters were measured storing and reading back without complaint, and
newline and tab are legitimate in a bug report. The rule is "what the database physically cannot
store", not a general suspicion of unusual characters.

Also enforced by `validate.middleware.ts`: a five-field allowlist that rejects unexpected fields, a
5000-character cap on `issue_description`, and enum validation of `category` and `product_name`
against their canonical lists.

---

## 6. Error handling

`backend/src/middleware/errorHandler.middleware.ts` is mounted last in `app.ts`, after every route.
Express 5 forwards rejected promises from async handlers into the error chain automatically, which
is what makes it a real safety net: `createTicketController` is async with no try/catch, so a
database failure reaches it.

**The message policy is deliberately asymmetric.** A 4xx message is returned to the client, because
it was either written by this codebase or describes the caller's own malformed input. A 5xx message
is replaced with a generic `Internal server error`, because it can carry SQL text, driver internals
or absolute file paths. The full error is always logged server-side, so the goal is preventing
leakage to the client rather than losing the record.

Before this was mounted, a malformed JSON body returned an HTML error page from a JSON API. It now
returns `400` with a JSON `{ error }` body, verified against the running server rather than only in
isolation.

**Two structural findings recorded for future maintainers:**

1. **Classify's 502 survives the error handler because it is returned, not thrown.**
   `classify.controller.ts` writes the response directly when the classifier returns null, so that
   path never enters the error chain and is not reshaped into a 500. Verified against a genuinely
   unreachable provider. **If that controller is ever refactored to throw instead of return, this
   behaviour changes silently.** The note exists so that becomes a deliberate re-check.
2. **Unmatched routes still return Express's default HTML 404**, because no error occurs when
   nothing matched, so the error handler is never reached. **This is a format mismatch, not a
   security leak, and is a different class of problem from the malformed-JSON case above.** That one
   leaked internals through the JSON API. Express's default 404 page carries no stack trace, no file
   paths and no server details. It is a consistency wart on a JSON API and should be prioritised as
   such. Fixing it means adding a catch-all 404 handler, which is a code change and belongs in its
   own issue.

---

## 7. Availability and performance

**Classification latency: still not a guarantee, materially better after M8-5, and the history of
this section matters because it has now been wrong in three ways.** It first read "three consecutive
calls at 0.45s, 0.42s and 0.35s" and concluded the requirement was satisfied, which was three samples
of one probe: the single-lucky-sample problem this project has caught before. That was corrected to
NOT MET on a wider measurement during M8-1. M8-5 then fixed the model-side cause, and the first two
sweeps after the fix (97% and 100% inside the budget) briefly had this section claiming the
requirement met at 59 of 60 calls. Five further sweeps in the same afternoon brought that down. The
status below is the pooled distribution, and the discipline is the same one that caught the original
error: sweep until the number stops moving, then report the range and not the best of them.

All figures use calls spaced at least 2.5 seconds apart, so the sample is not measuring the
provider's own burst throttling, across the ten-probe M8-1 regression set, three runs of all ten
probes per sweep, through `POST /api/v1/tickets/classify` because that is the path a user takes.

| # | Config | Inside 800ms | Median | Aborts | Labels correct |
|---|---|---|---|---|---|
| 1 | after | 29/30 (97%) | 438ms | 1, at 0.848s | 29/29 |
| 2 | **before** | 25/30 (83%) | 647ms | 5, at 0.820 to 0.825s | 24/25 |
| 3 | after | 30/30 (100%) | 426ms | none | 30/30 |
| 4 | after | 26/30 (87%) | | 4 | all |
| 5 | after | 20/30 (67%) | 626ms | 10, at 0.811 to 0.829s | 20/20 |
| 6 | **before** | 23/30 (77%) | 555ms | 7 | 22/23 |
| 7 | after | 28/30 (93%) | 564ms | 2 | 28/28 |

**Pooled: 133 of 150 calls (89%) inside the budget after the fix, against 48 of 60 (80%) before.**
Both adjacent before/after pairs, rows 2 to 3 and rows 6 to 7, favour the fix by roughly 16
percentage points, which is the fairest single comparison available because the two sweeps in each
pair ran minutes apart under the same provider conditions. The pooled gap is smaller than either pair
suggests, and row 5 is the reason to be careful: a single post-fix sweep measured 67%, worse than
either pre-fix sweep. **The end-to-end rate is therefore not a property of this code alone, and a
future session that measures one bad sweep should not read it as a regression.**

**What the fix changed, measured on the provider's own reported timings** rather than inferred from
wall clock. In a paired A/B interleaving both configurations call by call on the same probe, 60
calls:

- Server-side work: median **198ms before, 93ms after**.
- Completion tokens: median **118 before, 39 after**.
- Reasoning trace length: **105 to 2124 characters before, 35 to 247 after**.

The cause was model behaviour, as this section previously said: `openai/gpt-oss-20b` is a reasoning
model and spent most of a classification deliberating over a five-way label choice.
`reasoning_effort: "low"` is what removed that.

**The budget can still be missed, and the reason is no longer the model.** With reasoning constrained
the generation work is near-constant, yet wall clock is not: the same probe measured 405ms, 810ms and
2196ms on identical-length traces. What remains is the provider's queueing, median around 205ms, and
network round trip. During M8-5's measurement a request that ran no inference at all, a `404` for an
unavailable model, took **920ms** on one call. No model or prompt setting reaches that, so a residual
tail beyond 800ms is a property of calling a hosted provider over the public internet rather than a
defect to fix. The 800ms `AbortController` is deliberately left at 800ms: the number is the
specification's, and raising a stated NFR is the mentor's decision, not the implementer's.

**A correctness defect was found while measuring this, and fixed in the same commit.** At the
provider's default temperature of 1.0 the criteria table's High probe, "The application throws a 500
error when clicking Export Report", returned `Medium` on 2 of 8 runs. It did so at default reasoning
effort and at low effort alike, so it predates M8-5. M8-1 recorded 20 of 20 correct against this set,
on two runs per probe, which is too small a sample to see a 25% flip rate. `temperature: 0` removes the
sampling variance behind it: that probe is now 8 of 8, with identical trace lengths per probe across
runs.

**Scope of that result, narrowed after a counterexample.** What is measured is stability across
repeated calls **on the ten-probe regression set**: 8 of 8 on this probe, 30 of 30 across the set,
and the 0-wrong-labels figure below. It is not a general determinism guarantee for arbitrary input,
and an earlier wording here ("makes the choice deterministic") read as though it were. The concrete
case, found while seeding demo tickets: an Analytics Hub description about a chart still showing the
previous period's totals after the reporting period is changed returned `High` on one pass through
`POST /api/v1/tickets/classify` and `Medium` roughly twenty minutes later, with the same prompt, the
same model and the same `temperature: 0`, and no code change in between. That input is not in the
regression set. `temperature: 0` fixes the sampling, not the serving: a hosted provider is not
obliged to be reproducible across its own fleet or over time, and inputs sitting near a category
boundary are where the residual spread shows. Read the stability results above as covering the
regression set specifically, and re-measure rather than assume for input outside it.

Across the sweeps in the table above, **the two pre-fix sweeps returned a wrong label on 2 of their 48
completed calls, both of them that same High probe reading `Medium`, and the five post-fix sweeps
returned 0 wrong labels in 133 completed calls.** This is the clearest result in this section, and it
is worth more than the latency work it came from: a latency miss degrades visibly to a manual choice,
whereas a severity that changes between identical calls corrupts the per-product counts the product
exists to produce, silently, in the one table a mentor reads to decide where to send effort.

**Verified on the product surface as well as the endpoint**, because everything above measures the
API and M3's original requirement was about the widget. In a real browser on the Analytics Hub demo
page, typing the High probe into the modal pre-fills the selector with `High` and shows the AI
provenance badge, with the classify call completing in 759ms and 190ms on the two occasions measured.
The same session also observed one `502` at 0.846s, which degraded exactly as specified: no error, no
console output, the control left on its placeholder, and retyping produced the suggestion. That is
the intended behaviour rather than a fault, and it is the reason the residual tail above is a degraded
feature and not a broken one.

**One staleness edge case, found while verifying the above and deliberately not changed.** If a user
types a classifiable report, receives a suggestion, and then edits the text into something the
classifier declines on, the earlier category and its "AI suggested" badge both remain. This follows
directly from M8-1's decision that a decline changes nothing at all, which is what makes a decline
indistinguishable from a failure, and reversing it here would mean a decline clearing a control that a
failure does not. It predates M8-5 and is recorded rather than fixed.

**The widget does not block on AI failure.** `CategorySelector.tsx` catches classification failures
and returns the control to idle without surfacing an error banner or a console error. Since M8-1 it
treats a deliberate "no suggestion" answer the same way, so a timeout, a provider failure and the
classifier declining to guess are all indistinguishable to the user and all leave the control on its
placeholder. The category dropdown remains fully usable manually, and the AI mode toggle removes the
network call entirely. A failed or slow classification therefore degrades to a manual choice rather
than blocking submission.

---

## 8. Page detection, CORS, and the demo pages

**Page detection** maps the first path segment of `window.location.pathname` to one of four
canonical product names, with no per-page code, satisfying the portability requirement. The detected
value is not user-overridable when detection succeeds, because `product_name` records which page the
user was actually on and letting it be edited would corrupt the observability data the product
exists to provide.

**CORS** is an allowlist sourced from `ALLOWED_ORIGINS`, never `*`. The response header is echoed
only for origins the deployment explicitly trusts.

**The demo pages are development-server only, and this is deliberate.** `frontend-widget/demo/` is
served by the `configureServer` plugin in `vite.config.ts`, which runs only under `vite dev`. There
is no multi-page rollup input, and a production build confirms it: `dist/` contains `index.html` and
one JS asset, no demo pages. They exist to prove M4's detection contract, they are not part of any
deployable artifact, and adding build configuration for them would imply otherwise.

**The consequence, stated plainly:** the M4 exit check and M5-2's end-to-end verification are both
development-server checks. There is currently no built, deployable frontend surface that exercises
page detection.

---

## 9. Not met: encryption in transit and at rest

`architecture.md` section 3 requires email and issue text to be encrypted in transit with TLS 1.3
and at rest with AES-256, taken from the original specification's section 6.

**Neither is implemented. Both are currently unmet requirements.**

- **TLS in transit: not implemented.** There is no TLS termination anywhere in this stack. No
  reverse proxy, no certificates, no HTTPS listener, no TLS configuration in `docker-compose.yml`,
  the backend `Dockerfile`, or `backend/src`. The backend serves plain HTTP on port 3000 and the
  widget calls it over plain HTTP. Searching the repository for TLS, SSL, certificate or proxy
  configuration returns nothing.
- **Encryption at rest: not implemented.** The Postgres service is the stock `postgres:16-alpine`
  image writing to an ordinary named Docker volume. There is no volume encryption, no `pgcrypto`,
  no column-level encryption and no managed key service. Data is stored in plaintext on disk.

**Why they are outstanding rather than overlooked.** Both are properties of infrastructure and
deployment rather than application code. TLS is normally terminated at a load balancer, ingress or
reverse proxy in front of the application, and encryption at rest is normally a property of the
database host, such as an encrypted volume or a managed Postgres offering with encryption enabled by
default. Neither is a code change to this repository in any meaningful sense.

**They are unmet because no hosting decision has been made yet.** This project currently runs only
via `docker-compose` on a developer machine. There is no deployment target, so there is nothing to
terminate TLS at and no managed database whose encryption settings could be configured. These
requirements would naturally be addressed at the point real hosting is chosen, and that has not
happened.

What satisfying them would concretely require:

- **TLS:** terminate at a reverse proxy or platform ingress in front of the backend, redirect HTTP
  to HTTPS, and update `ALLOWED_ORIGINS` and the widget's `API_BASE_URL` to the HTTPS origin.
- **At rest:** either a managed Postgres with storage encryption enabled, or an encrypted volume on
  the database host. Column-level encryption of `email` and `issue_description` is a further option
  but would break the ability to query or read those fields directly and is not required by the
  specification's wording.

Until a deployment exists, this section should be read as an open gap, not as a plan that has been
carried out.

---

## 10. Other known gaps

**Observability: not met.** `architecture.md` section 3 adds structured logging and basic metrics
(submission volume by page and category, AI latency, AI failure rate) as an expected non-functional
requirement, on the grounds that reporting on itself is the point of the product. The backend
currently has plain `console.log`, `console.warn` and `console.error` calls and no structured
logging library, no metrics collection and no counters. Nothing aggregates submission volume or AI
failure rate.

**Testability: met.** The AI provider is isolated behind `services/aiClassifier.service.ts`, which
was the structural half of the requirement, and the automated suites that exercise it now exist.

- `backend/tests/aiClassifier.service.test.ts` (M6-4) covers `classifyIssue()` against a stubbed
  `globalThis.fetch`, including every rejection path: a label outside the five, non-JSON content, a
  response with no `choices`, a non-`ok` status, an abort, and an outright rejection. No test reaches
  the network, so the suite passes with no API key.
- `backend/tests/tickets.service.test.ts` (M6-5) covers the identity merge and field defaulting
  against a mocked model layer, with no database running. It regression-locks the property in
  section 2 that a payload carrying `username`/`email` cannot influence what is stored.
- `frontend-widget/tests/` (M6-6) covers the two critical UI flows under Vitest and jsdom, including
  the silent-fallback rule that a failed classification renders no error and logs nothing.
- `.github/workflows/ci.yml` (M6-8) runs both suites plus a strict-mode `tsc` on every push and pull
  request against `master`. The "lint" half is the TypeScript compiler; no ESLint is configured, and
  that substitution is recorded rather than implied.

Every test in all three suites was demonstrated failing against deliberately broken code before it
was accepted, per the standing rule on the M6 batch. This paragraph previously said there were "no
automated tests at all", which was written before M6-4 and is corrected here.

**One gap the suites do not cover**, stated so the section is not read as blanket coverage: nothing
exercises `CategorySelector`'s behaviour when the auth token has not yet arrived. The component's
tests stub `useAuthContext` to always return a token, so the token-null branch of its debounce
callback has never been executed by a test.

**Development credentials are placeholders.** `.env.example` ships `JWT_SECRET=dev-secret-change-me`
and `docker-compose.yml` uses `POSTGRES_USER: user` with `POSTGRES_PASSWORD: password`. These are
adequate for local development and must be replaced before any deployment. The Postgres port is also
published to the host as `5433:5432`, which is convenient locally and should not be exposed in a
deployed environment.

**Secrets are read from a local `.env` file.** There is no secret manager. `.env` is gitignored and
`.env.example` carries only non-secret placeholders, so no credential is committed, but a real
deployment would source `JWT_SECRET` and `AI_PROVIDER_API_KEY` from the platform's secret store
rather than a file on disk.

---

## 11. Summary

Everything the specification asks for at the application layer is implemented and was verified by
request or by browser rather than by inspection: JWT verification with a pinned algorithm, identity
derived only from verified claims and defended twice, per-user rate limiting on both endpoints that
cost something, parameterized queries, output-encoded rendering, and error responses that never leak
internals. Both automated test suites and CI are in place.

The outstanding items are:

- **Infrastructure and deployment concerns**: TLS and encryption at rest (section 9). Both are
  properties of a deployment target that does not exist yet.
- **Project maturity**: structured logging and metrics (section 10).
- **Authorization**: the read endpoint is authenticated but not role-based, so any valid token reads
  every ticket including other users' email and issue text (section 2). This is an accepted
  limitation with recorded reasoning, not an unnoticed gap, but it is the item most likely to matter
  first if this were ever deployed to real users.

None of them is blocked by the application's design.
