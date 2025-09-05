# Idempotency Guide for Node.js + MySQL

## What is Idempotency?

Idempotency is the "do it as many times as you want, the final effect is the same" guarantee. It's essential anywhere retries, duplicates, or race conditions can happen—which is basically all distributed systems.

Below is a practical, Node.js + MySQL–focused guide (with Redis options too): real scenarios, design choices, schema patterns, and drop-in code.

## When You **Need** Idempotency (Real-Life Scenarios)

1. **Payments / Order Creation**
   - User double-clicks "Pay", gateway retries, mobile app resends on flaky network.
   - You must avoid double-charging / duplicate orders.

2. **Refunds / Wallet Credit**
   - A crashed worker restarts and replays the same refund job.
   - Don't credit twice.

3. **Inventory Reservation / Booking**
   - Two retries hit "reserve seat A12". Final state must be "reserved once".

4. **Webhook Receivers (Stripe, Razorpay, GitHub, Slack)**
   - Providers retry until 2xx. Your handler must be safe to process duplicates.

5. **Email/SMS/Push Sending**
   - A job reprocessed should not resend the same message.

6. **File Uploads / Import Jobs**
   - Client resumes/retries chunk n; server must not double-append.

7. **Account Provisioning / Subscription Activation**
   - Replaying the same "activate" request must not create duplicate rows/entitlements.

8. **Background Jobs / At-Least-Once Queues**
   - Workers may pick the same message again (visibility timeout, crashes).

9. **Upserts of User Profile / Settings**
   - Replaying "set preference X=Y" should not duplicate rows.

10. **API Writes Behind Unreliable Networks (Mobile)**
    - Client caches an idempotency key and retries until ack.

## Core Strategies (Pick One or Combine)

### A) Client-Supplied Idempotency Key (+ Server Cache or DB)

- Client sends a unique key per "logical operation" (e.g., header `Idempotency-Key: <uuid>`).
- Server stores the key and the result. If the same key arrives again, return the *same* result without redoing side effects.
- Storage options: Redis (fast, TTL) or MySQL table (durable).

**When to use:** payment, order creation, webhook processing, any "create" op.

**Key design tips:**
- Scope the key to **endpoint + authenticated user + request hash** to avoid accidental cross-use.
- Set a TTL appropriate to business rules (e.g., 24–72h for payments).
- Store the **response body + status** to return the same output on replay.
- If the same key arrives with **different payload**, reject with 409 Conflict.

### B) Natural/Business Keys + Unique Constraints

- Model the data so duplicates are impossible:
  - `orders(order_external_id UNIQUE)`
  - `wallet_credits(reference_id UNIQUE)`
  - `email_sends(message_key UNIQUE)`
- Use `INSERT … ON DUPLICATE KEY UPDATE …` (MySQL upsert) or `INSERT IGNORE`.

**When to use:** any record that has a natural unique identity.

### C) Optimistic Concurrency / Versioning

- For "set state" operations, store a `version` or `updated_at` and do:
  - `UPDATE … WHERE id=? AND version=?` → rows affected = 1 means success.

**When to use:** idempotent updates and conflict detection on concurrent writers.

### D) State Machines with Terminal States

- Design side effects to be **commutative** or **terminal**:
  - "Activate subscription" changes status from `pending → active`; replaying has no additional effect.

**When to use:** lifecycle transitions (activate, cancel, fulfill).

### E) Outbox + Exactly-Once Publish (Processing Idempotency)

- Write side effects and an "outbox" row in the **same DB transaction**.
- A separate worker publishes and marks outbox rows as processed (idempotent on publish).
- If the worker crashes, it resumes from unprocessed rows—no duplicate effects.

**When to use:** emitting events/notifications reliably from MySQL.

### F) Redis Primitives

- `SET key value NX PX=ttl` (or `SETNX`) to claim a key once.
- Lua script for check-and-set/read-after-set atomically.
- Good for webhooks or short-lived create ops.

**When to use:** high QPS, low latency, small payload responses.

### G) Distributed Locks (Sparingly)

- Use **Redlock**/Redis locks to serialize rare hot-spot operations (e.g., "reserve seat A12").
- Prefer DB constraints first; locks are a last resort.