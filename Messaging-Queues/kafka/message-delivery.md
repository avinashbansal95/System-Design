# Kafka Delivery Semantics: Complete Guide

## 1. The Three Delivery Semantics Kafka Supports

**At-most-once** → messages may be lost, but never redelivered.

**At-least-once (default)** → messages are never lost, but can be redelivered (duplicates possible).

**Exactly-once** → every message is processed once and only once (no loss, no duplicates).

## 2. How Kafka Achieves Each

### 2.1 At-most-once

**Producer side:** fire-and-forget (e.g., `acks=0`) → messages may be lost if broker fails.

**Consumer side:** commit offsets before processing (or use auto-commit). If consumer crashes after commit but before processing, messages are lost.

**Coordination:** No retry on producer, offsets committed early.

👉 **Result:** Some messages may never be processed, but no duplicates.

**Example:**
Logging system where dropping a log line is acceptable (you don't want duplicates).

### 2.2 At-least-once (default)

**Producer side:** `acks=1` or `acks=all` (with retries enabled). Broker retries ensure message isn't lost.

**Consumer side:** commit offsets after processing. If consumer crashes after processing but before commit, Kafka will redeliver → duplicate possible.

**Coordination:** Kafka's consumer group protocol ensures each partition is assigned to one consumer in the group. On crash/rebalance, uncommitted offsets are reassigned → duplicates possible.

👉 **Result:** Messages are not lost, but some may be processed more than once.

**Example:**
E-commerce order pipeline → better to charge a customer twice and refund later than to lose the order entirely. Duplicates can be handled with idempotent order service.

### 2.3 Exactly-once

Kafka provides exactly-once semantics (EOS) with:

**Idempotent producer** (`enable.idempotence=true`) → ensures retries don't create duplicates.
- Broker uses sequence numbers per producer+partition to deduplicate.

**Transactional producer** (`transactional.id` set) → lets you atomically:
- Write to multiple partitions/topics, and
- Commit consumer offsets together with the produced messages.

**Consumers** with `isolation.level=read_committed` see only committed transactions.

**Consumer coordination:** offsets are written inside the transaction to the `__consumer_offsets` topic. If the transaction commits → both data + offsets are visible; if it aborts → neither is.

👉 **Result:** Each message is processed exactly once end-to-end.

**Example:**
Banking transfer system: deduct ₹1000 from account A and credit account B. Duplicate processing could cause double debit/credit, and loss could cause imbalance. Here, exactly-once is critical.

## 3. Default Behavior in Kafka

**Default delivery = At-least-once.**

### Why?
- **Producer default:** `acks=1` → leader acknowledges, retry enabled.
- **Consumer default:** `enable.auto.commit=true` (auto commits offsets periodically), but usually apps switch to manual commit after processing.
- **Net effect:** no loss, possible duplicates.

## 4. How to Enable the Other Semantics

### At-most-once
- **Producer:** `acks=0` (fire-and-forget).
- **Consumer:** commit offsets before processing, or keep auto-commit on (risk of losing).

### At-least-once (default)
- **Producer:** `acks=1` (default) or `acks=all`. Retries enabled.
- **Consumer:** commit offsets after processing.

### Exactly-once
**Producer:**
```
enable.idempotence=true
transactional.id=my-transactional-id
```
Use `beginTransaction()`, `send()`, `sendOffsetsToTransaction()`, `commitTransaction()`.

**Consumer:**
```
isolation.level=read_committed
enable.auto.commit=false
```
Only sees committed messages, not aborted ones.

## 5. Consumer Groups and Coordination

Let's say we have N consumer groups, each with M consumers.

### Consumer groups:
- Each group is independent. All messages go to each group (like independent subscribers).
- So N groups = N copies of processing.

### Within a group (M consumers):
- Kafka's group coordinator assigns partitions → each partition is consumed by exactly one consumer in the group.
- This ensures no duplication inside a group unless there's a crash/rebalance (where offsets may be replayed).

### Offsets:
- Stored in `__consumer_offsets`.
- On crash, new consumer resumes from last committed offset.
- Timing of commit determines if duplicates or losses happen (→ defines semantics).

## 6. Real-world Examples

### At-most-once
**Application:** Monitoring/metrics collection.
- If a single CPU usage event is lost, no big deal; duplicates would mess up averages.
- **Config:** producer `acks=0`, consumer auto-commit enabled.

### At-least-once
**Application:** E-commerce order events.
- If an order event is duplicated, backend can deduplicate using orderId.
- Losing an order is unacceptable.
- **Config:** producer `acks=all`, retries on; consumer commits offsets after order is written to DB.

### Exactly-once
**Application:** Payment service (bank transfers).
- Must debit account A and credit account B once.
- **Config:** transactional producer + idempotence, consumer offsets included in transaction, consumers use `read_committed`.

## 7. Interview-ready Summary

- Kafka supports **at-most-once**, **at-least-once**, **exactly-once**.
- **Default = at-least-once**.
- Delivery semantics depend on producer acks/idempotence, consumer commit strategy, and transactional use.
- **At-most-once** → commit before processing (risk: loss).
- **At-least-once** → commit after processing (risk: duplicate).
- **Exactly-once** → transactional producer + read_committed consumers (no loss, no duplicate).
- **Consumer groups:** each group gets full stream, partitions distributed within group (ensures scaling + ordering per partition).