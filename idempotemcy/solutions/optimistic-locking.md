# Optimistic Locking Patterns for Idempotent Operations

## Scenario A: Payment confirmation on an order (set a terminal state once)

**Goal:** Confirm an order payment exactly once. Retries (same request) return the same result. Concurrent confirmations don't double-apply.

### Table

```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  status ENUM('PENDING','PAID','CANCELLED') NOT NULL DEFAULT 'PENDING',
  payment_ref VARCHAR(100) DEFAULT NULL,     -- gateway reference
  version INT NOT NULL DEFAULT 0,            -- <— optimistic locking
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_payment_ref (payment_ref)  -- defense-in-depth (optional)
) ENGINE=InnoDB;
```

### Flow

1. Read the order (get its version and status).
2. If already PAID with the same `payment_ref`, return 200 (idempotent success).
3. Else try an optimistic update:

```sql
UPDATE orders
SET status='PAID', payment_ref=?, version=version+1
WHERE id=? AND status IN ('PENDING') AND version=?;
```

4. If `affectedRows=1` → success (you won the race).
5. If `affectedRows=0` → someone else updated first; re-read:
   - If now PAID with same `payment_ref` → return 200 (idempotent success).
   - If different state/ref → return 409 (conflict).

### Node.js (Express + mysql2/promise)

```javascript
import express from 'express';
import mysql from 'mysql2/promise';

const app = express();
app.use(express.json());

const pool = mysql.createPool({ uri: process.env.MYSQL_URL });

app.post('/api/orders/:id/confirm-payment', async (req, res) => {
  const orderId = Number(req.params.id);
  const { paymentRef } = req.body;            // from gateway callback or your service

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Read current state
    const [rows] = await conn.query(
      `SELECT status, version, payment_ref FROM orders WHERE id = ? FOR UPDATE`,
      [orderId]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }
    const { status, version, payment_ref } = rows[0];

    // 2) Idempotent fast-path: already PAID with same ref
    if (status === 'PAID' && payment_ref === paymentRef) {
      await conn.rollback(); // no change needed
      return res.status(200).json({ orderId, status: 'PAID' });
    }

    // 3) Optimistic update: only from PENDING -> PAID if version matches
    if (status === 'PENDING') {
      const [result] = await conn.query(
        `UPDATE orders
         SET status='PAID', payment_ref=?, version=version+1
         WHERE id=? AND version=?`,
        [paymentRef, orderId, version]
      );
      if (result.affectedRows === 1) {
        await conn.commit();
        return res.status(200).json({ orderId, status: 'PAID' });
      }
      // Lost the race; fall through and re-read
    }

    // 4) Re-read to decide idempotent outcome
    const [after] = await conn.query(
      `SELECT status, payment_ref FROM orders WHERE id=?`,
      [orderId]
    );
    await conn.rollback(); // no persistent changes in this branch
    const a = after[0];

    if (a.status === 'PAID' && a.payment_ref === paymentRef) {
      return res.status(200).json({ orderId, status: 'PAID' });  // idempotent success
    }

    return res.status(409).json({
      error: 'Order state changed by another request',
      currentStatus: a.status,
      currentPaymentRef: a.payment_ref
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});
```

### Why this is idempotent with versioning

- Re-sending the same confirmation (same `paymentRef`) just returns the same final state (PAID).
- Concurrent confirmations: only one update matches `version=?`. Others see `affectedRows=0` and then return the already-PAID state.
- Even without a Redis idempotency key, you avoid duplicate state transitions.

## Scenario B: Shopping cart "set quantity" (PUT is naturally idempotent)

**Goal:** Setting a cart line's quantity to N should be idempotent. If two devices race (one sets 2, another sets 3), we want last writer wins only if the version hasn't changed under you.

### Tables

```sql
CREATE TABLE carts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  version INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE cart_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cart_id BIGINT NOT NULL,
  sku VARCHAR(64) NOT NULL,
  quantity INT NOT NULL,
  version INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_cart_sku (cart_id, sku)
) ENGINE=InnoDB;
```

### API design

1. Client first GETs cart and receives an ETag or explicit version for each line.
2. Client sends If-Match (or body field) with the version it last saw.
3. Server does `UPDATE ... WHERE id=? AND version=?`.

### Node.js (set quantity)

```javascript
app.put('/api/carts/:cartId/items/:sku', async (req, res) => {
  const cartId = Number(req.params.cartId);
  const sku = req.params.sku;
  const { quantity, version } = req.body; // version of the cart item the client last saw

  if (quantity < 0) return res.status(400).json({ error: 'quantity must be >= 0' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Upsert the row if it doesn't exist (first write has version 0)
    const [existing] = await conn.query(
      `SELECT id, quantity, version FROM cart_items WHERE cart_id=? AND sku=? FOR UPDATE`,
      [cartId, sku]
    );

    if (!existing.length) {
      // Create new item *if* client thinks it's new (version must be 0 or absent)
      if (version != null && version !== 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'Version mismatch (item does not exist yet)' });
      }
      const [ins] = await conn.query(
        `INSERT INTO cart_items (cart_id, sku, quantity, version)
         VALUES (?, ?, ?, 0)`,
        [cartId, sku, quantity]
      );
      await conn.commit();
      return res.status(200).json({ id: ins.insertId, sku, quantity, version: 0 });
    }

    const row = existing[0];
    // Idempotent: if client sets the same quantity and version matches, OK
    if (row.version === version && row.quantity === quantity) {
      await conn.rollback();
      return res.status(200).json({ id: row.id, sku, quantity, version });
    }

    // Optimistic update using version
    const [upd] = await conn.query(
      `UPDATE cart_items
       SET quantity=?, version=version+1
       WHERE id=? AND version=?`,
      [quantity, row.id, version]
    );

    if (upd.affectedRows === 1) {
      // Fetch new version to return
      const [after] = await conn.query(`SELECT quantity, version FROM cart_items WHERE id=?`, [row.id]);
      await conn.commit();
      return res.status(200).json({ id: row.id, sku, quantity: after[0].quantity, version: after[0].version });
    }

    await conn.rollback();
    return res.status(412).json({   // 412 Precondition Failed (If-Match style)
      error: 'Version mismatch',
      message: 'The item was modified by another request. Fetch latest and retry.'
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});
```

### Why this is idempotent

- **PUT is "set-to" semantics:** sending the same `{quantity, version}` again is a no-op (same end state).
- **The version guards against lost updates.** If someone changed it after you read, your update won't match and you'll get a clear 412/409 to refetch.

## Tips & patterns

### Where does version come from?

Return it in GET responses (or via ETag). Clients echo it back via If-Match or request body.

### When to retry?

If you control both ends, you can auto-retry like: re-read → merge → try update again (bounded times).

### When NOT to use optimistic locking?

For counters/increments (e.g., "add 1 to stock"), prefer atomic SQL: `UPDATE ... SET stock = stock - 1 WHERE stock >= 1`.

### Combine with unique constraints

For one-shot transitions (e.g., a specific `payment_ref`), also add `UNIQUE(payment_ref)` to guarantee dedupe even if your logic is bypassed.

### Idempotent responses

For "set-to" operations, always return the current state. If the same request repeats, the response will be identical.