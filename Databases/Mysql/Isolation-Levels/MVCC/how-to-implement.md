how to implement mvcc usijg node mysql2

# Node.js MySQL MVCC Demonstration

👉 You don't **manually implement MVCC** in MySQL — it's **built into InnoDB**. What you *can* do in Node.js (`mysql2`) is **control the isolation level** of your transactions to demonstrate how MVCC behaves (READ COMMITTED vs REPEATABLE READ).

I'll show you how to simulate MVCC behavior with **two concurrent transactions** in Node.js.

## 📌 Setup

```bash
npm install mysql2
```

Schema:

```sql
CREATE TABLE accounts (
  id INT PRIMARY KEY,
  balance INT
);

INSERT INTO accounts VALUES (1, 500);
```

## 📌 Node.js Example: Demonstrating MVCC

```javascript
const mysql = require('mysql2/promise');

async function mvccExample() {
  const connA = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'testdb' });
  const connB = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'testdb' });

  // Txn A: REPEATABLE READ (default in MySQL)
  await connA.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connA.beginTransaction();

  // Txn B: REPEATABLE READ (another client)
  await connB.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connB.beginTransaction();

  try {
    // Transaction A: first read
    const [rowsA1] = await connA.query("SELECT balance FROM accounts WHERE id=1");
    console.log("Txn A first read:", rowsA1[0].balance); // 500

    // Transaction B: update the same row
    await connB.query("UPDATE accounts SET balance = 400 WHERE id=1");
    await connB.commit();
    console.log("Txn B committed update → balance=400");

    // Transaction A: second read (same transaction snapshot!)
    const [rowsA2] = await connA.query("SELECT balance FROM accounts WHERE id=1");
    console.log("Txn A second read:", rowsA2[0].balance); // still 500 (snapshot view)

    await connA.commit();
  } catch (err) {
    console.error("Error:", err.message);
    await connA.rollback();
    await connB.rollback();
  } finally {
    await connA.end();
    await connB.end();
  }
}

mvccExample();
```

## 📌 What This Shows

* **Txn A** starts at `REPEATABLE READ`.
  * First read: sees balance = 500.
* **Txn B** updates balance → commits new value = 400.
* **Txn A's second read** still shows 500 (old snapshot) → this is **MVCC in action**.

👉 Why?
* At transaction start, InnoDB gave Txn A a **snapshot** of committed data.
* Later changes by Txn B don't affect Txn A until it commits.
* Old version of row (balance=500) is read from **undo log**.

## 📌 To See READ COMMITTED Behavior

Just change isolation for Txn A:

```javascript
await connA.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
```

* First read → 500.
* Txn B commits update to 400.
* Second read → **400** (fresh read each statement).

👉 MVCC snapshot is **per statement**, not per transaction.

## 🎯 Interview-Safe Answer

In Node.js with mysql2, you don't manually implement MVCC — InnoDB does it internally with undo logs and transaction IDs. What you do is control the isolation level of your transactions. For example, in REPEATABLE READ, two SELECTs inside the same transaction will always return the same snapshot even if another transaction updates the row in between. In READ COMMITTED, each SELECT sees the latest committed value. This difference is how MVCC manifests in MySQL.