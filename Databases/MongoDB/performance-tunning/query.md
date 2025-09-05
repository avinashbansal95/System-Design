# MongoDB Performance Guide: Query Patterns & Best Practices

## What to prefer vs avoid (query operators & patterns)

### Filters (find)

#### ✅ Use `=`, `$in` (small sets), `$gt`/`$gte`/`$lt`/`$lte`, `$exists`, `$elemMatch`
These are index-friendly when the indexed field is on the left and not wrapped by functions.

#### ⚠️ Be careful with `$or`
- **Good** if each clause is selective and has an index (Mongo can do index intersection).
- If clauses are broad → can degrade to many scans; consider splitting queries or redesigning indexes.

#### ⚠️ Be careful with `$in` for large arrays 
(hundreds/thousands of values) → prefer batching or pre-computed lookup tables (e.g., store a "bucket" field).

#### ❌ Avoid `$ne`, `$nin`, `$not` for primary filters
Non-sargable; typically kills index selectivity and forces many reads. If you have to, combine with another positive, selective predicate that is indexed.

#### ❌ Avoid `$regex` with leading wildcard (`/^.*x/` or `/foo/i` without anchor)
Unindexable → collection scan. Prefer:
- Prefix regex like `/^foo/` (uses index).
- `$text` with a text index for full-text search.
- External search (ES/OpenSearch) for complex cases.

#### ⚠️ Be careful with `$where` and `$expr`
These run server-side JS/expressions over rows → generally can't use indexes. Try to rewrite to plain operators; precompute values at write time if needed.

### Arrays

#### ✅ Use `$elemMatch` to bind multiple conditions to the same array element
(keeps index usefulness).

#### ✅ Compound multikey indexes are fine
But remember: queries that need multiple array fields simultaneously can reduce index efficiency; consider schema tweak (embed together) or computed field.

### Sorting & pagination

#### ✅ Sort on an index
(either the filter index's suffix or a dedicated compound index).

#### ✅ Use keyset pagination
```javascript
find({_id: {$gt: lastSeenId}}).sort({_id:1}).limit(N)
```

#### ❌ Avoid heavy skip on large offsets
(server must walk and discard).

### Projections

#### ✅ Project only needed fields
(covered queries = faster: index contains all projected fields).

Create covered queries with a compound index that includes filter + sort + projected fields (as prefix + `{"field": 1, "_id": 0}` if you don't need `_id`).

### Write patterns

#### ✅ Use bulk writes (`bulkWrite`) for batches
Avoid N round-trips.

#### ✅ Prefer idempotent upserts with `$setOnInsert` + `$set`

### Indexes

#### ✅ Prefer compound indexes that match your common query shapes
(exact equality fields first, then ranges, then sort).

#### ✅ Use partial indexes instead of sparse for targeted subsets
(e.g., `{active: true}`) when queries include that predicate.

#### ✅ Consider TTL indexes for expiring data

#### ✅ For heterogeneous fields, wildcard indexes
(`{"$**": 1}` or field-scoped) can help, but monitor size.

### Aggregation performance

#### ✅ Push `$match` → `$project` as early as possible to shrink documents

#### ✅ Use `$indexStats` to see index usage

#### ✅ Replace expensive `$unwind` + `$group` with `$setWindowFields`
(windowed sums/counts) when appropriate.

#### ✅ Materialize heavy/expensive computations at write time
(computed fields) if read throughput dominates.

#### ❌ Avoid `$lookup` that joins huge unindexed collections
Ensure the localField/foreignField is indexed on the foreign side and consider pipeline `$lookup` with `$match` early.

### Geo & text

#### ✅ Prefer 2dsphere indexes for modern geo
Use `$near`/`$geoNear` with an index.

#### ✅ Prefer `$text` + text indexes for search

#### ❌ Avoid ad-hoc substring regex for search
(see above).

## Deprecated / discouraged → use instead (querying & pipeline)

| ❌ Avoid | ✅ Use Instead |
|----------|----------------|
| `$where` (server-side JS) | Rewrite with native operators, or precompute fields |
| `eval` command (removed) | Move logic to app / aggregation |
| `db.collection.group()` (old group) | Aggregation with `$group` |
| Map-Reduce (deprecated) | Aggregation pipeline (`$group`, `$accumulator`, `$function` if absolutely necessary) |
| `$pushAll` (very old) | `$push` with `$each` |
| `$geoNear` command (legacy) | Aggregation stage `$geoNear` (must be first stage) or use query with `$near` and proper index |
| `maxScan`/`$maxScan` (deprecated option) | Use better predicates or `hint()` with appropriate index |
| `ensureIndex` shell helper (legacy) | `createIndex` |

### ⚠️ Often misused patterns:
- **Sparse indexes** often misused → ✅ Prefer partial indexes with explicit filter expressions.
- **findAndModify** (command) is still there, but drivers prefer helpers → ✅ `findOneAndUpdate`/`Replace`/`Delete` (more ergonomic).
- **Old 2d geo** for spherical calcs → ✅ Use 2dsphere unless you truly need 2-D plane.

*(Exact deprecation timing varies by version, but the "use instead" column is safe on 4.4–7.0 lines.)*

## Quick "smell test" for slow queries

1. Can every predicate in your leading `$match` be served by an index (no `$not`/`$nin`/`$ne`, no leading-wildcard regex, no `$expr`/`$where`)?

2. Does your sort align with an index (or is it re-sorting large result sets)?

3. Are you projecting only needed fields (aim for covered when possible)?

4. Is the cardinality high on leading index fields (avoid low-cardinality first keys like status alone)?

5. Did you check `explain("executionStats")` → look at:
   - `winningPlan.inputStage.stage` (COLLSCAN vs IXSCAN)
   - `nReturned` vs `totalDocsExamined` / `totalKeysExamined` (aim for low examined/returned ratios)
   - For aggregation: `$cursor` stage to confirm index usage

## Handy replacements (mini cheat sheet)

| Problem Pattern | Better Approach |
|-----------------|-----------------|
| Regex contains search | Text index (`$text`) or external search |
| Negative filters (`$ne`/`$nin`/`$not`) | Invert logic to positive selective predicates (e.g., pre-label rows you want with a boolean and query that) |
| Big `$or` | Refactor to selective `$and`+compound index, or split into multiple queries |
| Heavy skip/limit paging | Keyset paging using a stable, indexed key |