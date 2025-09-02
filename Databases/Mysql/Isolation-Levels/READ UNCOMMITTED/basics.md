# READ UNCOMMITTED Isolation Level

## 1. READ UNCOMMITTED

* **Lowest isolation level.**
* Transactions can see **uncommitted changes** from other transactions.
* Allows **dirty reads**.

## ❌ Problem: Dirty Read

* Transaction A updates a row but hasn't committed yet.
* Transaction B reads that uncommitted row.
* If A rolls back → B saw invalid data.

## Example

```javascript
// Transaction A
await conn.query("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED");
await conn.beginTransaction();
await conn.query("UPDATE accounts SET balance = balance - 100 WHERE id = 1");
// not committed yet

// Transaction B (running concurrently)
await conn2.query("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED");
await conn2.beginTransaction();
const [rows] = await conn2.query("SELECT balance FROM accounts WHERE id = 1");
console.log("B sees:", rows); // sees reduced balance, even if A rolls back
```

👉 Dangerous, rarely used in production.