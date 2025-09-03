# MySQL AND Query Index Usage Guide

## Query with `AND`

```sql
SELECT * 
FROM users 
WHERE email = 'a@x.com' AND phone = '12345';
```

**Indexes:**
* `idx_email` on `email`
* `idx_phone` on `phone`

## How MySQL Handles It

👉 The `AND` condition means:
* MySQL must find rows where **both conditions are true** (same row).
* This is **more restrictive** than `OR`.

### Case 1: Single-Column Indexes Only (`idx_email`, `idx_phone`)

* MySQL can use **one index efficiently**, then apply the second condition as a filter.
* It usually picks the **more selective index** (the one that filters out the most rows).

**Example:**

```sql
EXPLAIN SELECT * FROM users 
WHERE email = 'a@x.com' AND phone = '12345';
```

**Possible output:**

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|-------|
| 1 | SIMPLE | users | ref | idx_email, idx_phone | idx_email | 1 | Using where |

👉 **Meaning:**
* MySQL uses `idx_email` to find rows where `email = 'a@x.com'`.
* Then applies `phone = '12345'` as a **filter**.

⚠️ Even though `idx_phone` exists, MySQL does **not** use both — it chooses one.

### Case 2: Composite Index (`(email, phone)`)

If you create:

```sql
CREATE INDEX idx_email_phone ON users(email, phone);
```

Then MySQL can use the index for **both conditions together**:

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|-------|
| 1 | SIMPLE | users | ref | idx_email_phone | idx_email_phone | 1 | Using index |

👉 **Meaning:**
* MySQL does an **index lookup on both columns** together.
* Super efficient → **1 row fetch**.

## Comparison: `OR` vs `AND`

| Condition | Index Usage | Behavior |
|-----------|-------------|----------|
| `email = 'a@x.com' OR phone = '12345'` | MySQL may use **index merge** (`idx_email ∪ idx_phone`) | Fetches rows from both indexes, merges results → can be costly at scale. |
| `email = 'a@x.com' AND phone = '12345'` | MySQL picks **one index** and filters, unless you have a **composite index** | With composite `(email, phone)` → super efficient lookup. |

## Final Answer

* **With `AND`:**
   * If you only have **separate indexes**: MySQL picks one index (the more selective one) and applies the other condition as a filter.
   * If you have a **composite index (email, phone)**: MySQL uses it directly → fastest.

* **With `OR`:**
   * MySQL may use **index merge** (both indexes combined) or fall back to full table scan.