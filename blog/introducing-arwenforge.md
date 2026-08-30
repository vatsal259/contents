---
title: "ArwenForge: Profile-Based RBAC for Multi-Agent MCP Servers"
date: 2026-08-30
excerpt: One MCP endpoint, many agents. ArwenForge tags tools, resources, prompts, and delegates with profiles — then enforces least-privilege discovery and fail-closed execution on the JVM.
github: https://github.com/vatsal259/ArwenForge
---

**Architecture note · Agent security · Java 21 · Spring MCP**

**[ArwenForge](https://github.com/vatsal259/ArwenForge)** is a library for enforcing least-privilege access in a shared Model Context Protocol (MCP) server. It maps an authenticated caller to an agent identity, derives that agent’s profiles, filters capability discovery, and rejects unauthorized invocation before application tool code executes.

The important distinction is that ArwenForge does not implement retrieval, embeddings, database access, model calls, or identity management. It protects an MCP capability surface that an application already exposes.

```text
                         Shared Spring MCP server

  reader-bot ────────┐
  writer-bot ────────┼── POST /mcp ── ArwenForge ── application MCP tools
  orchestrator-bot ──┘                    │
                                         policy:
                                  identity + roles + profiles
```

This article explains the design, runtime behavior, configuration model, and operating limits. For exhaustive diagrams and class-level detail, see the [technical design](https://github.com/vatsal259/ArwenForge/blob/main/design/DESIGN.md).

---

## Why a shared MCP endpoint needs server-side policy

An MCP client normally asks a server for its catalog with `tools/list`, then invokes an entry with `tools/call`. In a multi-agent deployment, the same endpoint may serve several distinct agents:

```text
POST /mcp

search-bot      should search internal knowledge
support-bot     should read and update support tickets
ops-bot         may run administrative operations
```

An unfiltered catalog produces three separate problems:

1. **Capability exposure.** Every agent receives names, descriptions, and schemas for tools it should never use.
2. **Context cost.** A large catalog consumes model context even when most of it is irrelevant.
3. **Execution escalation.** Hiding a name in `tools/list` is insufficient. A prompt, log, or another agent can reveal a hidden name. The server must also deny direct calls.

ArwenForge applies same policy twice:

```text
tools/list                       tools/call
----------                       ----------
Remove tools caller cannot use   Validate named tool before dispatch
                                 Reject denied call before tool code runs
```

This is not prompt guidance. A system prompt can ask a model to avoid an action, but it cannot enforce that request. ArwenForge runs in server process and makes decision before MCP handler executes.

---

## Core model: identity, role, profile, capability

The four terms have distinct jobs.

| Term | Purpose | Example |
|---|---|---|
| **Identity agent** | Authenticated caller represented in policy | `research-bot` |
| **Role** | Reusable bundle of profile grants | `research-role` |
| **Profile** | Named capability category used by access resolver | `reader`, `research` |
| **Capability** | Something exposed over MCP | tool, resource, prompt, or delegate |

The relationship is:

```text
credential -> identity agent -> roles -> profiles -> capability match
                                    \-> direct profiles (optional)
```

Consider a knowledge-base server with two MCP tools:

```yaml
# rbac.yaml
profiles:
  reader:
    description: Search knowledge base
    riskLevel: 1
  writer:
    description: Index documents
    riskLevel: 2

roles:
  reader-role:
    profiles: [reader]
  writer-role:
    profiles: [reader, writer]

agents:
  reader-bot:
    roles: [reader-role]
  writer-bot:
    roles: [writer-role]
```

```yaml
# tools.yaml
tools:
  search_knowledge:
    profiles: [reader]
    risk: read
  ingest_document:
    profiles: [writer]
    risk: write
```

`reader-bot` receives effective profile set `{reader}`. `writer-bot` receives `{reader, writer}`. The resolver permits a capability when its profile set intersects caller’s effective profile set:

```text
reader-bot: {reader}

search_knowledge: {reader}     intersection = {reader}  -> allow
ingest_document: {writer}      intersection = empty     -> deny
```

This is profile-based RBAC. Roles are convenience bundles. Profiles are authorization labels. Capabilities are protected objects.

### Effective profile calculation

For a normal request, ArwenForge combines all available grants:

```text
effectiveProfiles =
    JWT token profiles
  union profiles granted by JWT token roles
  union profiles granted by rbac.yaml agent roles
  union direct profiles on rbac.yaml agent
```

For a child delegation session, this union is replaced by a fixed `profileOverride`. That prevents parent roles or JWT claims from widening a deliberately narrowed child.

### Risk is not authorization

Two fields look similar but are intentionally separate:

| Field | Meaning | Used to permit access? |
|---|---|---:|
| `profiles: [writer]` on a tool | Who may use capability | Yes |
| `risk: write` on a tool | Governance classification and blast-radius weight | No |
| `riskLevel: 2` on a profile | Governance hint on category | No |

If a destructive operation is tagged with profile `reader`, a reader can invoke it even when its risk says `destructive`. Correct profile assignment is the authorization boundary; risk supports review, reporting, and policy discussion.

---

## Request path and enforcement points

`arwen-forge-spring` registers `ArwenForgeServletFilter` for `/mcp` and `/mcp/*`. It sits before Spring AI’s MCP transport.

```text
HTTP POST /mcp with JSON-RPC body
              |
              v
    ArwenForgeServletFilter
              |
              +-- parse request and enforce size limit
              +-- resolve API-key or JWT principal
              +-- resolve child session, if header exists
              +-- apply per-agent rate limit, if enabled
              |
              +-- list method: run upstream and rewrite returned catalog
              +-- call/read/get: authorize before upstream dispatch
              +-- delegation: create child session internally
              |
              v
      Spring AI MCP transport
              |
              v
   application @McpTool / resource / prompt
```

The same `AccessResolver` is used for discovery and invocation. That avoids two policies drifting apart.

| MCP method | ArwenForge action |
|---|---|
| `tools/list` | Run upstream list into a cached response, retain only allowed tools, add synthetic `delegateAgent` when delegation is permitted |
| `tools/call` | Read `params.name`, authorize it, then dispatch only if allowed |
| `resources/list` | Retain only allowed resources |
| `resources/read` | Authorize target URI before dispatch |
| `prompts/list` | Retain only allowed prompts |
| `prompts/get` | Authorize prompt name before dispatch |
| `arwen/delegates/list` | Return permitted delegates directly from ArwenForge |
| `tools/call` for `delegateAgent` | Spawn child session directly; no upstream tool executes |

MCP methods that ArwenForge does not explicitly handle pass through. It is a capability policy layer, not a complete JSON-RPC firewall.

---

## Discovery is filtered; execution fails closed

Suppose `reader-bot` is authenticated with `reader-key`.

```http
POST /mcp
Authorization: Bearer reader-key
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

Underlying server may register both tools. Filtered result contains only search:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "search_knowledge",
        "_meta": {
          "io.modelcontextprotocol.profiles": ["reader"],
          "io.modelcontextprotocol.risk": "read"
        }
      }
    ]
  }
}
```

Now assume caller already knows hidden name:

```http
POST /mcp
Authorization: Bearer reader-key
Content-Type: application/json

{"jsonrpc":"2.0","id":2,"method":"tools/call",
 "params":{"name":"ingest_document","arguments":{"title":"x","content":"y"}}}
```

The call is rejected before `ingest_document` runs:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

ArwenForge uses same `-32601` response for an unavailable capability and a nonexistent capability. It intentionally does not return “writer profile required,” because that leaks policy information to callers probing a catalog.

### Deny globs

Profiles create an allow set. Deny patterns can subtract from it:

```yaml
roles:
  support-role:
    profiles: [reader, support]
    deny: ["delete_*", "export_*"]
```

Deny globs are checked after capability lookup and before profile overlap. A matching deny wins even when a profile would otherwise allow the tool.

### Unknown principals

`unknown-principal-policy` controls a valid authenticated identity that has no agent definition and no token grants:

| Setting | Behavior |
|---|---|
| `DENY` (default) | No capability access |
| `READER_ONLY` | Treat caller as holding only `reader` profile |

For most deployments, use `DENY` and define every credential-to-agent mapping explicitly.

---

## Safe delegation by profile intersection

Delegation is a common escalation path: an agent can call a specialist that has more access than parent. ArwenForge uses three constraints to prevent this.

```text
Parent effective profiles:       {research, support}
support-agent declared profiles: {support}

Child profiles:
{research, support} intersection {support} = {support}
```

The child session never receives parent’s `research` authority.

```text
main-agent
  effective: {research, support}
  allowedDelegates: [research-agent, support-agent]
        |
        | delegateAgent("support-agent")
        v
child session
  effective: {support}
  agentId: main-agent
  source: SESSION
        |
        +-- support tools: allowed
        +-- research tools: denied
        +-- delegateAgent: denied
```

Spawn sequence:

1. Client sends `tools/call` for synthetic `delegateAgent`.
2. `DelegationGuard` checks delegate capability with same access resolver.
3. Policy requires profile overlap and, when non-empty, membership in parent’s `allowedDelegates`.
4. Child principal gets `parent effective profiles ∩ delegate profiles`.
5. `SessionManager` creates session id.
6. Later requests send `X-Arwen-Session-Id` plus same parent credential.
7. Resolver requires session `agentId` to equal authenticated parent `agentId`.

Child sessions cannot re-delegate. Their source is `SESSION`, and delegates are denied for that source. This keeps runtime delegation at one hop, matching blast-radius calculation.

Two session implementations exist:

| Mode | Use case | Behavior |
|---|---|---|
| In-memory (default) | Local development or single process | UUID session; TTL defaults to one hour |
| Signed | Multi-node deployment | HMAC-SHA256 token; signing key must be at least 32 UTF-8 bytes |

Signed session tokens are stateless and cannot be server-revoked before expiry. In-memory sessions can be invalidated but do not survive or coordinate across nodes.

---

## Identity: API keys and JWT

ArwenForge supports two authentication sources.

### API keys

API keys are useful for development and service-to-service integrations. Configuration stores BCrypt hash and associated agent id, never plaintext key:

```yaml
arwen-forge:
  auth:
    api-keys-enabled: true
    api-keys:
      - key-hash: "$2a$10$..."
        agent-id: research-bot
```

API key arrives as `X-Api-Key` or a non-JWT-shaped Bearer value. It maps to `agentId`; grants then come from the agent entry in `rbac.yaml`.

### JWT

Spring Security validates JWT before ArwenForge turns it into a principal. Mapped claims:

| Claim | ArwenForge use |
|---|---|
| `sub` | Required agent id |
| `roles` | Token role grants |
| `profiles` | Direct token profile grants |
| `client_id` / `clientId` | Audit correlation |
| `jti` | Audit correlation and signed-session binding |

JWT roles and profiles are unioned with YAML grants. This is a deliberate operator contract: an identity provider that issues an overly broad `profiles` claim can widen access without a YAML change. Validate issuer/audience upstream and restrict which clients can mint those claims.

---

## Configuration lifecycle

At startup, auto-configuration builds a `ProfileRegistry`:

```text
rbac.yaml
tools.yaml / resources.yaml / prompts.yaml / delegatable-agents.yaml
annotations: @ArwenForgeProfile, @ArwenForgeRisk
                      |
                      v
                merge tool metadata
                      |
                      v
             validate registry rules
                      |
                      v
   ProfileRegistryHolder used by AccessResolver
```

YAML overrides annotations when both define same property. This lets developers put a safe default next to code while operations owns deployment policy.

Recommended baseline:

```yaml
arwen-forge:
  enabled: true
  config-location: classpath:arwen-forge/
  unknown-principal-policy: deny
  require-profile-on-all-tools: true
  fail-on-validation-errors: true
  max-request-bytes: 1048576
```

Validation detects unknown profiles/roles/delegates, invalid deny patterns, and capabilities without a profile when that baseline is enabled. Validation always runs; `fail-on-validation-errors` decides whether error-level findings abort startup or reload.

---

## Operations: audit, approval, limits, and reload

Profile RBAC, list filtering, call guards, in-memory sessions, SLF4J audit, and CLI reports work without enterprise flags. Additional production controls are opt-in:

```yaml
arwen-forge:
  enterprise:
    enabled: true
    sessions:
      mode: signed
      signing-key: ${ARWEN_SESSION_KEY}
      ttl: PT1H
    approval:
      enabled: true
      grant-ttl: PT15M
      approver-role: approver
    rate-limit:
      enabled: true
      requests-per-minute: 120
    audit:
      json-enabled: true
      json-path: /var/log/arwen/audit.jsonl
    metrics:
      enabled: true
    config-reload:
      enabled: true
```

Every optional feature requires both `enterprise.enabled: true` and its own feature flag.

| Feature | Runtime behavior |
|---|---|
| Approval | Capability with `requiresApproval: true` returns `-32004`; approved grant permits retry until TTL expires |
| Rate limit | Sliding 60-second window per agent; exhausted budget returns `-32005` / HTTP 429 |
| JSON audit | Writes structured JSONL alongside normal SLF4J audit |
| Metrics | Micrometer counters for allowed/denied capability calls |
| Config reload | `POST /arwen-forge/admin/reload` atomically replaces profile registry; configured admin role required |
| Signed sessions | HMAC-protected child session token suitable for multiple server nodes |

Approval requires human action:

```text
agent calls approval-required capability
  -> -32004 and approval id
  -> authorized approver POSTs /arwen-forge/approvals/{id}/approve
  -> agent retries within grant TTL
  -> tool reaches application code
```

Approval-required capabilities are excluded from lists by default. Enable `include-in-list` only where clients must discover them in order to request approval.

---

## Blast radius: offline policy review

Runtime access answers “may this request run?” Blast radius answers “what is impact if this identity is compromised?”

`arwen-forge-cli` uses the same access resolver to calculate reachable tools, resources, prompts, and one-hop delegation surface. Default capability weights:

```text
read:         1
write:        5
destructive: 15
```

Optional `backend: production` and `irreversible: true` metadata multiply score. Output score is normalized from 0 to 100 against full catalog.

```bash
java -jar arwen-forge-cli-1.0.0.jar validate --config ./config
java -jar arwen-forge-cli-1.0.0.jar plan --config ./config
java -jar arwen-forge-cli-1.0.0.jar blast-radius \
  --config ./config \
  --format html \
  --output blast-radius.html \
  --fail-above 60
```

`validate` catches configuration errors. `plan` estimates visible-tool token cost alongside risk. `blast-radius` produces reviewable table, JSON, or HTML report. These are governance tools; they do not replace call-time authorization.

---

## Error behavior

| Case | JSON-RPC code | HTTP status |
|---|---:|---:|
| Malformed JSON | `-32700` | 400 |
| Invalid request or invalid parameters | `-32600` / `-32602` | 400 |
| Request body exceeds limit | `-32600` | 413 |
| Missing/invalid identity or invalid child session binding | `-32001` | 401 |
| Capability missing or not permitted | `-32601` | 404 |
| Approval required | `-32004` | 202 |
| Rate limited | `-32005` | 429 |

`-32601` intentionally covers both absence and denial. Approval is an exception: `-32004` reveals that policy requires approval because client needs approval id to progress.

---

## Where ArwenForge fits, and where it does not

Use ArwenForge when:

- Spring Boot / Spring AI MCP server serves more than one agent identity.
- Capability discovery must be least privilege, not an unfiltered model prompt.
- Direct invocation must be denied even when name is known.
- Delegation must be explicit and non-escalating.
- Policy must be reviewable as YAML and validated in CI.

It is not intended to be:

- A standalone MCP gateway or multi-server federation layer.
- A full user/tenant/IAM system.
- A replacement for secure downstream APIs or input validation.
- A defense against all prompt injection. It limits which tools a manipulated model can reach; it does not make model output safe.
- A non-JVM or Quarkus adapter in version 1.0.

Compatibility target is Java 21+, Spring Boot 3.4.x, Spring AI MCP 1.0.x, and servlet `/mcp` JSON-RPC transport. API-key-only deployments do not require a JWT decoder.

---

## Key takeaways

1. **Profiles are the runtime authorization unit.** Roles only package profile grants; risk does not permit access.
2. **Discovery and execution share one policy.** Tools a caller cannot use disappear from lists and remain blocked on direct calls.
3. **Delegation narrows access.** Child profiles are parent/delegate intersection and child sessions cannot delegate again.
4. **Identity is external.** API keys and validated JWTs provide identity; ArwenForge maps identity to policy.
5. **Policy can be operated.** YAML validates at startup, audits decisions, supports optional approval/rate-limit/reload controls, and yields CI blast-radius reports.

[GitHub](https://github.com/vatsal259/ArwenForge) · [Getting started](https://github.com/vatsal259/ArwenForge/blob/main/docs/getting-started.md) · [Technical design](https://github.com/vatsal259/ArwenForge/blob/main/design/DESIGN.md)
