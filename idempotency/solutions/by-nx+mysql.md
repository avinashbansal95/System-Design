# MySQL Schema & Node.js Idempotency Patterns

## MySQL Schema Patterns

### 1) Idempotency Registry (Generic)

```sql
CREATE TABLE idempotency_keys (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  endpoint VARCHAR(100) NOT NULL,
  idem_key VARCHAR(64) NOT NULL,
  req_hash CHAR(64) NOT NULL, -- SHA-256 hex of canonical request body
  status_code INT NOT NULL,
  response_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_ep_key (user_id, endpoint, idem_key)
) ENGINE=InnoDB;
```

Usage:
- **On first request**: create row and perform the operation inside the same tx (or record after success).
- **On repeat**: read and return `response_json` / `status_code`.

### 2) Natural Key Uniqueness

```sql
CREATE TABLE payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  amount_cents INT NOT NULL,
  currency CHAR(3) NOT NULL,
  external_ref VARCHAR(64) NOT NULL, -- idempotency / gateway ref
  status ENUM('PENDING','SUCCEEDED','FAILED') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_external_ref (external_ref)
) ENGINE=InnoDB;
```

### 3) Outbox

```sql
CREATE TABLE outbox (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  aggregate_type VARCHAR(40) NOT NULL,
  aggregate_id BIGINT NOT NULL,
  type VARCHAR(60) NOT NULL,           -- e.g., "PaymentSucceeded"
  payload JSON NOT NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_agg_type (aggregate_type, aggregate_id, type, created_at)
) ENGINE=InnoDB;
```

## Node.js Patterns (Express + mysql2/promise + Redis)

### 1) HTTP Idempotency with Redis (Fast Path)

#### Flow

1. Client sends `Idempotency-Key`.
2. Server tries `SET idem:<user>:<endpoint>:<key> "LOCK" NX PX 60000`.
3. **If success** → first call: process; store the final response under same key; extend TTL (e.g., 24h).
4. **If already exists**:
   - If value is `"LOCK"` → another request is in flight → return 409 Retry-After or wait briefly.
   - Else → it is a cached response → return it.

#### Code (Simplified)

```javascript
import crypto from 'crypto';
import express from 'express';
import Redis from 'ioredis';
import mysql from 'mysql2/promise';

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL);
const pool = mysql.createPool({ uri: process.env.MYSQL_URL });

function hashBody(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

app.post('/api/orders', async (req, res) => {
  const userId = req.user.id;                     // assume auth middleware
  const idemKey = req.get('Idempotency-Key');     // REQUIRED
  if (!idemKey) return res.status(400).json({ error: 'Missing Idempotency-Key' });

  const endpoint = 'POST:/api/orders';
  const reqHash = hashBody({ userId, body: req.body }); // scope to user

  const baseKey = `idem:${userId}:${endpoint}:${idemKey}`;
  const lockKey = `${baseKey}:lock`;
  const dataKey = `${baseKey}:data`;

  // 1) Try to acquire short lock (avoid duplicate concurrent work)
  const locked = await redis.set(lockKey, '1', 'NX', 'PX', 10000); // 10s
  if (!locked) {
    // Check if result is ready
    const cached = await redis.get(dataKey);
    if (cached) {
      const { reqHash: savedHash, status, body } = JSON.parse(cached);
      if (savedHash !== reqHash) return res.status(409).json({ error: 'Idempotency-Key reuse with different payload' });
      return res.status(status).json(body);
    }
    return res.status(409).json({ error: 'Request in progress, retry later' });
  }

  try {
    // 2) Check if we already have a persisted response (repeat call after first completed)
    const cached = await redis.get(dataKey);
    if (cached) {
      const { reqHash: savedHash, status, body } = JSON.parse(cached);
      if (savedHash !== reqHash) return res.status(409).json({ error: 'Idempotency-Key reuse with different payload' });
      return res.status(status).json(body);
    }

    // 3) First-time execution: do the actual side effect atomically with MySQL
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Use a natural unique key to harden against duplicates, e.g. client_order_ref
      const [result] = await conn.query(
        `INSERT INTO orders (user_id, client_ref, status, total_cents)
         VALUES (?, ?, 'CREATED', ?)`,
        [userId, req.body.clientRef, req.body.totalCents]
      ); // Add UNIQUE KEY on (client_ref)

      const orderId = result.insertId;
      await conn.query(
        `INSERT INTO outbox (aggregate_type, aggregate_id, type, payload)
         VALUES ('Order', ?, 'OrderCreated', JSON_OBJECT('orderId', ?, 'userId', ?))`,
        [orderId, orderId, userId]
      );
      await conn.commit();

      const responseBody = { orderId, status: 'CREATED' };
      // 4) Save idempotent response for replays (24h TTL)
      await redis.set(
        dataKey,
        JSON.stringify({ reqHash, status: 201, body: responseBody }),
        'PX',
        24 * 60 * 60 * 1000
      );
      return res.status(201).json(responseBody);
    } catch (e) {
      await conn.rollback();
      if (e.code === 'ER_DUP_ENTRY') {
        // Another concurrent insert with same client_ref succeeded: fetch and return it
        const [rows] = await conn.query(`SELECT id FROM orders WHERE client_ref = ?`, [req.body.clientRef]);
        const orderId = rows[0]?.id;
        const body = { orderId, status: 'CREATED' };
        await redis.set(dataKey, JSON.stringify({ reqHash, status: 201, body }), 'PX', 24 * 60 * 60 * 1000);
        return res.status(201).json(body);
      }
      throw e;
    } finally {
      conn.release();
    }
  } finally {
    // 5) Release the in-flight lock
    await redis.del(lockKey);
  }
});
```

#### Why This Works

- **First write wins** guarded twice: Redis in-flight lock + MySQL unique key.
- **Replays return the same response** (from Redis).
- **Cross-payload reuse is prevented** via `reqHash`.