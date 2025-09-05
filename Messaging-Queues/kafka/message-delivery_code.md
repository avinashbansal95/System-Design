# Kafka Delivery Semantics in Node.js (KafkaJS Examples)

Great question — yes, in Kafka you control when offsets are committed in your consumer code. In Node.js, the two common choices are:

- **Commit before processing** → at-most-once
- **Commit after processing** → at-least-once (default best practice)

And if you go for exactly-once, you'll combine a transactional producer with committing the consumer's offsets inside the same transaction.

Below are clear, runnable KafkaJS examples (popular Node client). I'll show all three patterns.

## Setup (Shared)

```javascript
// npm i kafkajs
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'demo-app',
  brokers: ['localhost:9092'],
});

const groupId = 'demo-group';
const topic = 'bank-transactions';
```

## A) At-most-once (commit BEFORE processing)

**Risk:** you can lose messages if your process crashes after the commit but before you finish work.

```javascript
async function atMostOnceConsumer() {
  const consumer = kafka.consumer({ groupId, allowAutoTopicCreation: false, retry: { retries: 0 } });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  // Disable auto-commit so we can commit immediately on receipt
  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
      const nextOffset = (Number(message.offset) + 1).toString();

      // 1) Commit FIRST (marks this record as "done")
      await consumer.commitOffsets([{ topic, partition, offset: nextOffset }]);

      // 2) THEN process (if you crash here, the record is lost)
      const payload = message.value?.toString();
      console.log('Processing (at-most-once):', { partition, offset: message.offset, payload });

      // doWork(payload) ...
      await heartbeat();
    },
  });
}

atMostOnceConsumer().catch(console.error);
```

**When to use:** telemetry where dropping an event is okay, but duplicates would hurt (e.g., some metrics).

## B) At-least-once (commit AFTER processing) — most common

**Risk:** you can get duplicates (e.g., crash after processing but before commit).

```javascript
async function atLeastOnceConsumer() {
  const consumer = kafka.consumer({ groupId, allowAutoTopicCreation: false });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  await consumer.run({
    // Disable auto-commit to control when we commit
    autoCommit: false,
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      const payload = message.value?.toString();
      const nextOffset = (Number(message.offset) + 1).toString();

      try {
        // 1) Process FIRST
        console.log('Processing (at-least-once):', { partition, offset: message.offset, payload });
        // await doWork(payload);  // write to DB, call API, etc.

        // 2) On success, commit the offset
        await consumer.commitOffsets([{ topic, partition, offset: nextOffset }]);
      } catch (err) {
        console.error('Work failed; NOT committing. Will be redelivered.', err);
        // Optional: backoff, pause(), alerting, etc.
        // Throwing lets KafkaJS handle retries / rebalance; message will reappear (duplicate)
        throw err;
      } finally {
        await heartbeat();
      }
    },
  });
}

atLeastOnceConsumer().catch(console.error);
```

**When to use:** orders, emails, notifications — where no-loss is required and your handler is idempotent (dedup by key).

## C) Exactly-once (transactional producer + commit offsets in the transaction)

**Goal:** no loss, no duplicates from Kafka → your output topic / sink. You consume, process, produce results, and commit the consumed offsets all in one Kafka transaction.

### Notes
- This protects the path Kafka → Kafka. If you write to an external DB, you also need an atomic/transactional strategy there.
- Consumers must use `read_committed` to avoid seeing aborted transactions.

```javascript
async function exactlyOncePipeline() {
  const consumer = kafka.consumer({ groupId, allowAutoTopicCreation: false });
  const producer = kafka.producer({
    // idempotent & transactional
    idempotent: true,
    transactionalId: 'demo-tx-1', // stable per process instance
  });

  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  await consumer.run({
    autoCommit: false, // we will commit offsets via the transaction
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      const tx = await producer.transaction(); // beginTransaction()

      try {
        const payload = message.value?.toString();
        const nextOffset = (Number(message.offset) + 1).toString();

        // 1) Do your processing (pure compute or side-effect with exactly-once guarantees)
        console.log('Processing (exactly-once):', { partition, offset: message.offset, payload });
        const result = `processed:${payload}`;

        // 2) Produce your output as part of the transaction
        await tx.send({
          topic: 'bank-transactions-processed',
          messages: [{ key: message.key, value: result }],
        });

        // 3) Add the consumed offset to the SAME transaction (atomic!)
        await tx.sendOffsets({
          consumerGroupId: groupId,
          topics: [
            { topic, partitions: [{ partition, offset: nextOffset }] },
          ],
        });

        // 4) Commit the transaction
        await tx.commit();
      } catch (err) {
        console.error('TX failed; aborting. Nothing is visible to read_committed consumers.', err);
        await tx.abort();
        // The original message will be redelivered; but because we aborted,
        // downstream won't see a partial output or offset commit.
        throw err;
      } finally {
        await heartbeat();
      }
    },
  });
}

exactlyOncePipeline().catch(console.error);
```

Consumer on the output side should set:

```javascript
const consumerOut = kafka.consumer({
  groupId: 'downstream',
  // See only committed transactions
  // (KafkaJS reads committed by default; set isolation level in other clients if needed)
});
```

## FAQ / Tips

- **Why commit offset + 1?** Kafka stores the next record to read. If you processed offset 42, you commit 43.

- **Batch processing?** With `eachBatch`, call `resolveOffset(offset)`, do work, and then `commitOffsetsIfNecessary()` after the batch. Same before/after idea.

- **Multiple consumers per group?** Kafka assigns partitions so each partition is owned by exactly one consumer in the group; your "commit timing" logic runs independently in each consumer.

- **Idempotency:** Even with at-least-once, make your handler idempotent (e.g., use a unique business key and UPSERT in DB).

- **Transactions scope:** Exactly-once is end-to-end iff every hop participates in the transaction model (Kafka → Kafka). For external sinks, you need two-phase/Outbox or sink-specific transactions.

If you tell me what sink you write to (MySQL, Postgres, Redis, S3, etc.), I can tailor the idempotency/transaction part to that target as well.