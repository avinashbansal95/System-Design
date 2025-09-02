# 📌 2. READ COMMITTED

* **Most common in RDBMS** (Oracle, PostgreSQL).
* A query sees only **committed data**.
* Prevents **dirty reads**.
* But **non-repeatable reads** still possible.

## ❌ Problem: Non-Repeatable Read

* Transaction A reads a row.
* Transaction B commits an update to the same row.
* Transaction A reads the same row again → gets a different result.

## Example

```javascript
// Transaction A
await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
await conn.beginTransaction();
const [r1] = await conn.query("SELECT balance FROM accounts WHERE id = 1");
console.log("A first read:", r1);
// meanwhile Transaction B commits: UPDATE accounts SET balance = balance - 100
const [r2] = await conn.query("SELECT balance FROM accounts WHERE id = 1");
console.log("A second read:", r2); // different than r1 → non-repeatable read
```

👉 Solves dirty reads, but still inconsistent for multiple reads.