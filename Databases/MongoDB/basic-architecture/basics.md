# MongoDB Architecture: The Interview Guide

## High-Level Architecture: The Big Picture

MongoDB uses a client-server and distributed architecture. The core components are:

- **mongod**: The core database process. It handles data storage, queries, and CRUD operations. A single server or a shard in a cluster runs this.

- **mongos**: The query router for sharded clusters. Clients connect to mongos, which routes queries to the appropriate shards.

- **Config Servers**: Store the metadata and configuration for a sharded cluster (which data lives on which shard).

For a single server or a replica set, you only deal with mongod.

## The Heart of the Matter: WiredTiger Storage Engine

Since version 3.2, WiredTiger is the default storage engine. This is the most critical part to understand for performance questions.

| Feature | How it Works | Why it's Important for Performance |
|---------|--------------|-----------------------------------|
| **Document-Level Concurrency** | Writes occur on documents using Multi-Version Concurrency Control (MVCC). Writes don't block reads, and most writes don't block other writes. | **High throughput**: Drastically reduces lock contention compared to the old table-level locking. This is a key selling point. |
| **Snapshots & Checkpoints** | WiredTiger takes snapshots of data and writes them to disk as checkpoints (every 60 seconds or 2 GB of journal data by default). | **Data Durability**: Checkpoints provide a consistent view of data on disk. Between checkpoints, the journal is used for recovery. |
| **Journaling** | A write-ahead log (journal). All writes are first written to the journal (a sequential log file). The journal is flushed to disk every 100ms by default. | **Crash Recovery**: If MongoDB crashes between checkpoints, it can replay the journal to recover all writes that were committed to the journal. This is why you get durability even with frequent writes. |
| **Compression** | Compresses both data and indexes on disk. Supports multiple algorithms (Snappy by default, zlib, zstd). | **Reduces I/O & Storage Costs**: Less data is read from/written to disk. This improves performance and saves storage space. |
| **Caching** | WiredTiger maintains its own internal cache (by default, uses 50% of RAM minus 1 GB). This cache holds frequently accessed data and indexes. | **Performance**: Reads are served from memory if the data is in the cache. The size and efficiency of this cache are paramount for read performance. |

## The Read/Write Journey: Step-by-Step

### 1. The Write Operation (insert, update, delete)

1. **Client Request**: Your application sends a write operation to the mongod process.

2. **In-Memory Update**: The write is applied to the documents in the WiredTiger internal cache in memory.

3. **Journal Write (For Durability)**: The change is simultaneously written to the journal (a sequential log file on disk). This is a fast, sequential write.

   > **Interview Tip**: Mention that the journal is committed to disk every 100ms. This is the primary guarantee that a write won't be lost in a crash. You can tweak this for performance (j: false) but you risk losing ~100ms of data on a crash.

4. **Acknowledgment**: Once the journal write is successful, the driver can send an acknowledgment back to the client (if using writeConcern: "majority" or similar). The write is now durable.

5. **Checkpointing (Lazy Write to Data Files)**: In the background, WiredTiger periodically writes the in-memory snapshot of the data (a checkpoint) to the actual data files on disk. This is a larger, bulk operation.

**On which disk?** Both the journal files (journal/ directory) and the final data files (data/ directory) are on the server's persistent storage (SSD is highly recommended).

### 2. The Read Operation (find)

1. **Client Request**: Your application sends a query.

2. **Cache Check (First Stop)**: WiredTiger first checks its internal cache in RAM.
   - If the data (and index) is in the cache, it's returned immediately. This is very fast (~microseconds).

3. **Disk Read (Cache Miss)**: If the data is not in the cache, WiredTiger must read it from the data files on disk (SSD/HDD). This is orders of magnitude slower.

4. **Cache Population**: The data read from disk is loaded into the internal cache (potentially evicting older data) and then returned to the client.

**On which disk?** Reads come from the data files in the data/ directory.

## Key Concerns & Interview Discussion Points

When discussing MongoDB in an interview, be prepared to address these concerns and trade-offs.

| Concern | Explanation & Mitigation | Interview Response |
|---------|--------------------------|-------------------|
| **Memory Bound** | Performance is heavily dependent on the working set (indexes + active data) fitting in WiredTiger's cache. If your working set is 100GB but you only have 16GB RAM, you will have constant cache misses and poor performance. | "MongoDB performance is excellent if the working set fits in RAM. We must right-size our instances and use compression to maximize our effective cache size. We'd monitor the cache usage metrics in `db.serverStatus()`." |
| **Joins are Application-Side** | MongoDB is document-based and doesn't support server-side joins like SQL. Related data is often embedded or fetched with multiple queries ($lookup is a limited form of a join). | "We model our data based on access patterns. For data that's read together, we embed it. For more complex relationships, we use application-level joins or the $lookup aggregation stage, understanding it's not as performant as a SQL join." |
| **Transaction Overhead** | Multi-document ACID transactions are supported but have a higher performance cost than single-document atomic operations. | "We use transactions when absolutely necessary for consistency across documents. For most use cases, we design our schema to keep related data in a single document to leverage atomic single-document operations, which are much faster." |
| **Sharding Complexity** | While sharding enables horizontal scale, choosing the right shard key is critical. A poor shard key can lead to jumbo chunks (no splitting) or hot shards (imbalanced load). | "Sharding is key for horizontal scaling. The choice of shard key is the most important decision. We need a key with high cardinality, even distribution, and that aligns with our common query patterns to avoid scatter-gather queries." |

## Summary: Read/Write Performance Levers

### Write Performance
Heavily influenced by:
- Journal Write Speed (faster disks = better)
- Indexes (each index adds overhead on every write)

### Read Performance
Almost entirely dependent on:
- **Working Set in RAM** (Is your data and its indexes in the cache?)
- **Proper Indexing** (Without an index, a query causes a collection scan (COLLSCAN), which is very slow. With an index, it's an index scan (IXSCAN))

## Final Interview Pro Tip
Always connect the technology choice to the system's requirements.

> "We chose MongoDB because our data is unstructured and our access patterns are primarily writes and simple queries on a large volume of documents, where its document model and write performance excel."

> "We avoided MongoDB for this financial transaction service because the complex, multi-row transactions and strong consistency requirements are better served by a relational database like PostgreSQL."