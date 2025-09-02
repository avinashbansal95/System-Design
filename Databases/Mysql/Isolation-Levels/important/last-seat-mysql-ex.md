# The "Last Seat" Problem in MySQL (REPEATABLE READ, No `FOR UPDATE`)

## 📌 Scenario

Only **1 seat left** in table `seats`.

```
id | status
---+---------
 1 | free
```

## Transaction A (Node.js, MySQL, no FOR UPDATE)

```sql
START TRANSACTION;
SELECT status FROM seats WHERE id=1; -- Sees "free"
-- does some logic...
```

## Transaction B runs concurrently

```sql
START TRANSACTION;
UPDATE seats SET status='booked' WHERE id=1;
COMMIT;
```

* Seat is **actually booked now**.

## Transaction A continues (still running on old snapshot)

```sql
UPDATE seats SET status='booked' WHERE id=1;
COMMIT;
```

## ❌ What Happened?

* Transaction A never saw B's update because of **snapshot isolation** (REPEATABLE READ).
* It thinks seat=free, so it proceeds to book.
* After commit, both transactions claim to have booked the seat → **overbooking**.

## 📌 Why This Happens

* InnoDB's **MVCC snapshot** means:
  * Reads see data as of transaction start.
  * You don't see mid-transaction updates from others.
* But **updates don't use snapshots** → they operate on the latest row version.
* So both transactions can end up successfully updating the same seat, unless you add locks or constraints.

## 📌 Correct Fix: Lock the Row

```sql
SELECT status FROM seats WHERE id=1 FOR UPDATE;
```

* This puts a lock on seat `id=1`.
* If Transaction A holds the lock, Transaction B must **wait**.
* After A commits/rolls back, B re-checks status → sees it's already booked → fails gracefully.

## 📌 So Answering Your Concern

Yes — under MySQL's default REPEATABLE READ, if you forget `FOR UPDATE`, two concurrent transactions can both think the last seat is free and both try to book it. This happens because snapshot isolation hides other commits until you commit. So you **must** use explicit row locks (`FOR UPDATE`) or unique constraints to enforce correctness in booking systems.

## 🎯 Interview-Safe Answer

MySQL's default REPEATABLE READ prevents dirty and non-repeatable reads, but it does not prevent lost updates in workflows like seat booking. If two users check for the last available seat in separate transactions, both can see it as "free" and both may book it, because they are reading from their own snapshot. The fix is to explicitly lock rows (`SELECT … FOR UPDATE`) or enforce uniqueness with constraints. Without that, REPEATABLE READ can still allow incorrect business outcomes.