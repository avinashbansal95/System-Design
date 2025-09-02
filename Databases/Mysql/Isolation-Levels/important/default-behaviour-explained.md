# Last Seat Booking: MySQL vs PostgreSQL Isolation Levels

Perfect 👌 — let's replay the **"last seat booking"** example in both **Postgres** and **MySQL**, under their default isolation levels, and then compare.

## 📌 Setup

Table:

```sql
CREATE TABLE seats (
  id INT PRIMARY KEY,
  status TEXT
);

-- Only 1 seat left
INSERT INTO seats VALUES (1, 'free');
```

## 📌 1. MySQL (Default = REPEATABLE READ)

**Transaction A**

```sql
START TRANSACTION;
SELECT status FROM seats WHERE id=1; 
-- Sees "free"
```

**Transaction B (runs concurrently)**

```sql
START TRANSACTION;
UPDATE seats SET status='booked' WHERE id=1;
COMMIT;
```

**Back to Transaction A**

```sql
UPDATE seats SET status='booked' WHERE id=1;
COMMIT;
```

👉 **Result in MySQL**:
* Transaction A was running on a snapshot → still thought seat=free.
* Transaction B committed update, but A didn't see it.
* Both transactions succeed → **overbooking possible** ❌

## 📌 2. Postgres (Default = READ COMMITTED)

**Transaction A**

```sql
BEGIN;
SELECT status FROM seats WHERE id=1;
-- Sees "free"
```

**Transaction B (runs concurrently)**

```sql
BEGIN;
UPDATE seats SET status='booked' WHERE id=1;
COMMIT;
```

**Back to Transaction A**

```sql
UPDATE seats SET status='booked' WHERE id=1;
-- ERROR: could not serialize access due to concurrent update
ROLLBACK;
```

👉 **Result in Postgres**:
* Snapshot is **per statement** (READ COMMITTED).
* By the time A runs the UPDATE, it re-checks the row and sees it was already modified by B.
* Postgres throws a **write conflict error**, so only one booking succeeds ✅.

## 📌 3. Postgres (REPEATABLE READ, explicitly set)

If we set:

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

Then Postgres behaves **like MySQL**:
* Transaction A sees "free" from snapshot and keeps believing it until commit.
* Without row locking, both could book.
* ❌ Same overbooking problem as MySQL default.

## 📌 4. Key Difference

| DB/Isolation | Behavior in Seat Booking Without `FOR UPDATE` |
|--------------|-----------------------------------------------|
| MySQL (default = RR) | Both can book → overbooking ❌ |
| Postgres (default = RC) | Second update fails with conflict ✅ |
| Postgres (RR) | Same as MySQL → overbooking ❌ |
| Both (with `FOR UPDATE`) | Safe: one txn waits, other wins ✅ |

## 🎯 Interview-Safe Answer

In MySQL's default **REPEATABLE READ**, two transactions can both see the last seat as free (snapshot isolation) and both book it, leading to overbooking unless you use `FOR UPDATE`. 

In contrast, Postgres defaults to **READ COMMITTED**, where each statement sees the latest committed data. So if one transaction books the seat, the other transaction's UPDATE will fail with a conflict. 

If you explicitly set Postgres to REPEATABLE READ, it behaves like MySQL. 

In practice, for correctness in either database, you should explicitly lock rows (`SELECT … FOR UPDATE`) or use unique constraints.