---
title: "It's Lucene All the Way Down"
date: 2026-08-06
excerpt: A proper Elasticsearch course - teach Lucene guts, search, analytics, lifecycle, vectors, and ops with worked examples and official elastic.co docs links on every topic. Not a flashcard deck.
---

> Peel the "search platform" label and you hit Lucene - segments, refresh, translog, shards. Elasticsearch is the distributed system wrapped around it. It's Lucene all the way down.

This is a **course**, not a questionnaire. Each module teaches a topic with explanation, diagrams where useful, worked requests, and the official docs link so you can go deeper. Run the examples against a local cluster or an [Elastic Cloud trial](https://www.elastic.co/docs/get-started/evaluate-elastic).

**What you will be able to do by the end**

- Explain how a write becomes searchable and durable
- Design mappings and queries that do not melt the cluster
- Operate lifecycle, snapshots, security, and incident response
- Use the full capability surface (DSL, ES|QL, vectors, ILM, …) with the right docs page open

**Hubs:** [Elasticsearch reference](https://www.elastic.co/docs/reference/elasticsearch) · [All docs](https://www.elastic.co/docs/) · [REST APIs](https://www.elastic.co/docs/api/doc/elasticsearch/) · [Resiliency status](https://www.elastic.co/guide/en/elasticsearch/resiliency/current/index.html) · [Glossary](https://www.elastic.co/docs/reference/glossary)

## How to take this course

1. Work **Part I** in order - internals unlock everything else.
2. Treat **Part II** as the syllabus map: skim a chapter, then open the linked docs when you implement that feature.
3. Do **Part III** hands-on - type the requests, do not only read them.
4. Use **Parts IV–V** as labs and ops curriculum after the fundamentals stick.
5. Use **Part VI** for highlighting, autocomplete, collapse, OCC, aliases, and semantic/ELSER.
6. Keep the [resiliency page](https://www.elastic.co/guide/en/elasticsearch/resiliency/current/index.html) bookmarked for production failure modes.

## Curriculum map


| Part                         | Modules | Focus                                                                        |
| ---------------------------- | ------- | ---------------------------------------------------------------------------- |
| **I - Internals**            | L0–L12  | Lucene, write/read path, cluster state, memory, caches - taught as lessons   |
| **II - Capability syllabus** | C0–C20  | Taught lessons per capability + reference catalogs                           |
| **III - Hands-on path**      | A0–A15  | Labs + catalog / logs / hybrid projects                                      |
| **IV - Advanced labs & ops** | D0–D16  | Index modes, runbooks, relevance, percolator, security, failure modes        |
| **V - Production depth**     | E0–E13  | ILM/SLM, enrich/transforms, PIT/async, retrievers, maintenance, coverage map |
| **VI - Specialty labs**      | S1–S6   | Highlight, suggest, collapse, OCC, filtered aliases, ELSER/semantic          |


---

# PART I - INTERNALS

> **Learning goal:** build a mental model accurate enough that GC logs, `_cat/shards`, circuit-breaker errors, and "document not found in search yet" stop being mysteries. Each lesson explains a subsystem, then points at the official docs.

---

## L0 · Stack layers (what sits on what)

**Learning objective:** name every layer from client to disk and know which docs hub owns it.

Elasticsearch is easier when you stop treating it as one blob. A request crosses clear layers:

```
Client / Kibana / Agent / Logstash
        │
   Coordinating node (REST → transport)
        │
   Primary / replica shard copies
        │
   Lucene Index (segments + commit point)
        │
   Filesystem cache ↔ Disk
   + Translog (durability for uncommitted ops)
```


| Layer   | Owns                                    | Docs                                                                                                                                                                                                                                 |
| ------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cluster | Membership, master, cluster state       | [Distributed architecture](https://www.elastic.co/docs/deploy-manage/distributed-architecture)                                                                                                                                       |
| Node    | Roles, thread pools, breakers           | [Node roles](https://www.elastic.co/docs/deploy-manage/distributed-architecture/clusters-nodes-shards/node-roles) · [Thread pools](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/thread-pool-settings) |
| Index   | Settings + mappings + aliases           | [Index fundamentals](https://www.elastic.co/docs/manage-data/data-store/index-basics)                                                                                                                                                |
| Shard   | Unit of distribution = one Lucene index | [Clusters, nodes, shards](https://www.elastic.co/docs/deploy-manage/distributed-architecture/clusters-nodes-shards)                                                                                                                  |
| Segment | Immutable inverted-index slice          | [Near real-time search](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search) · [Merge](https://www.elastic.co/docs/reference/elasticsearch/index-settings/merge)                                                |


**Key identity:** An Elasticsearch **shard** is a Lucene **index**. A Lucene index is a set of **segments** plus a **commit point**.

---

## L1 · Lucene data structures (the real store)

**Learning objective:** know which on-disk structure serves full-text, filters/aggs, retrieval, ranges, and vectors - so you stop asking Lucene for the wrong job.

### Inverted index

For analyzed `text`/`keyword` (postings): term → list of docs (+ positions/offsets/payloads depending on `index_options`).

### Doc values

Column-oriented on-disk structures for sorting, aggregations, scripting. Prefer these over fielddata.

**Docs:** [Doc values](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/doc-values)

### Stored fields / `_source`

`_source` is the original JSON (unless disabled / synthetic). Stored fields are optional explicit stores.

**Docs:** [_source](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/mapping-source-field) · [Source index settings](https://www.elastic.co/docs/reference/elasticsearch/index-settings/source)

### Norms

Length/boost factors for BM25 on `text`. Disable when you never score that field.

### Points / BKD trees

Numeric, date, geo, IP range structures for efficient range/geo filters.

### Fielddata (avoid on text)

In-heap structure built from inverted index for `text` - memory bomb. Use `keyword` + doc values.

**Docs:** [fielddata on text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/text#fielddata-mapping-param) · [Field data cache settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/field-data-cache-settings)

### Dense vectors

HNSW graphs / quantized layouts for ANN - not classic inverted index.

**Docs:** [dense_vector](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dense-vector)

### Mental model table


| Need                          | Structure                          |
| ----------------------------- | ---------------------------------- |
| Full-text "contains word"     | Inverted index / postings          |
| Exact term filter + aggs/sort | Doc values (+ inverted for filter) |
| Return original JSON          | `_source`                          |
| Score BM25                    | Postings + norms                   |
| Numeric/date/geo range        | Points (BKD)                       |
| kNN                           | Vector index (HNSW/BBQ/…)          |


---

## L2 · Refresh vs flush vs fsync vs merge (do not confuse these)

**Learning objective:** predict whether a change is searchable, durable, or merely awaiting merge - and choose `refresh` / translog settings deliberately.

This is the single highest-ROI internals lesson.


| Operation             | What it does                                       | Searchable? | Durable?                         | Cost                       |
| --------------------- | -------------------------------------------------- | ----------- | -------------------------------- | -------------------------- |
| **Index into buffer** | Write to in-memory buffer (+ translog)             | No          | Depends on translog sync         | Cheap                      |
| **Refresh**           | Buffer → new **segment** opened in FS cache        | **Yes**     | Not a Lucene commit              | Light, frequent            |
| **Flush**             | Lucene **commit** + new translog generation        | Already was | **Yes** in Lucene                | Expensive                  |
| **Translog fsync**    | Persist translog to disk                           | N/A         | Makes ack'd writes survive crash | Controlled by `durability` |
| **Merge**             | Immutable small segments → larger; reclaim deletes | Yes         | Yes                              | Background, IO heavy       |


**Docs:** [Near real-time search](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search) · [Translog](https://www.elastic.co/docs/reference/elasticsearch/index-settings/translog) · [Flush API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-flush) · [Refresh API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-refresh) · [Refresh parameter](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/refresh-parameter) · [Merge settings](https://www.elastic.co/docs/reference/elasticsearch/index-settings/merge)

### Refresh details

- Default interval ~~`1s` on Stack (often `5s` on Serverless), and only for indices searched recently (~~30s).
- `refresh=true` forces immediate refresh of affected shards - creates tiny segments; pay at index, search, and merge time.
- `refresh=wait_for` waits for the next refresh without forcing one.

### Translog durability

- `index.translog.durability: request` (default) - fsync per request → ack'd writes survive power loss (disk permitting)
- `async` - fsync on interval → higher throughput, window of data loss on crash

### Why merges matter

Deletes are soft until merge. Too many tiny segments → slow search. Merge storm → indexing throttle. Force-merge is a deliberate ops tool, not a daily habit.

**Docs:** [Force merge API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-forcemerge)

---

## L3 · Write path internals (primary-backup / PacificA)

**Learning objective:** walk a single index request from coordinating node to ack, including failure and demotion cases.

**Docs:** [Reading and writing documents](https://www.elastic.co/docs/deploy-manage/distributed-architecture/reading-and-writing-documents)

### Stages

1. **Coordinating stage** - resolve routing → forward to primary
2. **Primary stage** - validate → index locally → replicate to **in-sync copies** in parallel
3. **Replica stage** - each in-sync replica indexes locally → ack primary
4. Primary acks client only after in-sync set succeeds (or after master removes failed copies)

### Routing

Default: `hash(_routing or _id) % num_primary_shards`. Custom routing can colocate related docs (and create hotspots).

### In-sync copies invariant

Ack'd operations exist on every copy in the in-sync set. Failed replicas are removed from the set via master before ack.

### Failure modes you must know

- **Stale primary** after partition: replicas reject; primary learns it was demoted
- **Read unacknowledged**: concurrent search can see a write before client got ack
- **Single-copy danger**: if only primary remains, HW failure can lose data - mitigate with `wait_for_active_shards`
- Slow replica slows the whole replication group

### Primary terms

Used to fence stale primaries after failover - part of why sequence numbers / checkpoints exist for recovery and CCR.

**Also read:** [Resiliency](https://www.elastic.co/guide/en/elasticsearch/resiliency/current/index.html)

---

## L4 · Read / search path internals

**Learning objective:** describe fan-out, adaptive replica selection, partial results, and when to use filter vs query context.

**Docs:** [Reading and writing documents - read model](https://www.elastic.co/docs/deploy-manage/distributed-architecture/reading-and-writing-documents#basic-read) · [Search shard routing](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-shard-routing)

### Flow

1. Coordinating node resolves indices → shards
2. Picks one copy per shard group (**adaptive replica selection** by default)
3. Sends shard-level search requests
4. Reduces hits/aggs → responds
5. On shard failure, retries another copy; search/msearch/mget may return **partial results** with `200` and `_shards.failures`

### Query phases (classic search)

- **Query then fetch** (default): find top docs per shard → fetch `_source` for global top-N
- **DFS query then fetch**: pre-collect distributed term stats for more accurate IDF (costlier)
- **Can match / rewrite**: query rewrite, expensive-query gates

### Profile API

Use when a query is mysteriously slow - see Lucene collector timing per shard.

**Docs:** [Profile API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-search) (profile param) · [Search Profile](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-profile)

---

## L5 · Cluster state, discovery, master

**Learning objective:** explain what lives in cluster state and why mapping explosions and unstable masters hurt the whole cluster.

**Docs:** [Discovery and cluster formation](https://www.elastic.co/docs/deploy-manage/distributed-architecture/discovery-cluster-formation) · [Discovery settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/discovery-cluster-formation-settings)

### What cluster state contains

Index metadata (mappings/settings), routing table (where shards live), nodes, templates, ingest pipelines, ILM policies, scripts, etc. Published by elected master.

### Implications

- Mapping updates / template changes are cluster-state ops - chatty dynamic mapping hurts
- Large cluster state → slower publications; limit fields, prefer composable templates
- Master-eligible nodes should be stable and not overloaded with data/search (dedicated masters at scale)

### Allocation & recovery

**Docs:** [Shard allocation, relocation, recovery](https://www.elastic.co/docs/deploy-manage/distributed-architecture/shard-allocation-relocation-recovery) · [Allocation awareness](https://www.elastic.co/docs/deploy-manage/distributed-architecture/shard-allocation-relocation-recovery/shard-allocation-awareness) · [Cluster allocation explain](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-cluster-allocation-explain) · [Cluster-level allocation settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/cluster-level-shard-allocation-routing-settings)

Watermarks: low / high / flood-stage - flood-stage makes indices read-only.

---

## L6 · Memory model: heap vs page cache vs breakers

**Learning objective:** size heap vs page cache correctly and recognize which circuit breaker fired.

### Rule of thumb

- JVM heap: objects, aggregations, fielddata, request structures, cluster state
- Filesystem cache (OS page cache): Lucene segments - **this is your search performance**
- Do not give Elasticsearch 100% of RAM; leave room for page cache

**Docs:** [Indexing buffer](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/indexing-buffer-settings) · [Circuit breakers](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/circuit-breaker-settings) · [Circuit breaker errors](https://www.elastic.co/docs/troubleshoot/elasticsearch/circuit-breaker-errors) · [Preload FS cache](https://www.elastic.co/docs/reference/elasticsearch/index-settings/preloading-data-into-file-system-cache)

### Circuit breakers (know them by name)


| Breaker              | Guards                                   |
| -------------------- | ---------------------------------------- |
| `parent`             | Overall estimated heap usage             |
| `request`            | Per-request data structures (aggs, etc.) |
| `fielddata`          | Fielddata cache                          |
| `in_flight_requests` | Network request buffers                  |
| model / ESQL-related | ML / shared request pathways             |


When tripped → `circuit_breaking_exception`, not silent OOM (usually).

```bash
GET _nodes/stats/breaker
GET _cat/circuit_breaker?v
```

### Indexing pressure

Limits outstanding indexing bytes to protect nodes under write load.

**Docs:** [Indexing pressure](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/indexing-pressure-settings)

---

## L7 · Thread pools (why rejections happen)

**Learning objective:** map symptoms (search reject, bulk 429, merge lag) to the right pool and fix strategy.

**Docs:** [Thread pool settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/thread-pool-settings) · [CAT thread pool](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-cat-thread-pool) · [Nodes stats](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-nodes-stats)

Important pools: `search`, `search_throttled`, `write`/`index`, `get`, `analyze`, `snapshot`, `force_merge`/`merge`, `management`, `refresh`, `flush`, `generic`.


| Symptom                                     | Likely pool                 |
| ------------------------------------------- | --------------------------- |
| `es_rejected_execution_exception` on search | `search` queue full         |
| Bulk rejections / 429                       | `write` / indexing pressure |
| Slow merges blocking indexing               | merge throttle              |


```bash
GET _cat/thread_pool/search,write,merge?v&h=node_name,name,active,queue,rejected,completed
```

---

## L8 · Caches (four different things)

**Learning objective:** name the four caches and know which one your workload can actually use.


| Cache               | What                                                        | Docs                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shard request cache | Full shard-level search/agg response for identical requests | [Shard request cache](https://www.elastic.co/docs/deploy-manage/distributed-architecture/shard-request-cache) · [settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/shard-request-cache-settings) |
| Node query cache    | Filter bitsets                                              | [Node query cache](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/node-query-cache-settings)                                                                                                            |
| Fielddata cache     | Heap structures for text fielddata                          | [Field data cache](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/field-data-cache-settings)                                                                                                            |
| Page cache          | OS caches Lucene files                                      | OS / sizing guidance                                                                                                                                                                                                                 |


Filters are cache-friendly; scoring query clauses are not the same thing.

---

## L9 · Scoring internals (BM25)

**Learning objective:** explain BM25 inputs and when boosts/function_score are appropriate vs filter context.

Score ≈ IDF(term) × TF saturation × length norm (field norms) × boosts.

- Same term in a short field scores higher than in a long field
- `keyword` filters don't need BM25 - use filter context
- Distributed IDF differs slightly per shard unless DFS

**Docs:** [How full-text works](https://www.elastic.co/docs/solutions/search/full-text/how-full-text-works) · [Ranking](https://www.elastic.co/docs/solutions/search/ranking) · [Similarity settings](https://www.elastic.co/docs/reference/elasticsearch/index-settings/similarity) · [BM25 blog](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables) · [Explain API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-explain)

---

## L10 · Mapping internals that blow up clusters

**Learning objective:** design schemas that avoid mapping explosion and pick nested vs object deliberately.

- Dynamic mapping can create thousands of fields → mapping explosion → huge cluster state + heap
- Mapping updates are mostly additive; changing a field type requires reindex
- Multi-fields index the same input multiple ways (`text` + `.keyword`)
- `nested` = hidden Lucene docs per nested object - query cost ≠ flat object
- `copy_to` creates combined fields at index time
- Runtime fields compute at search time - CPU for flexibility

**Docs:** [Mapping](https://www.elastic.co/docs/manage-data/data-store/mapping) · [Mapping limits](https://www.elastic.co/docs/reference/elasticsearch/index-settings/mapping-limit) · [Dynamic mapping](https://www.elastic.co/docs/manage-data/data-store/mapping/dynamic-mapping) · [Runtime fields](https://www.elastic.co/docs/manage-data/data-store/mapping/runtime-fields) · [nested](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/nested)

---

## L11 · Shard sizing & topology internals

**Learning objective:** choose primary/replica counts and understand soft deletes / retention leases at a high level.

**Docs:** [Size your shards](https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance/size-shards) · [Production guidance](https://www.elastic.co/docs/deploy-manage/production-guidance)

Practical internals:

- Primary shard count is fixed at create (unless split/shrink)
- Oversharding → cluster state + heap + merge overhead
- Undersharding → poor parallelism / huge shards / slow recovery
- Soft deletes + retention leases enable peer recovery / CCR
- Index sort can accelerate some range/time queries and force-merge patterns

**Docs:** [Index sorting](https://www.elastic.co/docs/reference/elasticsearch/index-settings/sorting) · [History retention](https://www.elastic.co/docs/reference/elasticsearch/index-settings/history-retention)

---

## L12 · Lesson checkpoint - the mental model you must keep

Before you leave Part I, lock these distinctions. They are the difference between tuning and superstition.

### Durability vs searchability vs housekeeping

A successful index response means the primary (and in-sync replicas) accepted the operation. It does **not** mean every search will see it yet. **Refresh** opens a new Lucene segment for search. **Flush / translog sync** is about surviving crashes. **Merge** rewrites immutable segments and reclaims deletes. Confusing these three is the root of half of all "Elasticsearch is broken" threads.

**Docs:** [Near real-time search](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search) · [Translog](https://www.elastic.co/docs/reference/elasticsearch/index-settings/translog) · [Merge](https://www.elastic.co/docs/reference/elasticsearch/index-settings/merge)

### How a write actually finishes

Routing picks a primary shard → coordinating node forwards → primary validates and indexes locally → primary replicates to the **in-sync copies** set → only then does the client get an ack (unless copies are removed via master on failure). Concurrent searches can already see the change on the primary before the client is acknowledged. That is normal in the primary-backup model, not a bug.

**Docs:** [Reading and writing documents](https://www.elastic.co/docs/deploy-manage/distributed-architecture/reading-and-writing-documents)

### How a search actually finishes

The coordinating node fans the request to one copy of each relevant shard (adaptive replica selection), merges hits and aggregations, and returns. Partial shard failures can still yield HTTP **200** - always inspect `_shards`. Prefer **filter context** for exact constraints and **query context** only when you need `_score`.

**Docs:** [Search shard routing](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-shard-routing) · [Query and filter context](https://www.elastic.co/docs/explore-analyze/query-filter/languages/querydsl#query-filter-context)

### Memory: two wallets

**JVM heap** pays for objects, aggregations, fielddata, request structures, and cluster state. **OS page cache** pays for Lucene segments - and that is what usually makes search fast. Starving page cache to enlarge heap is a classic self-own. Circuit breakers estimate memory and trip early; they do not make out-of-memory impossible.

**Docs:** [Circuit breakers](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/circuit-breaker-settings)

### Structures decide what queries can do


| Goal                         | Prefer                                                    |
| ---------------------------- | --------------------------------------------------------- |
| Full-text relevance          | analyzed `text` + BM25 in query context                   |
| Exact filter / agg / sort    | `keyword` (or numeric/date) + doc values + filter context |
| Return original JSON         | `_source` (or synthetic `_source` where enabled)          |
| Ranges on numbers/dates/geo  | points / BKD-backed types                                 |
| Approximate nearest neighbor | `dense_vector` / `semantic_text`, not the inverted index  |


Never enable fielddata on `text` to "make aggs work." Add a `.keyword` multi-field instead.

### Schema and shards

Dynamic mapping is wonderful in demos and dangerous in production - unbounded fields inflate **cluster state** on every master-eligible node. Primary shard count is sticky; replicas are easy. Soft deletes + retention leases make peer recovery and CCR possible. Oversharding burns heap and cluster-state budget; undersharding creates hotspots and painful recoveries.

### What to practice next

Re-read L2 and L3 once more, then move to Part II and Part III. When something fails in production, come back to this checkpoint before changing random settings.

---

# PART II - CAPABILITY SYLLABUS

> Each chapter is a **lesson**: purpose, when to use it, a worked example, then official docs. Aggregation catalogs (C6) and the API group checklist (C20) stay as reference tables.

---

## C0 · Product surface overview

**Learning objective:** open the right Elastic docs hub for engine work vs solutions vs deploy.

Elastic docs are split by job:


| You need…                           | Open                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Engine APIs, mappings, settings     | [Elasticsearch reference](https://www.elastic.co/docs/reference/elasticsearch) |
| Search / RAG product patterns       | [Search solution](https://www.elastic.co/docs/solutions/search)                |
| Indices, ingest, lifecycle          | [Manage data](https://www.elastic.co/docs/manage-data)                         |
| Query languages, aggs, ML, alerting | [Explore & analyze](https://www.elastic.co/docs/explore-analyze)               |
| Install, security, upgrades, HA     | [Deploy & manage](https://www.elastic.co/docs/deploy-manage)                   |
| Exact REST request shapes           | [API docs](https://www.elastic.co/docs/api/doc/elasticsearch/)                 |
| Language clients                    | [Clients](https://www.elastic.co/docs/reference/elasticsearch-clients)         |


Implement from API docs; learn *why* from manage-data / explore-analyze; operate from deploy-manage.

---

## C1 · Document & index APIs

**Learning objective:** create indices safely, write with bulk, and evolve schemas with aliases and templates.

Documents are JSON objects. An index holds documents plus settings and mappings. Use **templates** for rolling indices and **aliases** for zero-downtime reindex of content indices.

### Teach the write path of an API call

- Prefer **bulk** for ingest; single-doc APIs for rare updates
- Prefer `**refresh=wait_for**` only when the caller must read immediately
- Prefer **reindex + alias swap** over mutating field types in place

**Docs:** [create](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-create) · [bulk](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-bulk) · [reindex](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-reindex) · [update aliases](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-update-aliases) · [templates](https://www.elastic.co/docs/manage-data/data-store/templates) · [data streams](https://www.elastic.co/docs/manage-data/data-store/data-streams) · [Index settings](https://www.elastic.co/docs/reference/elasticsearch/index-settings) · [indices.create](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-create)

### Worked example

```json
PUT /catalog-v1
{
  "settings": { "number_of_shards": 1, "number_of_replicas": 1 },
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "sku": { "type": "keyword" },
      "price": { "type": "scaled_float", "scaling_factor": 100 }
    }
  }
}

POST /_bulk?refresh=wait_for
{ "index": { "_index": "catalog-v1", "_id": "1" } }
{ "name": "Trail Shoe", "sku": "TRS-1", "price": 129.99 }

POST /_aliases
{ "actions": [ { "add": { "index": "catalog-v1", "alias": "catalog", "is_write_index": true } } ] }
```

Also know: get/mget, update / update-by-query, delete / delete-by-query, rollover, shrink/split/clone, refresh/flush/forcemerge, analyze, put mapping/settings. See the Indices and Document API groups in C20.

---

## C2 · Field types

**Learning objective:** choose types from access patterns (search / filter / agg / sort / vector / geo), not from raw JSON shape.

**Docs:** [Field data types](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/field-data-types)


| Access pattern                | Start with                                               |
| ----------------------------- | -------------------------------------------------------- |
| Full-text relevance           | `text` (+ `.keyword` multi-field if you also filter/agg) |
| Exact match / aggs / sort     | `keyword`, numbers, `date`                               |
| Independent objects in arrays | `nested`                                                 |
| Arbitrary key bags            | `flattened`                                              |
| Typeahead                     | `completion` or `search_as_you_type`                     |
| Semantic / RAG                | `semantic_text` (or explicit vectors)                    |
| Geo                           | `geo_point` / `geo_shape`                                |


### Families (keep this checklist)

- **Common:** `binary`, `boolean`, keyword family, numeric family, `date` / `date_nanos`, `alias`
- **Objects / relations:** `object`, `flattened`, `nested`, `join`, `passthrough`
- **Structured:** `range`, `ip`, `version`, `murmur3` ([plugin](https://www.elastic.co/docs/reference/elasticsearch/plugins/mapper-murmur3))
- **Aggregate:** `aggregate_metric_double`, `histogram`, `exponential_histogram`, `tdigest` ([t-digest](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/t-digest))
- **Text search:** `text` / `match_only_text` / `pattern_text`, `annotated-text` ([plugin](https://www.elastic.co/docs/reference/elasticsearch/plugins/mapper-annotated-text)), `completion`, `search_as_you_type`, `semantic_text`, `token_count`
- **Ranking / vectors:** `dense_vector`, `sparse_vector`, `rank_feature`, `rank_features`
- **Spatial:** `geo_point`, `geo_shape`, `point`, `shape`
- **Other:** `percolator`, arrays, [multi-fields](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/multi-fields)

```json
PUT /articles
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword", "ignore_above": 256 },
          "english": { "type": "text", "analyzer": "english" }
        }
      }
    }
  }
}
```

---

## C3 · Text analysis

**Learning objective:** make index-time and search-time analysis agree, and verify with `_analyze`.

Analysis pipeline: character filters → tokenizer → token filters. Most "search is broken" bugs are analyzer mismatches.

**Docs:** [Text analysis](https://www.elastic.co/docs/manage-data/data-store/text-analysis) · [Anatomy](https://www.elastic.co/docs/manage-data/data-store/text-analysis/anatomy-of-an-analyzer) · [Analyzers](https://www.elastic.co/docs/reference/text-analysis/analyzer-reference) · [Tokenizers](https://www.elastic.co/docs/reference/text-analysis/tokenizer-reference) · [Token filters](https://www.elastic.co/docs/reference/text-analysis/token-filter-reference) · [Custom analyzer](https://www.elastic.co/docs/manage-data/data-store/text-analysis/create-custom-analyzer) · [Synonyms](https://www.elastic.co/docs/reference/text-analysis/analysis-synonym-tokenfilter) · [Specify an analyzer](https://www.elastic.co/docs/manage-data/data-store/text-analysis/specify-an-analyzer)

```json
POST _analyze
{
  "analyzer": "standard",
  "text": "Quick BROWN foxes"
}
```

Ship language analyzers when stemming matters. Keep synonym sets curated - huge maps can trip circuit breakers at build time.

---

## C4 · Query DSL

**Learning objective:** compose leaf + compound clauses; score in query context; constrain in filter context.

**Docs:** [Query DSL](https://www.elastic.co/docs/explore-analyze/query-filter/languages/querydsl)


| Family             | For                              | Docs                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full-text          | BM25 on analyzed fields          | [full-text](https://www.elastic.co/docs/reference/query-languages/query-dsl/full-text-queries)                                                                                                                                                                     |
| Term-level         | exact / range / exists / prefix… | [term-level](https://www.elastic.co/docs/reference/query-languages/query-dsl/term-level-queries)                                                                                                                                                                   |
| Compound           | bool, dis_max, function_score…   | [compound](https://www.elastic.co/docs/reference/query-languages/query-dsl/compound-queries)                                                                                                                                                                       |
| Joining            | nested / parent-child            | [joining](https://www.elastic.co/docs/reference/query-languages/query-dsl/joining-queries)                                                                                                                                                                         |
| Geo / shape / span | space & positions                | [geo](https://www.elastic.co/docs/reference/query-languages/query-dsl/geo-queries) · [shape](https://www.elastic.co/docs/reference/query-languages/query-dsl/shape-queries) · [span](https://www.elastic.co/docs/reference/query-languages/query-dsl/span-queries) |
| Specialized        | script_score, percolate, knn…    | [specialized](https://www.elastic.co/docs/reference/query-languages/query-dsl/specialized-queries)                                                                                                                                                                 |


```json
GET catalog/_search
{
  "query": {
    "bool": {
      "must": [{ "match": { "name": "trail shoe" } }],
      "filter": [
        { "term": { "sku": "TRS-1" } },
        { "range": { "price": { "lte": 200 } } }
      ]
    }
  }
}
```

Core leaves to practice: `match`, `multi_match`, `match_phrase`, `term`, `terms`, `range`, `exists`, `bool`, `function_score`, `nested`, `knn`, `semantic` (via search/retrievers).

---

## C5 · Search API extras

**Learning objective:** treat `_search` as a product API - highlight, suggest, collapse, paginate, explain, retrievers.

**Docs:** [Search](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-search) · [Highlighting](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/highlighting) · [Suggesters](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-suggesters) · [Collapse](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/collapse-search-results) · [Paginate](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/paginate-search-results) · [Retrievers](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers) · [Async search](https://www.elastic.co/docs/solutions/search/async-search-api) · [Explain](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-explain)


| Need                    | Use                                          |
| ----------------------- | -------------------------------------------- |
| Snippets in UI          | `highlight`                                  |
| Typeahead               | completion / search_as_you_type / suggesters |
| One hit per group       | `collapse` (+ `inner_hits`)                  |
| Deep pages              | PIT + `search_after`                         |
| Long aggs               | async search                                 |
| Hybrid / rules / rerank | retrievers                                   |
| Debug scoring           | explain + profile                            |


Part VI labs deepen highlight/suggest/collapse. Part IV D2 covers relevance engineering (templates, rank eval, RRF).

---

## C6 · Aggregations (complete catalogs)

**Learning objective:** choose metric vs bucket vs pipeline aggregations, nest them, and keep cardinality under control.

Aggregations summarize the hit set (often with `"size": 0`). **Metrics** compute numbers; **buckets** group documents; **pipelines** compute on other aggregation outputs. Aggregate on doc-values-friendly fields (`keyword` / numeric / date). Watch `search.max_buckets` and the request circuit breaker. Use `composite` to page enormous bucket sets.

```json
GET orders/_search
{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": { "field": "category.keyword", "size": 20 },
      "aggs": { "revenue": { "sum": { "field": "price" } } }
    }
  }
}
```

**Docs:** [Aggregations](https://www.elastic.co/docs/explore-analyze/query-filter/aggregations) · [Metrics](https://www.elastic.co/docs/reference/aggregations/metrics) · [Bucket](https://www.elastic.co/docs/reference/aggregations/bucket) · [Pipeline](https://www.elastic.co/docs/reference/aggregations/pipeline)

### Reference catalogs

**Docs:** [Aggregations](https://www.elastic.co/docs/explore-analyze/query-filter/aggregations) · [Metrics](https://www.elastic.co/docs/reference/aggregations/metrics) · [Bucket](https://www.elastic.co/docs/reference/aggregations/bucket) · [Pipeline](https://www.elastic.co/docs/reference/aggregations/pipeline)

### Metric aggregations


| Aggregation                 | Docs                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `avg`                       | [avg](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-avg-aggregation)                                             |
| `boxplot`                   | [boxplot](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-boxplot-aggregation)                                     |
| `cardinality`               | [cardinality](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-cardinality-aggregation)                             |
| `extended_stats`            | [extended_stats](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-extendedstats-aggregation)                        |
| `geo_bounds`                | [geo_bounds](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-geobounds-aggregation)                                |
| `geo_centroid`              | [geo_centroid](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-geocentroid-aggregation)                            |
| `geo_line`                  | [geo_line](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-geo-line)                                               |
| `cartesian_bounds`          | [cartesian_bounds](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-cartesian-bounds-aggregation)                   |
| `cartesian_centroid`        | [cartesian_centroid](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-cartesian-centroid-aggregation)               |
| `matrix_stats`              | [matrix_stats](https://www.elastic.co/docs/reference/aggregations/search-aggregations-matrix-stats-aggregation)                                   |
| `max`                       | [max](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-max-aggregation)                                             |
| `median_absolute_deviation` | [median_absolute_deviation](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-median-absolute-deviation-aggregation) |
| `min`                       | [min](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-min-aggregation)                                             |
| `percentile_ranks`          | [percentile_ranks](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-percentile-rank-aggregation)                    |
| `percentiles`               | [percentiles](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-percentile-aggregation)                              |
| `rate`                      | [rate](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-rate-aggregation)                                           |
| `scripted_metric`           | [scripted_metric](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-scripted-metric-aggregation)                     |
| `stats`                     | [stats](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-stats-aggregation)                                         |
| `string_stats`              | [string_stats](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-string-stats-aggregation)                           |
| `sum`                       | [sum](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-sum-aggregation)                                             |
| `t_test`                    | [t_test](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-ttest-aggregation)                                        |
| `top_hits`                  | [top_hits](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-top-hits-aggregation)                                   |
| `top_metrics`               | [top_metrics](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-top-metrics)                                         |
| `value_count`               | [value_count](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-valuecount-aggregation)                              |
| `weighted_avg`              | [weighted_avg](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-weight-avg-aggregation)                             |


### Bucket aggregations


| Aggregation                | Docs                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `adjacency_matrix`         | [adjacency_matrix](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-adjacency-matrix-aggregation)               |
| `auto_date_histogram`      | [auto_date_histogram](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-autodatehistogram-aggregation)           |
| `categorize_text`          | [categorize_text](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-categorize-text-aggregation)                 |
| `children`                 | [children](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-children-aggregation)                               |
| `composite`                | [composite](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-composite-aggregation)                             |
| `date_histogram`           | [date_histogram](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-datehistogram-aggregation)                    |
| `date_range`               | [date_range](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-daterange-aggregation)                            |
| `diversified_sampler`      | [diversified_sampler](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-diversified-sampler-aggregation)         |
| `filter`                   | [filter](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-filter-aggregation)                                   |
| `filters`                  | [filters](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-filters-aggregation)                                 |
| `frequent_item_sets`       | [frequent_item_sets](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-frequent-item-sets-aggregation)           |
| `geo_distance`             | [geo_distance](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-geodistance-aggregation)                        |
| `geohash_grid`             | [geohash_grid](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-geohashgrid-aggregation)                        |
| `geohex_grid`              | [geohex_grid](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-geohexgrid-aggregation)                          |
| `geotile_grid`             | [geotile_grid](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-geotilegrid-aggregation)                        |
| `global`                   | [global](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-global-aggregation)                                   |
| `histogram`                | [histogram](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-histogram-aggregation)                             |
| `ip_prefix`                | [ip_prefix](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-ipprefix-aggregation)                              |
| `ip_range`                 | [ip_range](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-iprange-aggregation)                                |
| `missing`                  | [missing](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-missing-aggregation)                                 |
| `multi_terms`              | [multi_terms](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-multi-terms-aggregation)                         |
| `nested`                   | [nested](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-nested-aggregation)                                   |
| `parent`                   | [parent](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-parent-aggregation)                                   |
| `random_sampler`           | [random_sampler](https://www.elastic.co/docs/reference/aggregations/search-aggregations-random-sampler-aggregation)                          |
| `range`                    | [range](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-range-aggregation)                                     |
| `rare_terms`               | [rare_terms](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-rare-terms-aggregation)                           |
| `reverse_nested`           | [reverse_nested](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-reverse-nested-aggregation)                   |
| `sampler`                  | [sampler](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-sampler-aggregation)                                 |
| `significant_terms`        | [significant_terms](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-significantterms-aggregation)              |
| `significant_text`         | [significant_text](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-significanttext-aggregation)                |
| `terms`                    | [terms](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-terms-aggregation)                                     |
| `time_series`              | [time_series](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-time-series-aggregation)                         |
| `variable_width_histogram` | [variable_width_histogram](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-variablewidthhistogram-aggregation) |


### Pipeline aggregations


| Aggregation              | Docs                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `avg_bucket`             | [avg_bucket](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-avg-bucket-aggregation)                         |
| `bucket_script`          | [bucket_script](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-bucket-script-aggregation)                   |
| `bucket_count_ks_test`   | [bucket_count_ks_test](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-count-ks-test-aggregation)              |
| `bucket_correlation`     | [bucket_correlation](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-correlation-aggregation)                  |
| `bucket_selector`        | [bucket_selector](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-bucket-selector-aggregation)               |
| `bucket_sort`            | [bucket_sort](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-bucket-sort-aggregation)                       |
| `change_point`           | [change_point](https://www.elastic.co/docs/reference/aggregations/search-aggregations-change-point-aggregation)                              |
| `cumulative_cardinality` | [cumulative_cardinality](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-cumulative-cardinality-aggregation) |
| `cumulative_sum`         | [cumulative_sum](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-cumulative-sum-aggregation)                 |
| `derivative`             | [derivative](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-derivative-aggregation)                         |
| `extended_stats_bucket`  | [extended_stats_bucket](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-extended-stats-bucket-aggregation)   |
| `inference`              | [inference](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-inference-bucket-aggregation)                    |
| `max_bucket`             | [max_bucket](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-max-bucket-aggregation)                         |
| `min_bucket`             | [min_bucket](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-min-bucket-aggregation)                         |
| `moving_fn / moving_avg` | [moving_fn / moving_avg](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-movfn-aggregation)                  |
| `moving_percentiles`     | [moving_percentiles](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-moving-percentiles-aggregation)         |
| `normalize`              | [normalize](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-normalize-aggregation)                           |
| `percentiles_bucket`     | [percentiles_bucket](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-percentiles-bucket-aggregation)         |
| `serial_diff`            | [serial_diff](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-serialdiff-aggregation)                        |
| `stats_bucket`           | [stats_bucket](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-stats-bucket-aggregation)                     |
| `sum_bucket`             | [sum_bucket](https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-sum-bucket-aggregation)                         |


---

## C7 · Query languages beyond Query DSL

**Learning objective:** choose Query DSL vs ES|QL vs SQL vs EQL for the job.

Query DSL wins for relevance control. ES|QL wins for piped analytics. SQL wins for BI familiarity. EQL wins for event sequences.


| Language          | Docs                                                                                                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ES|QL             | [ES|QL](https://www.elastic.co/docs/reference/query-languages/esql) · [REST](https://www.elastic.co/docs/reference/query-languages/esql/esql-rest) · [Kibana](https://www.elastic.co/docs/explore-analyze/query-filter/languages/esql-kibana) |
| SQL               | [SQL](https://www.elastic.co/docs/explore-analyze/query-filter/languages/sql)                                                                                                                                                                 |
| EQL               | [EQL](https://www.elastic.co/docs/explore-analyze/query-filter/languages/eql)                                                                                                                                                                 |
| Querying overview | [query-filter](https://www.elastic.co/docs/explore-analyze/query-filter)                                                                                                                                                                      |


---

## C8 · Vector, semantic, inference, RAG

**Learning objective:** retrieve by meaning (and hybridize with lexical search) without inventing a second database.

Prefer `semantic_text` first; bring your own `dense_vector` when the embedding model lives outside Elasticsearch. Always combine with metadata filters; fuse ranks with RRF before hand-tuned score scripts.


| Capability               | Docs                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dense vector search      | [dense vector](https://www.elastic.co/docs/solutions/search/vector/dense-vector)                                                                                                                                                                                   |
| kNN                      | [knn](https://www.elastic.co/docs/solutions/search/vector/knn)                                                                                                                                                                                                     |
| `dense_vector` mapping   | [mapping](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dense-vector)                                                                                                                                                                      |
| `sparse_vector`          | [sparse_vector](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/sparse-vector)                                                                                                                                                               |
| `semantic_text`          | [semantic_text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text)                                                                                                                                                               |
| Semantic search          | [semantic search](https://www.elastic.co/docs/solutions/search/semantic-search)                                                                                                                                                                                    |
| RAG                      | [RAG](https://www.elastic.co/docs/solutions/search/rag)                                                                                                                                                                                                            |
| Elastic Inference        | [inference](https://www.elastic.co/docs/explore-analyze/elastic-inference)                                                                                                                                                                                         |
| Inference API / settings | [inference settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/inference-settings)                                                                                                                                               |
| Machine learning         | [ML](https://www.elastic.co/docs/explore-analyze/machine-learning) · [ML reference](https://www.elastic.co/docs/reference/machine-learning) · [ML settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/machine-learning-settings) |
| Search Labs              | [search-labs](https://www.elastic.co/search-labs)                                                                                                                                                                                                                  |


---

## C9 · Ingest, enrich, transforms, connectors

**Learning objective:** normalize at ingest, join reference data with enrich, and materialize entity-centric indices with transforms.

Do parsing once in a pipeline (grok/dissect/date/convert). Use enrich for stable lookups. Use transforms when dashboards keep recomputing the same pivot.


| Capability       | Docs                                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingest overview  | [ingest](https://www.elastic.co/docs/manage-data/ingest)                                                                                                                                                   |
| Ingest pipelines | [pipelines](https://www.elastic.co/docs/manage-data/ingest/transform-enrich/ingest-pipelines)                                                                                                              |
| Enrich           | [enrich](https://www.elastic.co/docs/manage-data/ingest/transform-enrich/data-enrichment) · [enrich settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/enrich-settings) |
| Transforms       | [transforms](https://www.elastic.co/docs/explore-analyze/transforms) · [settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/transforms-settings)                         |
| Connectors       | [connectors](https://www.elastic.co/docs/reference/search-connectors) · [API](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-connector)                                                  |
| Open Crawler     | [crawler](https://www.elastic.co/search-labs/blog/elastic-open-crawler-release)                                                                                                                            |
| Ingestion tools  | [reference](https://www.elastic.co/docs/reference/ingestion-tools)                                                                                                                                         |
| ECS              | [ECS](https://www.elastic.co/docs/reference/ecs)                                                                                                                                                           |


---

## C10 · Data streams, TSDB, logsdb, lifecycle

**Learning objective:** pick the storage shape first (index vs stream vs TSDS vs logsdb), then attach lifecycle.

Mutable content → index + aliases. Append-only logs/events → data stream (logsdb when appropriate). Metrics → TSDS. Then ILM/DLM for retention and tiers.


| Capability                      | Docs                                                                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data streams                    | [data streams](https://www.elastic.co/docs/manage-data/data-store/data-streams)                                                                                                                                       |
| Time series data streams (TSDB) | [TSDB](https://www.elastic.co/docs/manage-data/data-store/data-streams/time-series-data-stream-tsds)                                                                                                                  |
| Logs data stream                | [logs data stream](https://www.elastic.co/docs/manage-data/data-store/data-streams/logs-data-stream)                                                                                                                  |
| Lifecycle overview              | [lifecycle](https://www.elastic.co/docs/manage-data/lifecycle)                                                                                                                                                        |
| ILM                             | [ILM](https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management) · [ILM settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/index-lifecycle-management-settings) |
| Data stream lifecycle           | [DLM](https://www.elastic.co/docs/manage-data/lifecycle/data-stream) · [DLM settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/data-stream-lifecycle-settings)                     |
| Data tiers                      | [tiers](https://www.elastic.co/docs/manage-data/lifecycle/data-tiers)                                                                                                                                                 |
| Downsampling                    | via [lifecycle](https://www.elastic.co/docs/manage-data/lifecycle)                                                                                                                                                    |
| Searchable snapshots            | [searchable snapshots](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/searchable-snapshots)                                                                                                     |
| Curator                         | [curator](https://www.elastic.co/docs/manage-data/lifecycle/curator)                                                                                                                                                  |
| Migrate data                    | [migrate](https://www.elastic.co/docs/manage-data/migrate)                                                                                                                                                            |


---

## C11 · Snapshot, CCR, CCS, remote clusters

**Learning objective:** separate backup (snapshots/SLM), local HA (replicas), and multi-cluster (CCS/CCR).

Replicas are not backups. Snapshots you never restore are wishes. Cross-cluster features need remote-cluster security (API key model).


| Capability         | Docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot & restore | [snapshot](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| SLM                | within snapshot docs / API                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Repo types         | [fs](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/fs-repository-settings) · [s3](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/s3-repository-settings) · [gcs](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/gcs-repository-settings) · [azure](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/azure-repository-settings) · [url](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/url-repository-settings) · [source-only](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/source-repository-settings) |
| CCR                | [CCR](https://www.elastic.co/docs/deploy-manage/tools/cross-cluster-replication) · [APIs](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-ccr) · [settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/cross-cluster-replication-settings)                                                                                                                                                                                                                                                                                                                                                                                           |
| CCS                | [cross-cluster search](https://www.elastic.co/docs/explore-analyze/cross-cluster-search)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Remote clusters    | [remote clusters](https://www.elastic.co/docs/deploy-manage/remote-clusters) · [settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/remote-clusters)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| HA tools           | [tools](https://www.elastic.co/docs/deploy-manage/tools)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |


---

## C12 · Security capability

**Learning objective:** ship TLS + least-privilege roles; give apps API keys; use DLS/FLS when tenants share data.

Never embed the superuser in an application. Test restricted roles as the restricted user.


| Capability           | Docs                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Security overview    | [security](https://www.elastic.co/docs/deploy-manage/security)                                                     |
| Users & roles / RBAC | [users-roles](https://www.elastic.co/docs/deploy-manage/users-roles)                                               |
| API keys             | [api-keys](https://www.elastic.co/docs/deploy-manage/api-keys)                                                     |
| Spaces               | [spaces](https://www.elastic.co/docs/deploy-manage/manage-spaces)                                                  |
| Security settings    | [security settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/security-settings) |
| Auditing             | [auditing settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/auding-settings)   |
| IP filtering         | [IP filtering](https://www.elastic.co/docs/deploy-manage/security/ip-filtering-cloud)                              |
| Private connectivity | [private connectivity](https://www.elastic.co/docs/deploy-manage/security/private-connectivity)                    |
| Secure settings      | [secure settings](https://www.elastic.co/docs/deploy-manage/security/secure-settings)                              |
| DLS / FLS            | within users-roles docs                                                                                            |


---

## C13 · Cluster, nodes, CAT, monitoring

**Learning objective:** diagnose with read-only APIs before changing settings.

Order: cluster health → cat shards → allocation explain → nodes stats (breaker/jvm/fs) → thread pools → hot threads.


| Capability                | Docs                                                                                                                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cluster APIs              | [cluster](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-cluster)                                                                                                                                                                                               |
| Health report             | [health_report](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-health_report)                                                                                                                                                                                   |
| CAT APIs                  | [cat](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-cat)                                                                                                                                                                                                       |
| Nodes stats / hot threads | [nodes stats](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-nodes-stats)                                                                                                                                                                                  |
| Stack monitoring          | [monitoring](https://www.elastic.co/docs/deploy-manage/monitor) · [stack monitoring](https://www.elastic.co/docs/deploy-manage/monitor/stack-monitoring) · [monitoring settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/monitoring-settings) |
| Autoscaling               | [autoscaling](https://www.elastic.co/docs/deploy-manage/autoscaling)                                                                                                                                                                                                              |
| Health diagnostics        | [health diagnostic settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/health-diagnostic-settings)                                                                                                                                              |
| Troubleshoot              | [troubleshoot ES](https://www.elastic.co/docs/troubleshoot/elasticsearch)                                                                                                                                                                                                         |


---

## C14 · Configuration reference (node/cluster knobs)

**Learning objective:** change one documented setting family at a time; know static vs dynamic.

Priority families: breakers, thread pools, discovery, networking, indexing pressure, disk watermarks, search settings.

**Docs:** [Configuration reference](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference) · [Stack settings](https://www.elastic.co/docs/deploy-manage/stack-settings) · [Settings (guide)](https://www.elastic.co/guide/en/elasticsearch/reference/current/settings.html)

Critical families: circuit breakers · thread pools · networking · discovery · indexing buffer · indexing pressure · search settings · node settings · path · local gateway · license · miscellaneous cluster · index recovery · index management · watcher · ML · transforms · inference · enrich · ILM · DLM · remote clusters · repositories · caches.

---

## C15 · Scripting & Painless

**Learning objective:** use scripts only when mappings/pipelines cannot express the need; pick the correct context.

Prefer ingest fixes and runtime-field experiments over hot-path `script` queries.


| Capability                                                                              | Docs                                                                                    |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Scripting overview                                                                      | [scripting](https://www.elastic.co/docs/explore-analyze/scripting)                      |
| Painless                                                                                | [Painless](https://www.elastic.co/docs/reference/scripting-languages/painless/painless) |
| script query / script_score / update scripts / runtime fields / ingest script processor | linked from scripting + Query DSL specialized                                           |


---

## C16 · Geospatial

**Learning objective:** map points/shapes correctly, then query distance/bounding box/relations.

Mind lon/lat order and `geo_point` vs `geo_shape`. Geo aggregations are listed under C6.

**Docs:** [Geospatial analysis](https://www.elastic.co/docs/explore-analyze/geospatial-analysis) · [geo queries](https://www.elastic.co/docs/reference/query-languages/query-dsl/geo-queries) · geo_* field types · geo aggregations in C6

---

## C17 · Alerting & Watcher

**Learning objective:** pick one alerting owner per condition - usually Kibana Alerting; Watcher for cluster-side scheduled pipelines.

Test actions (email/webhook/index) the same way you test snapshot restores.


| Capability        | Docs                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Alerting          | [alerting](https://www.elastic.co/docs/explore-analyze/alerting)                                                                |
| Watcher settings  | [watcher settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/watcher-settings)                |
| Cases / Workflows | [cases](https://www.elastic.co/docs/explore-analyze/cases) · [workflows](https://www.elastic.co/docs/explore-analyze/workflows) |


---

## C18 · Plugins & extend

**Learning objective:** install plugins consistently across nodes and prefer first-party features when they exist.

Plugin versions must match the Elasticsearch version on every node.


| Capability                | Docs                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugins reference         | [plugins](https://www.elastic.co/docs/reference/elasticsearch/plugins)                                                                         |
| Plugin development        | [guide](https://www.elastic.co/guide/en/elasticsearch/plugins/current/index.html) · [extend](https://www.elastic.co/docs/extend/elasticsearch) |
| Analysis / mapper plugins | e.g. annotated-text, murmur3                                                                                                                   |


---

## C19 · Deploy flavors

**Learning objective:** match ops ownership to Serverless, Cloud Hosted, self-managed, or ECK/ECE.

Serverless hides shards/nodes; self-managed exposes bootstrap checks and JVM sizing. Do not copy runbooks across flavors blindly.


| Flavor                  | Docs                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Deployment options      | [deployment options](https://www.elastic.co/docs/get-started/deployment-options)                  |
| Self-managed install    | [install](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/installing-elasticsearch) |
| Elastic Cloud           | under [deploy](https://www.elastic.co/docs/deploy-manage/deploy)                                  |
| ECK / ECE               | deploy + security orchestrator docs                                                               |
| Reference architectures | [reference architectures](https://www.elastic.co/docs/deploy-manage/reference-architectures)      |
| Upgrade                 | [upgrade](https://www.elastic.co/docs/deploy-manage/upgrade)                                      |
| Optimize performance    | [optimize](https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance)    |


---

## C20 · API endpoint groups (complete checklist)

**Learning objective:** know which API group owns a task so you can find the operation quickly.

Every group below is a capability family. Open it, skim operations, then implement from the operation page.

Every REST API group below is a capability family. Open each and skim operations.


| Group                | Docs                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document             | [endpoint-document](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-document)                                                                                    |
| Indices              | [endpoint-indices](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-indices)                                                                                      |
| Search               | [endpoint-search](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-search)                                                                                        |
| ES|QL                | [endpoint-esql](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-esql)                                                                                            |
| SQL                  | [endpoint-sql](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-sql)                                                                                              |
| EQL                  | [endpoint-eql](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-eql)                                                                                              |
| Cluster              | [endpoint-cluster](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-cluster)                                                                                      |
| CAT                  | [endpoint-cat](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-cat)                                                                                              |
| Tasks                | [endpoint-tasks](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-tasks)                                                                                          |
| Health report        | [endpoint-health_report](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-health_report)                                                                          |
| Ingest               | [endpoint-ingest](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-ingest)                                                                                        |
| Enrich               | [endpoint-enrich](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-enrich)                                                                                        |
| ILM                  | [endpoint-ilm](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-ilm)                                                                                              |
| SLM                  | [endpoint-slm](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-slm)                                                                                              |
| Snapshot             | [endpoint-snapshot](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-snapshot)                                                                                    |
| Searchable snapshots | [endpoint-searchable_snapshots](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-searchable_snapshots)                                                            |
| CCR                  | [endpoint-ccr](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-ccr)                                                                                              |
| Security             | [endpoint-security](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-security)                                                                                    |
| License              | [endpoint-license](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-license)                                                                                      |
| Script               | [endpoint-script](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-script)                                                                                        |
| ML                   | [endpoint-ml](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-ml)                                                                                                |
| Transform            | [endpoint-transform](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-transform)                                                                                  |
| Rollup (legacy)      | [endpoint-rollup](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-rollup)                                                                                        |
| Watcher              | [endpoint-watcher](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-watcher)                                                                                      |
| Inference            | [endpoint-inference](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-inference)                                                                                  |
| Connector            | [endpoint-connector](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-connector)                                                                                  |
| Synonyms             | [endpoint-synonyms](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-synonyms)                                                                                    |
| Query rules          | [endpoint-query_rules](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-query_rules)                                                                              |
| Search application   | [endpoint-search_application](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-search_application)                                                                |
| Behavioral analytics | [endpoint-analytics](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-analytics)                                                                                  |
| Graph                | [endpoint-graph](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-graph)                                                                                          |
| Fleet                | [endpoint-fleet](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-fleet)                                                                                          |
| Logstash             | [endpoint-logstash](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-logstash)                                                                                    |
| Text structure       | [endpoint-text_structure](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-text_structure)                                                                        |
| Features             | [endpoint-features](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-features)                                                                                    |
| Migration            | [endpoint-migration](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-migration)                                                                                  |
| Info / X-Pack        | [endpoint-info](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-info) · [endpoint-xpack](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-xpack) |
| Data                 | [endpoint-data](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-data)                                                                                            |


---

# PART III - HANDS-ON PATH

> Lab sessions. Type every request. Internals from Part I should change *how* you configure everything below.

---

## A0 · First cluster & conventions

**Docs:** [Get started](https://www.elastic.co/docs/get-started) · [API conventions](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/api-conventions) · [Compatibility](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/compatibility)

```bash
GET /
GET _cluster/health
GET _cat/nodes?v
GET _cat/shards?v
GET _nodes/stats/breaker,thread_pool,jvm,fs?pretty
```

---

## A1 · Index design that respects internals

```json
PUT /products
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1,
    "refresh_interval": "1s"
  },
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "name": {
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } }
      },
      "sku": { "type": "keyword" },
      "price": { "type": "scaled_float", "scaling_factor": 100 },
      "created_at": { "type": "date" }
    }
  }
}
```

Why `dynamic: strict`? Mapping explosions are cluster-state / heap problems (L10).

---

## A2 · CRUD with refresh/durability awareness

```json
POST /products/_doc/1?refresh=wait_for
{ "name": "Trail Shoe", "sku": "TRS-1", "price": 129.99, "created_at": "2026-08-06" }

GET /products/_doc/1

POST /_bulk?refresh=wait_for
{ "index": { "_index": "products", "_id": "2" } }
{ "name": "Road Shoe", "sku": "RDS-1", "price": 99.5, "created_at": "2026-08-06" }
```

Prefer bulk. Avoid `refresh=true` in hot ingest paths (L2).

---

## A3 · Query + filter context (correct by default)

```json
GET /products/_search
{
  "query": {
    "bool": {
      "must":   [ { "match": { "name": "trail shoe" } } ],
      "filter": [
        { "term":  { "sku": "TRS-1" } },
        { "range": { "price": { "lte": 200 } } }
      ]
    }
  }
}
```

**Docs:** [Query DSL](https://www.elastic.co/docs/explore-analyze/query-filter/languages/querydsl)

---

## A4 · Aggregations that won't explode heap

```json
GET /products/_search
{
  "size": 0,
  "aggs": {
    "by_sku": {
      "terms": { "field": "sku", "size": 50 },
      "aggs": { "avg_price": { "avg": { "field": "price" } } }
    }
  }
}
```

Never agg on analyzed `text` without multi-field keyword. Watch `search.max_buckets` and request breaker (L6).

---

## A5 · Analysis debugging

```json
POST /products/_analyze
{
  "field": "name",
  "text": "Trail Running Shoes"
}
```

**Docs:** [Test an analyzer](https://www.elastic.co/docs/manage-data/data-store/text-analysis/test-an-analyzer)

---

## A6 · Ingest pipeline

```json
PUT _ingest/pipeline/add-ingest-time
{
  "processors": [
    { "set": { "field": "ingest_ts", "value": "{{_ingest.timestamp}}" } }
  ]
}

POST /products/_doc?pipeline=add-ingest-time
{ "name": "Track Spike", "sku": "SPK-1", "price": 79.0, "created_at": "2026-08-06" }
```

**Docs:** [Ingest pipelines](https://www.elastic.co/docs/manage-data/ingest/transform-enrich/ingest-pipelines)

---

## A7 · Data stream + lifecycle mindset

Time-series → data stream (TSDB/logsdb where applicable) + ILM/DLM. Content → index + aliases.

**Docs:** [Data streams](https://www.elastic.co/docs/manage-data/data-store/data-streams) · [TSDB](https://www.elastic.co/docs/manage-data/data-store/data-streams/time-series-data-stream-tsds) · [ILM](https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management)

---

## A8 · Hybrid / vector search

```json
PUT /semantic-docs
{
  "mappings": {
    "properties": {
      "body": { "type": "semantic_text" },
      "title": { "type": "text" }
    }
  }
}
```

Then combine lexical + semantic with retrievers / RRF.

**Docs:** [semantic_text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text) · [Retrievers](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers) · [RRF retriever](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/rrf-retriever) · [RRF](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)

---

## A9 · ES|QL

```esql
FROM products
| WHERE price < 150
| STATS c = COUNT(*) BY sku
| SORT c DESC
```

**Docs:** [ES|QL](https://www.elastic.co/docs/reference/query-languages/esql)

---

## A10 · Ops loop you should run weekly

```bash
GET _cluster/health?pretty
GET _cat/allocation?v
GET _cat/shards?v&s=store:desc
GET _nodes/stats/breaker?pretty
GET _cat/thread_pool/search,write?v
GET _snapshot/_all
```

Restore drill > snapshot checkbox.

**Docs:** [Snapshot and restore](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore) · [Troubleshoot](https://www.elastic.co/docs/troubleshoot/elasticsearch)

---

## A11 · Security minimums

TLS, least-privilege roles, API keys with rotation, no anonymous write, audit where required.

**Docs:** [Security](https://www.elastic.co/docs/deploy-manage/security) · [Users and roles](https://www.elastic.co/docs/deploy-manage/users-roles)

---

## A12 · Production playbooks

### Content search

Explicit mappings · language analyzer · filter context · relevance judgment set · alias reindex

### Logs/metrics

Data streams · ECS · ILM/DLM · tiers/searchable snapshots · retention restore test

### Vectors/RAG

`semantic_text` first · metadata filters · recall@k · BBQ/quantization before RAM · hybrid RRF

### Cluster

Dedicated masters at scale · shard sizing · breaker/thread-pool dashboards · upgrade notes · resiliency page

---

## A13 · Project: product catalog search (end-to-end)

**Goal:** ship a catalog index with explicit mappings, bulk ingest, scored search + filters, highlighting, facets, and an alias-safe reindex cutover.

**Docs:** [Mapping](https://www.elastic.co/docs/manage-data/data-store/mapping) · [Query DSL](https://www.elastic.co/docs/explore-analyze/query-filter/languages/querydsl) · [Highlighting](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/highlighting) · [Aliases](https://www.elastic.co/docs/manage-data/data-store/aliases)

### Steps

1. Create `catalog-v1` with `dynamic: strict`, `name` as `text` + `.keyword`, `sku`/`brand` as `keyword`, `price` as `scaled_float`, `description` as `text`.
2. Bulk-load ~20 products with `refresh=wait_for`.
3. Point alias `catalog` at `catalog-v1` with `is_write_index: true`.
4. Search with scored `multi_match` on name/description and **filters** on price/brand; add `highlight` on `description`.
5. Add a `terms` aggregation on `brand` (`size: 0` hits if you only need facets).
6. Build `catalog-v2` with a better analyzer, `_reindex` from v1, then atomically swap the alias.

**Done when:** clients only know `catalog`; facets never touch analyzed `text`; cutover needs no app URL change.

```json
GET catalog/_search
{
  "query": {
    "bool": {
      "must": [{ "multi_match": { "query": "trail", "fields": ["name^3", "description"] } }],
      "filter": [{ "range": { "price": { "lte": 200 } } }]
    }
  },
  "highlight": { "fields": { "description": { "type": "unified" } } },
  "aggs": { "brands": { "terms": { "field": "brand", "size": 20 } } }
}
```

---

## A14 · Project: logs pipeline with data stream + failure store

**Goal:** parse application logs into a data stream, capture poison documents, and plan retention.

**Docs:** [Data streams](https://www.elastic.co/docs/manage-data/data-store/data-streams) · [Ingest pipelines](https://www.elastic.co/docs/manage-data/ingest/transform-enrich/ingest-pipelines) · [Failure store](https://www.elastic.co/docs/manage-data/data-store/data-streams/failure-store) · [Logsdb](https://www.elastic.co/docs/manage-data/data-store/data-streams/logs-data-stream)

### Steps

1. Create a composable template for `app-logs-*` with `data_stream: {}` (optionally `"index.mode": "logsdb"`) and ECS-ish fields: `@timestamp`, `host.name`, `message`, `log.level`.
2. Build an ingest pipeline: grok/dissect → `date` → set `event.dataset`.
3. `_simulate` good and bad sample lines.
4. Create the data stream, enable failure store + retention, then bulk index mixed documents.
5. Query `app-logs` for happy path and `app-logs::failures` for failures.
6. Attach DLM retention or sketch an ILM policy (rollover → delete).

**Done when:** time + host filters work on good data, and bad docs do not abort the whole bulk.

---

## A15 · Project: hybrid lexical + semantic search

**Goal:** fuse BM25 and semantic retrieval with metadata filters using retrievers/RRF.

**Docs:** [semantic_text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text) · [Retrievers](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers) · [RRF retriever](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/rrf-retriever) · [RAG](https://www.elastic.co/docs/solutions/search/rag)

### Steps

1. Create an index with `title` (`text`), `body` (`semantic_text`), `product_line` (`keyword`). Requires inference configured for your deployment.
2. Index 10–20 knowledge-base documents.
3. Compare three searches: lexical-only, semantic-only, and RRF hybrid with a `product_line` filter on the lexical branch.
4. Optionally wrap the winner in a search template for the application.
5. Write down why the top hit won (explain/profile as needed).

```json
GET kb/_search
{
  "retriever": {
    "rrf": {
      "retrievers": [
        {
          "standard": {
            "query": {
              "bool": {
                "must": [{ "match": { "title": "refund policy" } }],
                "filter": [{ "term": { "product_line": "billing" } }]
              }
            }
          }
        },
        {
          "standard": {
            "query": { "semantic": { "field": "body", "query": "how do I get my money back?" } }
          }
        }
      ],
      "rank_window_size": 50
    }
  }
}
```

**Done when:** you can demote pure keyword spam with semantics *and* still constrain by tenant/product metadata.

---

# PART IV - DEEP LABS & OPS

> Everything below was thin in Parts I–III. These modules are the difference between "I know ES exists" and "I can run it at 2am."

---

## D0 · Index modes deep dive

`index.mode` changes how Lucene stores and routes data. Wrong mode = wasted disk or broken assumptions.

**Docs:** [Logs data streams](https://www.elastic.co/docs/manage-data/data-store/data-streams/logs-data-stream) · [Configure logsdb](https://www.elastic.co/docs/manage-data/data-store/data-streams/logs-data-stream-configure) · [TSDS](https://www.elastic.co/docs/manage-data/data-store/data-streams/time-series-data-stream-tsds) · [Columnar / logsdb_columnar](https://www.elastic.co/docs/manage-data/data-store/columnar) · [Synthetic `_source](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/mapping-source-field#synthetic-source)` · [Index sorting](https://www.elastic.co/docs/reference/elasticsearch/index-settings/sorting)


| Mode                   | Best for                              | Signature traits                                                                                                       |
| ---------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| *(default / standard)* | Content, mutable docs, general search | Classic shards, full `_source` typical                                                                                 |
| `time_series`          | Metrics (TSDS)                        | Dimensions + metrics, `_tsid`, dimension routing, synthetic `_source`, time-bound backing indices, duplicate rejection |
| `logsdb`               | Logs                                  | Index sort (often `host.name` + `@timestamp`), `best_compression`, synthetic `_source` (license-dependent), lower disk |
| `logsdb_columnar`      | Fully columnar logs profile           | See columnar docs for when to prefer over logsdb                                                                       |


### TSDS essentials

- Mark dimensions with `time_series_dimension: true`
- Mark metrics with `time_series_metric: counter|gauge|histogram`
- Custom `_id` not supported; duplicates (same dimensions + timestamp) → `409`
- Downsampling shrinks old metrics further

**Docs:** [Set up TSDS](https://www.elastic.co/docs/manage-data/data-store/data-streams/set-up-tsds) · [Downsampling TSDS](https://www.elastic.co/docs/manage-data/data-store/data-streams/downsampling-time-series-data-stream) · [Metric temporality](https://www.elastic.co/docs/manage-data/data-store/data-streams/metric-temporality)

### Logsdb essentials

```json
PUT _index_template/my-logs
{
  "index_patterns": ["my-logs-*"],
  "data_stream": {},
  "priority": 200,
  "template": {
    "settings": { "index.mode": "logsdb" }
  }
}
```

- Default for many `logs-*-*` streams on Stack 9.0+ / Serverless
- Existing streams pick it up on **next rollover** after template change
- Review `host.name` mapping/sort conflicts before enabling on old streams

### Chooser


| Data                    | Prefer                                    |
| ----------------------- | ----------------------------------------- |
| Product catalog / users | standard index                            |
| CPU/mem/sensor metrics  | TSDS (`time_series`)                      |
| App/security logs       | logsdb data stream                        |
| Mixed events you update | regular index / carefully designed stream |


---

## D1 · Production incident runbooks

Always check `_shards` / allocation explain / breakers before blaming "Elasticsearch is down."

**Docs:** [Troubleshoot Elasticsearch](https://www.elastic.co/docs/troubleshoot/elasticsearch) · [Allocation explain](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-cluster-allocation-explain) · [Circuit breaker errors](https://www.elastic.co/docs/troubleshoot/elasticsearch/circuit-breaker-errors) · [Cluster allocation settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/cluster-level-shard-allocation-routing-settings) · [Resiliency](https://www.elastic.co/guide/en/elasticsearch/resiliency/current/index.html)

### R1 · Cluster yellow

**Meaning:** all primaries up; missing replicas.

```bash
GET _cluster/health?pretty
GET _cat/shards?v&h=index,shard,prirep,state,node,unassigned.reason
GET _cluster/allocation/explain?pretty
```

**Common causes:** node down, allocation filters, disk watermark, not enough nodes for replica count.
**Fix direction:** restore node capacity, reduce replicas temporarily, fix filters/watermarks — not "add random settings."

### R2 · Cluster red

**Meaning:** at least one primary missing → data for that shard unavailable.

```bash
GET _cluster/allocation/explain?pretty
GET _cat/shards?v&s=state:desc
```

**Fix direction:** recover node/disk, restore from snapshot if primary lost, avoid force-allocating blindly.

### R3 · Flood-stage watermark / read-only indices

**Symptom:** `cluster_block_exception` / index `read_only_allow_delete`.
**Fix:** free disk, verify watermarks, clear block after space returns:

```bash
PUT _all/_settings
{ "index.blocks.read_only_allow_delete": null }
```

(Only after disk is healthy.)

### R4 · Circuit breaker / OOM-adjacent

```bash
GET _nodes/stats/breaker,jvm?pretty
GET _cat/circuit_breaker?v
```

**Fix:** shrink aggs (`size`, `shard_size`), stop fielddata-on-text, reduce cardinality, raise heap only after page-cache math.

### R5 · `es_rejected_execution_exception`

```bash
GET _cat/thread_pool/search,write?v&h=node_name,name,active,queue,rejected
```

**Fix:** reduce client concurrency, fix slow queries/merges, scale data nodes — don't inflate queues forever.

### R6 · "Indexed but not found in search"

Check refresh interval / `refresh=wait_for`, wrong index/alias, routing, refresh on replica lag myths — remember NRT.

### R7 · Mapping explosion / cluster state huge

```bash
GET my-index/_mapping
GET _cluster/stats?pretty
```

**Fix:** `dynamic: strict|runtime`, templates, reindex to sane schema, mapping limits.

### R8 · First five commands (memorize)

```bash
GET _cluster/health
GET _cat/shards?v
GET _cluster/allocation/explain
GET _nodes/stats/breaker,thread_pool,jvm,fs
GET _cat/thread_pool/search,write?v
```

---

## D2 · Relevance engineering lab

**Docs:** [Search templates](https://www.elastic.co/docs/solutions/search/search-templates) · [Rank Evaluation API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-rank-eval) · [Explain](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-explain) · [Search profile](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-profile) · [Query rules](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/searching-with-query-rules) · [Retrievers](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers) · [RRF retriever](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/rrf-retriever) · [Ranking](https://www.elastic.co/docs/solutions/search/ranking) · [Semantic reranking](https://www.elastic.co/docs/solutions/search/ranking/semantic-reranking) · [LTR](https://www.elastic.co/docs/solutions/search/ranking/learning-to-rank-ltr)

### Workflow

1. Freeze a **judgment set** (query → relevant doc ids)
2. Put the query in a **search template** (Mustache) so prod/app share one definition
3. Score changes with **rank eval** (precision/recall/MRR/DCG-style metrics in API)
4. Debug surprises with **explain** + **profile**
5. Business overrides via **query rules** / pinned docs
6. Hybrid lexical+vector via **retrievers + RRF**
7. Optional second stage: semantic reranker / LTR

### Search template sketch

```json
POST _scripts/product_search
{
  "script": {
    "lang": "mustache",
    "source": {
      "query": {
        "bool": {
          "must": [ { "match": { "name": "{{q}}" } } ],
          "filter": [ { "term": { "status": "published" } } ]
        }
      }
    }
  }
}

GET products/_search/template
{ "id": "product_search", "params": { "q": "trail shoe" } }
```

### Rank eval sketch

```json
POST products/_rank_eval
{
  "requests": [{
    "id": "q1",
    "request": { "query": { "match": { "name": "trail" } } },
    "ratings": [{ "_index": "products", "_id": "1", "rating": 3 }]
  }],
  "metric": { "mean_reciprocal_rank": { "k": 10 } }
}
```

Tune with evidence, not vibes.

---

## D3 · Percolator (reverse search)

Store **queries**, percolate **documents** — alerts, classification, matching incoming events to many rules.

**Docs:** [percolator field](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/percolator) · [percolate query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-percolate-query)

```json
PUT /alerts
{
  "mappings": {
    "properties": {
      "query": { "type": "percolator" },
      "message": { "type": "text" }
    }
  }
}

PUT /alerts/_doc/rule-cpu
{
  "query": {
    "match": { "message": "cpu saturation" }
  }
}

GET /alerts/_search
{
  "query": {
    "percolate": {
      "field": "query",
      "document": { "message": "host42 cpu saturation warning" }
    }
  }
}
```

Notes: percolator queries are mapped/analyzed carefully; expensive at scale — design rule cardinality and filters deliberately. Counted as an expensive query class.

---

## D4 · Searchable snapshots & downsampling

**Docs:** [Searchable snapshots](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/searchable-snapshots) · [ILM searchable_snapshot](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-searchable-snapshot) · [ILM downsample](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-downsample) · [Downsampling TSDS](https://www.elastic.co/docs/manage-data/data-store/data-streams/downsampling-time-series-data-stream) · [Data tiers](https://www.elastic.co/docs/manage-data/lifecycle/data-tiers)

### Searchable snapshots

- Mount snapshot shards as searchable indices; local cache + repo fetch on miss
- **Fully mounted** (cold-style): more local data, faster
- **Partially mounted** (frozen-style): minimal local, cheaper, higher latency
- Do **not** delete the backing snapshot while mounted
- ILM `searchable_snapshot` cannot run on a data stream's current write index — rollover first

### Downsampling

- Collapses TSDS metrics into coarser time buckets (`aggregate_metric_double` etc.)
- Huge storage wins for old metrics; lose raw resolution intentionally
- Typically an ILM warm/cold action after rollover

### Cost ladder (typical)

hot SSD → warm → cold searchable snapshot → frozen partial mount → delete  

- downsample metrics before/with cold phases when resolution allows

---

## D5 · Ingest processor catalog & text structure

**Docs:** [Ingest pipelines](https://www.elastic.co/docs/manage-data/ingest/transform-enrich/ingest-pipelines) · [Processors reference](https://www.elastic.co/docs/reference/enrich-processor) · [Enrich](https://www.elastic.co/docs/manage-data/ingest/transform-enrich/data-enrichment) · [Text structure API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-text-structure-find-structure) · [Failure store](https://www.elastic.co/docs/manage-data/data-store/data-streams/failure-store)

### Processors you will actually use


| Processor                              | Job                                |
| -------------------------------------- | ---------------------------------- |
| `grok` / `dissect`                     | Parse lines into fields            |
| `date`                                 | Event time → `@timestamp`          |
| `convert` / `coerce` patterns          | Types                              |
| `rename` / `set` / `remove` / `append` | Shape docs                         |
| `lowercase` / `trim` / `gsub`          | Normalize                          |
| `json`                                 | Parse JSON strings                 |
| `pipeline`                             | Call sub-pipelines                 |
| `enrich`                               | Join against enrich index          |
| `script`                               | Painless transforms                |
| `fail` / `drop`                        | Control flow                       |
| `fingerprint`                          | Stable hashes / ids                |
| `foreach`                              | Array handling                     |
| `inference`                            | ML/NLP at ingest (where available) |


### Simulate before prod

```json
POST _ingest/pipeline/_simulate
{
  "pipeline": {
    "processors": [
      { "grok": { "field": "message", "patterns": ["%{COMMONAPACHELOG}"] } }
    ]
  },
  "docs": [{ "_source": { "message": "127.0.0.1 - - [06/Aug/2026:00:00:00 +0000] \"GET / HTTP/1.1\" 200 123" } }]
}
```

### Text structure

Use `_text_structure/find_structure` to infer grok/mappings from sample files before inventing parsers by hand.

---

## D6 · Data stream failure store

Capture ingest/mapping failures instead of failing the client's bulk — then replay.

**Docs:** [Failure store](https://www.elastic.co/docs/manage-data/data-store/data-streams/failure-store) · [Failure store recipes](https://www.elastic.co/docs/manage-data/data-store/data-streams/failure-store-recipes) · [Put data stream options](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-put-data-stream-options) · [Recover failure document processor](https://www.elastic.co/docs/reference/ingest-processor/recover-failure-document-processor)

```json
PUT _data_stream/my-logs/_options
{
  "failure_store": {
    "enabled": true,
    "lifecycle": { "data_retention": "30d", "enabled": true }
  }
}

GET my-logs::failures/_search
```

Replay carefully (avoid duplicating failures while remediating). Recipes doc covers gap-fill workflows.

---

## D7 · Painless by context

Same language, different privileges and APIs per context.

**Docs:** [Painless](https://www.elastic.co/docs/reference/scripting-languages/painless/painless) · [Painless contexts](https://www.elastic.co/docs/reference/scripting-languages/painless/painless-contexts) · [Scripting](https://www.elastic.co/docs/explore-analyze/scripting)


| Context                | Typical use                 | Notes                      |
| ---------------------- | --------------------------- | -------------------------- |
| Ingest                 | reshape `_source` pre-index | runs on ingest nodes       |
| Update                 | partial doc updates         | `_source` access patterns  |
| Runtime fields         | schema-on-read `emit(...)`  | CPU on search              |
| Score (`script_score`) | custom relevance            | can be expensive           |
| Script query           | filter via script           | expensive; prefer mappings |
| Aggs / bucket_script   | metric math on agg results  | pipeline layer             |
| Watcher / transforms   | automation                  | product-specific           |


Rules of thumb:

- Prefer ingest-time normalization over search-time scripts
- Prefer runtime fields over stored scripts for experiments
- Prefer `keyword`/doc-values fields over scripting for filters
- Stored scripts (`_scripts`) for reuse; avoid string scripts in hot paths when possible

---

## D8 · Security worked examples (RBAC / DLS / FLS / API keys)

**Docs:** [Security](https://www.elastic.co/docs/deploy-manage/security) · [Users and roles](https://www.elastic.co/docs/deploy-manage/users-roles) · [Document & field level access](https://www.elastic.co/docs/deploy-manage/users-roles/cluster-or-deployment-auth/controlling-access-at-document-field-level) · [API keys](https://www.elastic.co/docs/deploy-manage/api-keys) · [DLS (reference)](https://www.elastic.co/guide/en/elasticsearch/reference/current/document-level-security.html)

### Role with index + DLS + FLS sketch

```json
POST /_security/role/orders_support
{
  "indices": [
    {
      "names": [ "orders*" ],
      "privileges": [ "read", "view_index_metadata" ],
      "query": {
        "term": { "tenant_id": "acme" }
      },
      "field_security": {
        "grant": [ "order_id", "status", "created_at", "sku" ],
        "except": [ "ssn", "card_last4" ]
      }
    }
  ]
}
```

### API key for an app (least privilege)

```json
POST /_security/api_key
{
  "name": "catalog-searcher",
  "role_descriptors": {
    "catalog_read": {
      "indices": [{
        "names": ["products"],
        "privileges": ["read"]
      }]
    }
  }
}
```

Practices: TLS everywhere, rotate keys, no shared superuser in apps, Spaces for Kibana separation, audit when compliance needs it.

---

## D9 · EQL sequence examples

Event Query Language for sequences — security/detections mindset.

**Docs:** [EQL](https://www.elastic.co/docs/explore-analyze/query-filter/languages/eql) · [EQL APIs](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-eql)

```json
GET logs-*/_eql/search
{
  "query": """
    sequence by host.name with maxspan=5m
      [ process where process.name == "cmd.exe" ]
      [ network where destination.port == 443 ]
  """
}
```

Use when order-of-events matters more than BM25 relevance. Pair with ECS field names.

---

## D10 · Watcher vs Kibana Alerting

**Docs:** [Alerting](https://www.elastic.co/docs/explore-analyze/alerting) · [Watcher settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/watcher-settings) · [Watcher APIs](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-watcher)


| Need                                                                              | Prefer                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Stack monitoring / Kibana-centric ops & user alerts                               | **Kibana Alerting** (and ES|QL-based options where available) |
| Cluster-side scheduled query → transform → email/webhook with deep ES integration | **Watcher** (legacy-but-present power tool)                   |
| Simple threshold on metrics/logs in Observability/Security                        | Solution alerting UIs                                         |


Don't run duplicate alert systems for the same condition. Prefer one owner, clear routing, and tested actions.

---

## D11 · Clients & bulk best practices

**Docs:** [Elasticsearch clients](https://www.elastic.co/docs/reference/elasticsearch-clients) · [Client guide hub](https://www.elastic.co/guide/en/elasticsearch/client/index.html) · [Bulk API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-bulk) · [API conventions](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/api-conventions)

Practices:

- Use official clients (Java, Python, JS, Go, .NET, …)
- **Bulk** with bounded size (e.g. 5–15 MB or few thousand docs) — measure
- Parallelism capped by thread pools / indexing pressure — backoff on `429`
- Idempotent ids when retries are expected
- Sniffing/cloud: follow client guidance for Elastic Cloud (often less sniffing, proper endpoints)
- Prefer `refresh=wait_for` only when read-after-write required
- Separate ingest vs search connection pools if workloads fight

---

## D12 · Bootstrap checks, JVM & important settings

**Docs:** [Bootstrap checks](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/bootstrap-checks) · [Important settings](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/important-settings-configuration) · [Node settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/node-settings) · [Networking](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/networking-settings) · [Discovery](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/discovery-cluster-formation-settings)

Production mode fails hard on unsafe config (memory lock, file descriptors, `vm.max_map_count`, discovery, heap dump paths, etc.).

Checklist:

- Heap ~50% RAM (leave page cache); container limits coherent
- `vm.max_map_count` ≥ 262144 (often 1048576)
- Sufficient file descriptors
- Explicit cluster name + seed hosts / initial master nodes as required by version
- Disk watermarks understood before the pager fires
- Never run single-node discovery tricks in real prod multi-node clusters

---

## D13 · Benchmarking with Rally

**Docs:** [esrally documentation](https://esrally.readthedocs.io/en/stable/) · [Optimize performance](https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance) · [Size shards](https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance/size-shards)

Use [Rally](https://esrally.readthedocs.io/en/stable/) to measure indexing throughput, query latency, and storage across mapping/mode changes (e.g. standard vs logsdb). Change **one variable** per race. Track p50/p95/p99, not averages alone.

---

## D14 · Graph explore API

**Docs:** [Graph API group](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-graph)

Graph explore finds significant connections between terms (e.g. co-occurrence / influence-style exploration) — useful for investigations and relevance research, not a replacement for Query DSL search.

---

## D15 · Production failure modes (lesson)

This lesson is a field guide, not a quiz. For each failure pattern: what you see, why it happens, what to do. Pair with the runbooks in D1.

### Mapping and query mistakes

**Aggregations return garbage or nothing on a `text` field.** Analyzed text is tokenized for BM25, not for terms buckets. Map a `keyword` multi-field (`message.keyword`) and aggregate on that.

`**match` on an SKU / ID misses exact values.** IDs and codes belong on `keyword` with `term` / `terms` queries. Analysis will split or lowercase them in ways that break exact lookup.

**Dynamic mapping typed a number as `text`.** The first document probably sent a quoted value. Use explicit mappings and ingest `convert` processors for production streams.

**You cannot change `text` → `keyword` in place.** Lucene structures are fixed per field. Add a multi-field or reindex into a new mapping. Same story for most type changes.

**Nested results look "duplicated" or scores look weird.** Nested objects are separate Lucene documents under the hood. Learn `inner_hits` and nested score modes before blaming the query planner.

**Docs:** [Mapping](https://www.elastic.co/docs/manage-data/data-store/mapping) · [text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/text) · [keyword](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/keyword) · [nested](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/nested)

### Cluster health and allocation

**Cluster stays yellow after you "fixed" something.** Replicas may still be reallocating, awareness attributes may be incomplete, or allocation filters may exclude nodes. Run allocation explain before changing replica counts at random.

**Replicas = 1 but you still lost data.** Correlated failure (same rack/disk/AZ), primary lost before promotion finished, or you never had a tested snapshot. Replicas are not backups.

`**disk_watermark_exceeded` / flood-stage read-only.** Free disk first. Clearing `read_only_allow_delete` without space only fails again. Do not raise watermarks as a lifestyle.

**Force merge on a hot write index destroyed ingest latency.** Force merge belongs on read-only / cold indices after rollover - never on the active write index as a daily habit.

**Docs:** [Red or yellow health](https://www.elastic.co/docs/troubleshoot/elasticsearch/red-yellow-cluster-status) · [Allocation explain](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-cluster-allocation-explain)

### Performance and pressure

**Heap climbs while "only searching."** Suspect fielddata, enormous aggregations, request-breaker pressure, or cluster-state bloat - not "Lucene needs the heap for segments." Segments want page cache.

**Bulk returns 429 / rejects.** Write thread pool or indexing pressure is saturated. Back off and resize; do not raise client concurrency to "push through."

**Intermittent slow search.** Merge storms, GC pauses, cold page cache after restart, deep `from`, or sudden high-cardinality aggs. Profile the query; check hot threads and merge stats.

`**refresh=true` on every bulk made indexing crawl.** You created tiny segments. Use default refresh or `wait_for` when read-your-writes is required.

**Deep pagination with giant `from`.** Use point-in-time + `search_after` instead.

**Coordinating-only node melts under heavy aggs.** Reductions happen on the coordinator. Reduce fan-in, sample, or give that role real CPU/RAM.

**Docs:** [Circuit breaker errors](https://www.elastic.co/docs/troubleshoot/elasticsearch/circuit-breaker-errors) · [Thread pools](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/thread-pool-settings) · [Paginate search results](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/paginate-search-results)

### Lifecycle, snapshots, and data modes

**ILM did not rollover.** Conditions not met, wrong policy, ILM stopped, or the index is not the write index / not eligible. Use `_ilm/explain`.

**Frozen tier searches feel unusable.** Partially mounted searchable snapshots trade cost for latency - by design. Keep interactive ranges on hot/warm/cold.

**TSDS rejects "duplicates."** Same dimensions + `@timestamp` are intentionally rejected. Fix producers or timestamps.

`**_source` looks different on TSDS/logsdb.** Synthetic `_source` reconstructs documents with documented restrictions.

**Failure store grew forever.** You enabled capture without retention, or ingest is permanently broken. Fix the pipeline and set failure-store lifecycle.

**Snapshot restore missing ILM policies / templates.** Restore only includes what you asked for; cluster-state objects often need explicit include options.

**Docs:** [ILM](https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management) · [Searchable snapshots](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/searchable-snapshots) · [Failure store](https://www.elastic.co/docs/manage-data/data-store/data-streams/failure-store)

### Security, relevance, and clients

**DLS user sees zero hits.** The role query filters everything, or alias filters compose unexpectedly. Test as that user.

**FLS still leaks a field.** Another role grants it, or `_source` still contains it under a granted path. Always verify with the restricted identity.

`**script_score` disagrees with BM25 intuition.** You replaced scoring. Document the formula and use the Explain API.

**Version conflicts on update.** Optimistic concurrency (`if_seq_no` / `if_primary_term`). Retry with backoff; do not ignore conflicts blindly.

**Write alias pointed at the wrong index.** Only one `is_write_index` should be true after cutover. Double-check alias actions during blue/green reindex.

**Percolator latency exploded.** Too many stored queries without pre-filters - treat it as a fan-out problem and constrain the candidate set.

**Rank-eval score dropped after adding synonyms.** Synonyms move the recall/precision trade-off. Re-judge with a fixed set; do not chase a single metric.

**Docs:** [Document and field level security](https://www.elastic.co/docs/deploy-manage/users-roles/cluster-or-deployment-auth/controlling-access-at-document-field-level) · [Explain API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-explain)

### Platform and process

**Rolling upgrade stalled.** Unassigned shards, plugin/version mismatch, or not enough masters. Fix health before continuing the roll.

**Bootstrap checks fail only in Docker.** Production-mode detection plus `vm.max_map_count`, ulimits, or memory lock. Read the failing check literally.

**Rally numbers do not match production.** Different hardware, cold vs warm cache, security off, tiny data, single-node lies. Benchmark the shape you ship.

**"Just one more field" took down masters.** Mapping explosion → cluster state pressure. Templates, `dynamic: strict`, and mapping limits are safety rails - not bureaucracy.

**Docs:** [Bootstrap checks](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/bootstrap-checks) · [Rolling restart](https://www.elastic.co/docs/deploy-manage/maintenance/start-stop-services/full-cluster-restart-rolling-restart-procedures) · [Rally](https://esrally.readthedocs.io/en/stable/)

### Exercise

Pick three production incidents you have seen (or invent realistic ones). For each, write the symptom, the Part I principle it violates, and the first three APIs you would run. Then compare with D1.

---

## D16 · Capstone: wire it together

1. Pick **index mode** for the dataset (D0)
2. Explicit mappings + ingest pipeline (+ failure store if streaming) (D5–D6)
3. Search template + rank eval loop (D2)
4. ILM: rollover → (downsample) → searchable snapshot → delete (D4)
5. Security roles with DLS/FLS before exposing (D8)
6. Rally when changing mode/mappings (D13)
7. On fire: runbooks first, folklore never (D1, D15)

---

---

# PART V - REMAINING DEPTH + COVERAGE MAP

> Part IV covered the big labs. This part adds the **still-thin but production-critical** details, then states honestly what is/isn't in this course.

---

## E0 · Coverage honesty (read this)

### Fully covered (engine mastery)

Architecture & Lucene internals · mappings/field types · analysis · Query DSL families · aggregations catalogs · ES|QL/SQL/EQL doors · vectors/semantic/RAG doors · ingest/ILM/data streams/index modes · security basics+DLS/FLS examples · snapshots/CCR/CCS doors · ops runbooks & landmines · relevance lab · percolator · failure store · clients/bootstrap/Rally pointers

### Now detailed in Part V (was thin)

ILM action catalog · SLM · enrich policy lifecycle · transforms · PIT/`search_after` · async search · synonyms sets · retriever types · runtime fields example · rolling restart · remote-cluster security · hot threads · serverless vs stateful differences

### Intentionally not a full rewrite of Elastic docs

Writing every processor parameter, every ILM option, every ML job type, and every Kibana panel would duplicate [elastic.co/docs](https://www.elastic.co/docs/) word-for-word. This is a **taught course** (lessons + labs + failure guides). The linked pages remain the parameter bible - we do not turn Elastic docs into flashcards.

### Outside core ES engine (use solution docs)


| Area                                  | Go here instead                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Full Elastic Observability product UX | [Observability](https://www.elastic.co/docs/solutions/observability)                       |
| Full Elastic Security SIEM/rules UX   | [Security](https://www.elastic.co/docs/solutions/security)                                 |
| Fleet/Agent integration authoring     | [Ingestion tools](https://www.elastic.co/docs/reference/ingestion-tools) · Fleet API group |
| Kibana Lens/Dashboard design          | [Explore & analyze](https://www.elastic.co/docs/explore-analyze)                           |
| ECE/ECK operator deep ops             | [Deploy](https://www.elastic.co/docs/deploy-manage/deploy)                                 |


If you need those as separate courses, say so — they are products on top of ES, not missing Lucene chapters.

---

## E1 · ILM actions catalog (with meaning)

**Docs:** [ILM](https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management) · [rollover](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-rollover) · [shrink](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-shrink) · [forcemerge](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-forcemerge) · [allocate](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-allocate) · [migrate](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-migrate) · [searchable_snapshot](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-searchable-snapshot) · [downsample](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-downsample) · [delete](https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-delete)


| Action                | Phase(s)         | What it really does                                           |
| --------------------- | ---------------- | ------------------------------------------------------------- |
| `rollover`            | hot              | New write index when max_age/size/docs/primary-shard-size hit |
| `set_priority`        | any              | Recovery priority hints                                       |
| `unfollow`            | any              | Stop CCR follow before other actions                          |
| `shrink`              | warm/cold        | Fewer shards on read-only index                               |
| `forcemerge`          | warm/cold        | Collapse segments; often `max_num_segments: 1`                |
| `allocate`            | warm/cold        | Require/include/exclude attributes (legacy-ish control)       |
| `migrate`             | warm/cold/frozen | Move to data tiers (`data_warm`, …)                           |
| `readonly`            | warm/cold        | Block writes                                                  |
| `searchable_snapshot` | cold/frozen      | Snapshot + mount; not on current write index                  |
| `downsample`          | hot/warm (TSDS)  | Coarser metrics buckets                                       |
| `delete`              | delete           | Remove index (and often managed snapshot per policy)          |


### Minimal policy shape

```json
PUT _ilm/policy/logs-policy
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": { "max_primary_shard_size": "50gb", "max_age": "1d" }
        }
      },
      "warm": {
        "min_age": "3d",
        "actions": {
          "forcemerge": { "max_num_segments": 1 },
          "shrink": { "number_of_shards": 1 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "searchable_snapshot": { "snapshot_repository": "found-snapshots" }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": { "delete": {} }
      }
    }
  }
}
```

Debug with `GET my-index/_ilm/explain`.

---

## E2 · SLM (Snapshot Lifecycle Management)

Automate backup cadence — separate from ILM searchable snapshots.

**Docs:** [Create snapshots](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/create-snapshots) · [SLM put lifecycle](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-slm-put-lifecycle) · [Snapshot & restore](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore)

```json
PUT _slm/policy/nightly-snapshots
{
  "schedule": "0 30 1 * * ?",
  "name": "<nightly-{now/d}>",
  "repository": "found-snapshots",
  "config": {
    "indices": ["*"],
    "ignore_unavailable": true,
    "include_global_state": false
  },
  "retention": {
    "expire_after": "30d",
    "min_count": 5,
    "max_count": 50
  }
}

POST _slm/policy/nightly-snapshots/_execute
GET _slm/policy/nightly-snapshots?human
```

**Rule:** a snapshot you never restored is a wish, not a backup. Quarterly restore drill to a scratch cluster/index.

---

## E3 · Enrich policy lifecycle (detail)

**Docs:** [Data enrichment](https://www.elastic.co/docs/manage-data/ingest/transform-enrich/data-enrichment) · [Processors](https://www.elastic.co/docs/reference/enrich-processor)

1. Create **source index** with lookup docs
2. `PUT _enrich/policy/my-policy` (match/geo_match/range)
3. `POST _enrich/policy/my-policy/_execute` → builds enrich index
4. Ingest pipeline `enrich` processor references policy
5. Re-execute policy when source data changes

Enrich is **index-time join**. Prefer it over search-time scripts for stable reference data (user→dept, IP→geo, SKU→category).

---

## E4 · Transforms (entity-centric indices)

**Docs:** [Transforms](https://www.elastic.co/docs/explore-analyze/transforms)

Pivot continuous transforms: source indices → aggregation → destination index (e.g. per-customer features for search/ML). Use when dashboards/aggs repeatedly compute the same pivot. Watch transform stats APIs for checkpoint lag.

---

## E5 · PIT + search_after + async search (worked)

**Docs:** [Paginate](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/paginate-search-results) · [Open PIT](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-open-point-in-time) · [Async search](https://www.elastic.co/docs/solutions/search/async-search-api)

### Deep pagination (preferred)

```json
POST products/_pit?keep_alive=1m

# response => id

GET _search
{
  "size": 100,
  "pit": { "id": "PIT_ID", "keep_alive": "1m" },
  "sort": [{ "created_at": "asc" }, { "_shard_doc": "asc" }],
  "search_after": [ "2026-01-01T00:00:00Z", 0 ]
}

DELETE _pit
{ "id": "PIT_ID" }
```

Avoid deep `from`/`size`. Scroll is legacy for this use case.

### Async search

```json
POST logs-*/_async_search?wait_for_completion_timeout=100ms
{
  "size": 0,
  "aggs": { "by_host": { "terms": { "field": "host.name", "size": 100 } } }
}

GET _async_search/ASYNC_ID
DELETE _async_search/ASYNC_ID
```

Use for long aggs on warm/cold/frozen data so the HTTP client doesn't sit forever.

---

## E6 · Runtime fields (worked)

**Docs:** [Runtime fields](https://www.elastic.co/docs/manage-data/data-store/mapping/runtime-fields)

```json
GET products/_search
{
  "runtime_mappings": {
    "price_band": {
      "type": "keyword",
      "script": {
        "source": """
          def p = doc['price'].value;
          emit(p < 50 ? 'budget' : (p < 150 ? 'mid' : 'premium'));
        """
      }
    }
  },
  "size": 0,
  "aggs": {
    "bands": { "terms": { "field": "price_band" } }
  }
}
```

Great for experiments and fixing mapping mistakes without reindex. Promote hot runtime fields to indexed fields when stable.

---

## E7 · Synonyms sets API

**Docs:** [Synonyms API group](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-synonyms) · [synonym token filter](https://www.elastic.co/docs/reference/text-analysis/analysis-synonym-tokenfilter)

Manage synonym sets via API (not only static files), reference them from analyzers, and reindex/reload as required by your version's synonym update model. Giant synonym lists can trip circuit breakers at analysis build time — keep sets curated.

---

## E8 · Retriever types (complete set)

**Docs:** [Retrievers](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers) · [standard](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/standard-retriever) · [knn](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/knn-retriever) · [rrf](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/rrf-retriever) · [linear](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/linear-retriever) · [rule](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/rule-retriever) · [examples](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/retrievers-examples)


| Retriever                  | Role                                              |
| -------------------------- | ------------------------------------------------- |
| `standard`                 | Classic Query DSL leaf                            |
| `knn`                      | Vector first-stage                                |
| `rrf`                      | Fuse ranks from children                          |
| `linear`                   | Weighted score combination / normalization        |
| `rule`                     | Pin/exclude via query rulesets (prefer outermost) |
| `text_similarity_reranker` | Second-stage semantic reorder                     |


Hybrid sketch:

```json
GET products/_search
{
  "retriever": {
    "rrf": {
      "retrievers": [
        { "standard": { "query": { "match": { "name": "blue trail shoe" } } } },
        { "knn": { "field": "embedding", "query_vector": [0.1, 0.2], "k": 50, "num_candidates": 100 } }
      ],
      "rank_window_size": 50
    }
  }
}
```

---

## E9 · Rolling restart & task management

**Docs:** [Rolling restart procedures](https://www.elastic.co/docs/deploy-manage/maintenance/start-stop-services/full-cluster-restart-rolling-restart-procedures) · [Tasks API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-tasks-list) · [Hot threads](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-nodes-hot-threads)

### Rolling restart mindset

1. Disable shard allocation / use documented restart sequence for your version
2. Stop one node, upgrade/restart, wait green/yellow as documented
3. Re-enable allocation
4. Repeat

Never restart all data nodes together unless you accept full-cluster restart semantics.

### Tasks & hot threads

```bash
GET _tasks?detailed&actions=*search*,*reindex*,*indices:data/write*
GET _nodes/hot_threads
```

Cancel runaway tasks when safe (`POST _tasks/TASK_ID/_cancel`). Hot threads show where CPU actually burns (search, merge, refresh, GC noise).

---

## E10 · Remote clusters security (CCS/CCR)

**Docs:** [Remote cluster security models](https://www.elastic.co/docs/deploy-manage/remote-clusters/security-models) · [Cross-cluster API key](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-cross-cluster-api-key) · [Remote clusters settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/remote-clusters) · [CCS](https://www.elastic.co/docs/explore-analyze/cross-cluster-search) · [CCR](https://www.elastic.co/docs/deploy-manage/tools/cross-cluster-replication)

Modern model: **cross-cluster API key** on remote → store encoded key in local keystore as `cluster.remote.<alias>.credentials` → optional further reduce with local user `remote_indices` privileges. Certificate model is legacy. Least privilege on the API key itself; never share unrestricted remote keys.

---

## E11 · Serverless / Cloud vs self-managed differences

**Docs:** [Differences from other offerings](https://www.elastic.co/docs/deploy-manage/deploy/elastic-cloud/differences-from-other-elasticsearch-offerings) · [Deployment options](https://www.elastic.co/docs/get-started/deployment-options)


| Concern          | Self-managed | Cloud Hosted        | Serverless                                             |
| ---------------- | ------------ | ------------------- | ------------------------------------------------------ |
| Shards/nodes     | You own      | Guided / autoscaled | Abstracted                                             |
| ILM / tiers      | Full         | Full (managed UX)   | Prefer data stream lifecycle; many hardware knobs gone |
| Bootstrap checks | Your problem | Elastic's platform  | N/A to you                                             |
| Settings surface | Widest       | Large               | Restricted subset                                      |


Don't copy self-managed runbooks blindly onto Serverless — many node/shard levers aren't yours.

---

## E12 · Reindex patterns (local & remote)

**Docs:** [Reindex API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-reindex)

```json
POST _reindex?slices=auto&wait_for_completion=false
{
  "source": { "index": "products-v1" },
  "dest": { "index": "products-v2", "op_type": "create" },
  "script": {
    "source": "ctx._source.remove('legacy_field')"
  }
}
```

Tips: destination with `refresh_interval=-1` and `number_of_replicas=0` during load, then restore; use aliases for cutover; remote reindex needs `reindex.remote.whitelist` and credentials; throttle with `requests_per_second`.

---

## E13 · What is still "left" after this course?

Part VI covers highlighting, suggesters, collapse, OCC, filtered aliases, and ELSER/semantic_text.

### Still optional / niche

1. Autoscaling policies (Cloud/ECK) concrete YAML/API
2. ML anomaly detection job lifecycle end-to-end
3. Index / peer recovery settings tuning
4. Voting config exclusions for master maintenance
5. Application privileges for Kibana custom apps
6. `pattern_text` / newest LogsDB features as they evolve

### Not missing — just not duplicated here

Full parameter reference for every API · every agg option · every security realm screen · every Beats module · Kibana visualization tutorials

**Bottom line:** Elasticsearch **engine** learning path here is complete. Remaining work is niche ops knobs or separate Elastic **product** courses (Observability/Security/Kibana/Fleet).

---

---

# PART VI - SPECIALTY LABS

> High-leverage app features: highlighting, autocomplete, collapse, concurrency, filtered aliases, and semantic/ELSER.

---

## S1 · Highlighting modes

**Learning objective:** return match fragments for UI without accidental full-field loads.

**Docs:** [Highlighting](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/highlighting)


| Type       | When                                                                |
| ---------- | ------------------------------------------------------------------- |
| `unified`  | Default for most `text` / `keyword` highlighting                    |
| `plain`    | Simpler highlighter that analyzes for highlights                    |
| `fvh`      | Fast vector highlighter - needs term vectors with positions/offsets |
| `semantic` | For `semantic` / `semantic_text` fields                             |


```json
GET catalog/_search
{
  "query": { "match": { "description": "waterproof trail" } },
  "highlight": {
    "fields": {
      "description": { "type": "unified", "number_of_fragments": 2, "fragment_size": 120 }
    }
  }
}
```

Highlighting needs stored fields or `_source`. Complex boolean queries can highlight fragments that are imperfect mirrors of the boolean logic - treat snippets as UX aids.

---

## S2 · Completion suggester vs `search_as_you_type`

**Learning objective:** choose the right autocomplete tool for typeahead vs query-as-you-type.

**Docs:** [Completion field](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/completion) · [Suggesters](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-suggesters) · [search_as_you_type](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/search-as-you-type)


| Approach                     | Best for                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| `completion`                 | Fast prefix navigation / typeahead from a dedicated suggest field |
| `search_as_you_type`         | As-you-type matching inside normal search mappings                |
| `term` / `phrase` suggesters | Did-you-mean / spelling - not navigation                          |


```json
PUT /products_suggest
{
  "mappings": {
    "properties": {
      "name": { "type": "search_as_you_type" },
      "name_suggest": { "type": "completion" }
    }
  }
}
```

Completion is optimized for speed (often best with careful shard sizing). Use context suggesters when suggestions must be filtered by brand/category.

---

## S3 · Collapse and inner_hits

**Learning objective:** show one result per group (host, brand, product) and optionally expand the group.

**Docs:** [Collapse](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/collapse-search-results) · [Inner hits](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrieve-inner-hits)

```json
GET logs/_search
{
  "query": { "match": { "message": "timeout" } },
  "collapse": {
    "field": "host.name",
    "inner_hits": {
      "name": "recent",
      "size": 3,
      "sort": [{ "@timestamp": "desc" }]
    }
  },
  "sort": [{ "@timestamp": "desc" }]
}
```

Collapse fields must be single-valued. Inner hits cost extra searches - keep sizes small. Collapse does not work with scroll.

---

## S4 · Optimistic concurrency control

**Learning objective:** avoid lost updates using sequence numbers and primary terms.

**Docs:** [Optimistic concurrency control](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/optimistic-concurrency-control) · [Update API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-update)

```json
GET catalog/_doc/1

POST catalog/_update/1?if_seq_no=SEQ&if_primary_term=TERM
{
  "doc": { "price": 119.99 }
}
```

On `version_conflict_engine_exception`, re-read and retry with backoff. External versioning is a different contract - do not mix casually. Some TSDS settings disable sequence numbers for storage efficiency; OCC assumptions change there.

---

## S5 · Filtered aliases for multi-tenant views

**Learning objective:** present tenant-scoped read views without proliferating indices - and know the security limits.

**Docs:** [Aliases](https://www.elastic.co/docs/manage-data/data-store/aliases) · [Update aliases API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-update-aliases)

```json
POST /_aliases
{
  "actions": [{
    "add": {
      "index": "orders",
      "alias": "orders_acme",
      "filter": { "term": { "tenant_id": "acme" } }
    }
  }]
}
```

Filtered aliases are excellent UX/guardrails for trusted apps. They are **not** a full replacement for [document-level security](https://www.elastic.co/docs/deploy-manage/users-roles/cluster-or-deployment-auth/controlling-access-at-document-field-level) against hostile users. The filter does not rewrite stored `_source` on write.

---

## S6 · ELSER / inference / `semantic_text`

**Learning objective:** stand up semantic retrieval with Elastic inference instead of hand-managing vectors first.

**Docs:** [Semantic search](https://www.elastic.co/docs/solutions/search/semantic-search) · [semantic_text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text) · [Setup & configuration](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text-setup-configuration) · [Elastic Inference](https://www.elastic.co/docs/explore-analyze/elastic-inference) · [Inference APIs](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-inference)

### Practical path

1. Ensure an inference endpoint exists on your deployment (ELSER / EIS / supported third-party).
2. Map a `semantic_text` field (or explicit sparse/dense fields if you must).
3. Index plain text - chunking/embeddings are handled for `semantic_text`.
4. Query with a `semantic` query and/or hybrid [retrievers](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers).
5. Always add metadata filters (tenant, product, ACL).
6. Prefer hybrid RRF before elaborate manual score scripts.

Watch model allocation, ingest latency, and license/deployment differences between Serverless and self-managed.

---

# Appendix · Topic → docs (quick)


| Topic                    | URL                                                                                                                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                 | [https://www.elastic.co/docs/reference/elasticsearch](https://www.elastic.co/docs/reference/elasticsearch)                                                                                                                                                 |
| NRT / segments / refresh | [https://www.elastic.co/docs/manage-data/data-store/near-real-time-search](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search)                                                                                                       |
| Write/read replication   | [https://www.elastic.co/docs/deploy-manage/distributed-architecture/reading-and-writing-documents](https://www.elastic.co/docs/deploy-manage/distributed-architecture/reading-and-writing-documents)                                                       |
| Translog                 | [https://www.elastic.co/docs/reference/elasticsearch/index-settings/translog](https://www.elastic.co/docs/reference/elasticsearch/index-settings/translog)                                                                                                 |
| Merge                    | [https://www.elastic.co/docs/reference/elasticsearch/index-settings/merge](https://www.elastic.co/docs/reference/elasticsearch/index-settings/merge)                                                                                                       |
| Circuit breakers         | [https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/circuit-breaker-settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/circuit-breaker-settings)                                               |
| Thread pools             | [https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/thread-pool-settings](https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/thread-pool-settings)                                                       |
| Mapping                  | [https://www.elastic.co/docs/manage-data/data-store/mapping](https://www.elastic.co/docs/manage-data/data-store/mapping)                                                                                                                                   |
| Field types              | [https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/field-data-types](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/field-data-types)                                                                           |
| Query DSL                | [https://www.elastic.co/docs/explore-analyze/query-filter/languages/querydsl](https://www.elastic.co/docs/explore-analyze/query-filter/languages/querydsl)                                                                                                 |
| Aggregations             | [https://www.elastic.co/docs/explore-analyze/query-filter/aggregations](https://www.elastic.co/docs/explore-analyze/query-filter/aggregations)                                                                                                             |
| Retrievers               | [https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers)                                                                                                       |
| ES|QL                    | [https://www.elastic.co/docs/reference/query-languages/esql](https://www.elastic.co/docs/reference/query-languages/esql)                                                                                                                                   |
| Vectors                  | [https://www.elastic.co/docs/solutions/search/vector/knn](https://www.elastic.co/docs/solutions/search/vector/knn)                                                                                                                                         |
| ILM                      | [https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management](https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management)                                                                                               |
| Security                 | [https://www.elastic.co/docs/deploy-manage/security](https://www.elastic.co/docs/deploy-manage/security)                                                                                                                                                   |
| Resiliency               | [https://www.elastic.co/guide/en/elasticsearch/resiliency/current/index.html](https://www.elastic.co/guide/en/elasticsearch/resiliency/current/index.html)                                                                                                 |
| REST APIs                | [https://www.elastic.co/docs/api/doc/elasticsearch/](https://www.elastic.co/docs/api/doc/elasticsearch/)                                                                                                                                                   |
| Logsdb                   | [https://www.elastic.co/docs/manage-data/data-store/data-streams/logs-data-stream](https://www.elastic.co/docs/manage-data/data-store/data-streams/logs-data-stream)                                                                                       |
| TSDS                     | [https://www.elastic.co/docs/manage-data/data-store/data-streams/time-series-data-stream-tsds](https://www.elastic.co/docs/manage-data/data-store/data-streams/time-series-data-stream-tsds)                                                               |
| Columnar                 | [https://www.elastic.co/docs/manage-data/data-store/columnar](https://www.elastic.co/docs/manage-data/data-store/columnar)                                                                                                                                 |
| Searchable snapshots     | [https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/searchable-snapshots](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/searchable-snapshots)                                                                     |
| Downsampling             | [https://www.elastic.co/docs/manage-data/data-store/data-streams/downsampling-time-series-data-stream](https://www.elastic.co/docs/manage-data/data-store/data-streams/downsampling-time-series-data-stream)                                               |
| Failure store            | [https://www.elastic.co/docs/manage-data/data-store/data-streams/failure-store](https://www.elastic.co/docs/manage-data/data-store/data-streams/failure-store)                                                                                             |
| Percolator               | [https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/percolator](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/percolator)                                                                                       |
| Search templates         | [https://www.elastic.co/docs/solutions/search/search-templates](https://www.elastic.co/docs/solutions/search/search-templates)                                                                                                                             |
| Rank eval                | [https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-rank-eval](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-rank-eval)                                                                                         |
| Painless contexts        | [https://www.elastic.co/docs/reference/scripting-languages/painless/painless-contexts](https://www.elastic.co/docs/reference/scripting-languages/painless/painless-contexts)                                                                               |
| DLS/FLS                  | [https://www.elastic.co/docs/deploy-manage/users-roles/cluster-or-deployment-auth/controlling-access-at-document-field-level](https://www.elastic.co/docs/deploy-manage/users-roles/cluster-or-deployment-auth/controlling-access-at-document-field-level) |
| Bootstrap checks         | [https://www.elastic.co/docs/deploy-manage/deploy/self-managed/bootstrap-checks](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/bootstrap-checks)                                                                                           |
| Important settings       | [https://www.elastic.co/docs/deploy-manage/deploy/self-managed/important-settings-configuration](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/important-settings-configuration)                                                           |
| EQL                      | [https://www.elastic.co/docs/explore-analyze/query-filter/languages/eql](https://www.elastic.co/docs/explore-analyze/query-filter/languages/eql)                                                                                                           |
| Alerting                 | [https://www.elastic.co/docs/explore-analyze/alerting](https://www.elastic.co/docs/explore-analyze/alerting)                                                                                                                                               |
| Clients                  | [https://www.elastic.co/docs/reference/elasticsearch-clients](https://www.elastic.co/docs/reference/elasticsearch-clients)                                                                                                                                 |
| Rally                    | [https://esrally.readthedocs.io/en/stable/](https://esrally.readthedocs.io/en/stable/)                                                                                                                                                                     |
| Ingest processors        | [https://www.elastic.co/docs/reference/enrich-processor](https://www.elastic.co/docs/reference/enrich-processor)                                                                                                                                           |
| ILM                      | [https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management](https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management)                                                                                               |
| SLM                      | [https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-slm-put-lifecycle](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-slm-put-lifecycle)                                                                         |
| Transforms               | [https://www.elastic.co/docs/explore-analyze/transforms](https://www.elastic.co/docs/explore-analyze/transforms)                                                                                                                                           |
| Enrich                   | [https://www.elastic.co/docs/manage-data/ingest/transform-enrich/data-enrichment](https://www.elastic.co/docs/manage-data/ingest/transform-enrich/data-enrichment)                                                                                         |
| PIT                      | [https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-open-point-in-time](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-open-point-in-time)                                                                       |
| Async search             | [https://www.elastic.co/docs/solutions/search/async-search-api](https://www.elastic.co/docs/solutions/search/async-search-api)                                                                                                                             |
| Synonyms API             | [https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-synonyms](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-synonyms)                                                                                                     |
| Remote cluster security  | [https://www.elastic.co/docs/deploy-manage/remote-clusters/security-models](https://www.elastic.co/docs/deploy-manage/remote-clusters/security-models)                                                                                                     |
| Rolling restart          | [https://www.elastic.co/docs/deploy-manage/maintenance/start-stop-services/full-cluster-restart-rolling-restart-procedures](https://www.elastic.co/docs/deploy-manage/maintenance/start-stop-services/full-cluster-restart-rolling-restart-procedures)     |
| Offering differences     | [https://www.elastic.co/docs/deploy-manage/deploy/elastic-cloud/differences-from-other-elasticsearch-offerings](https://www.elastic.co/docs/deploy-manage/deploy/elastic-cloud/differences-from-other-elasticsearch-offerings)                             |
| Graph                    | [https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-graph](https://www.elastic.co/docs/api/doc/elasticsearch/group/endpoint-graph)                                                                                                           |


---

## Key takeaways

- Treat this as a **course**: learn the lesson, run the lab, open the docs link when you implement.
- **Internals first:** refresh/flush/translog/merge, primary-backup, heap vs page cache, breakers, thread pools.
- **Syllabus second:** Part II maps every major capability to its official page.
- **Labs third:** Parts III–V turn that map into worked requests, runbooks, and failure-mode lessons.
- **Production last mile:** explicit mappings, filter context, lifecycle, snapshots, security, and measured changes (Rally) - not folklore.

The docs links are the source of truth; this course is how you learn to navigate them.