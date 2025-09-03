# MySQL OR Query Index Merge Guide

## Query in Question

```sql
SELECT * 
FROM users 
WHERE email = 'a@x.com' OR phone = '12345';
```

**Indexes:**
* `idx_email` on `email`
* `idx_phone` on `phone`

## Will Indexes Be Used?

👉 **Yes, they *can* be used** through MySQL's **index merge** optimization.

When you run `EXPLAIN`, you'll likely see:

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|-------|
| 1 | SIMPLE | users | index_merge | idx_email, idx_phone | idx_email, idx_phone | 2 | Using union(idx_email, idx_phone); Using where |

**This means:**
* MySQL looks up matching rows in `idx_email`.
* Looks up matching rows in `idx_phone`.
* Merges the two result sets.

So **both indexes are being used** ✅.

## Performance Considerations (Long-Term)

### 1. When Conditions Are Very Selective (few rows matched):
* **Example:** `email = 'a@x.com'` matches **1 row**, `phone = '12345'` matches **2 rows**.
* Index merge is **very efficient**.
* Long-term performance: **good** (index lookups scale well).

### 2. When Conditions Are Not Selective (many rows matched):
* **Example:** `phone = '12345'` matches **100k rows**.
* Index merge still works, but now merging large sets = heavy.
* Optimizer may decide: "Full table scan is cheaper."
* Long-term performance: **bad** (query time grows with table size).

### 3. If Dataset Becomes Huge (millions of users):
* Index merge adds overhead since MySQL must fetch rows from **two indexes + merge**.
* A **UNION rewrite** is often faster:

```sql
SELECT * FROM users WHERE email = 'a@x.com'
UNION
SELECT * FROM users WHERE phone = '12345';
```

* Each part uses its **own index efficiently**.
* Optimizer doesn't need to guess → performance is more predictable at scale.

## Final Answer

* ✅ Yes, in your example **indexes are being used** (via **index merge**).
* Long-term performance depends on **selectivity**:
   * If both filters match **few rows** → performance is good.
   * If either filter matches **many rows** → optimizer may switch to full table scan → performance degrades.
* For **predictable, scalable performance**, rewrite with `UNION` instead of `OR`.