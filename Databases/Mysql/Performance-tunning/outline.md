# MySQL Performance Optimization Guide

## 🔹 1. **Schema & Data Modeling**

### **Proper Indexing**:
* Use **B-Tree** indexes for range scans and lookups.
* Use **covering indexes** to avoid hitting the table.
* Use **FULLTEXT indexes** for text search instead of `LIKE '%x%'`.
* Watch for **index bloat** (unused indexes slow down writes).

### **Partitioning**:
* Horizontal partitioning (sharding) in distributed setups.
* Native MySQL partitioning for large tables (by range, list, hash, key).

### **Data Types**:
* Use the smallest suitable data type (`INT` vs `BIGINT`, `VARCHAR(100)` vs `VARCHAR(500)`).
* Avoid `TEXT/BLOB` in hot paths; use external storage if needed.

### **Normalization vs Denormalization**:
* Normalize to avoid redundancy but denormalize when query patterns benefit.

## 🔹 2. **Query Optimization**

### **EXPLAIN & Query Profiling**:
* Use `EXPLAIN` to ensure correct index usage, avoid full table scans.

### **Avoid SELECT ***: 
* Fetch only needed columns.

### **Joins & Subqueries**:
* Prefer `JOIN` over correlated subqueries.
* Optimize join order (smallest result set first).

### **Pagination Optimization**:
* Replace `OFFSET n LIMIT m` with **keyset pagination** (`WHERE id > ? LIMIT m`).

### **Batching**:
* Use bulk inserts/updates (`INSERT ... VALUES (...), (...), (...)`) instead of row-by-row.

## 🔹 3. **Server & Engine Tuning**

### MySQL Config (`my.cnf`):

#### **Buffer Pool**:
* `innodb_buffer_pool_size` → should be ~60–70% of RAM for dedicated DB server.
* `innodb_buffer_pool_instances` → multiple pools for parallelism.

#### **Log Buffers**:
* `innodb_log_buffer_size` → larger for write-heavy workloads.

#### **Redo/Undo Logs**:
* `innodb_log_file_size` → adjust to balance write throughput vs recovery time.

#### **Query Cache (MySQL < 8.0)**: 
* Disabled usually; better use application caching.

#### **Thread Concurrency**:
* `innodb_thread_concurrency` and connection pooling at app level.

#### **Tmp Tables**:
* `tmp_table_size` and `max_heap_table_size` → avoid disk spills for temp tables.

### Storage Engine Choice:
* Use **InnoDB** (default, best for most workloads).
* Use **MyISAM** only for read-heavy, simple workloads (rare in modern setups).

## 🔹 4. **Distributed Environment Tuning**

### **Replication**:
* Use **read replicas** for scaling reads.
* Tune replication with `binlog_format=ROW`, `slave_parallel_workers`, `relay_log_info_repository=TABLE`.
* Consider **semi-synchronous replication** to balance performance vs durability.

### **Sharding**:
* Distribute data across shards (e.g., by user ID or region).
* Use application-level sharding logic or middleware (e.g., Vitess, ProxySQL).

### **Clustering**:
* MySQL NDB Cluster for high availability + partitioning.
* Group Replication for HA + fault tolerance.

### **Proxy Layer**:
* Use **ProxySQL / HAProxy** for query routing, load balancing, failover.

## 🔹 5. **Operating System & Hardware Tuning**

### **Memory**: 
* Ensure enough RAM for buffer pool & OS cache.

### **Disk I/O**:
* Use **SSD/NVMe** for InnoDB data files.
* RAID10 over RAID5 for performance.

### **Networking**:
* Optimize `max_allowed_packet`, TCP buffer sizes.
* Use **connection pooling** at application level.

### **NUMA**: 
* Bind MySQL to one NUMA node to avoid latency spikes.

## 🔹 6. **Monitoring & Observability**

* Use tools like **Percona Monitoring and Management (PMM)**, **MySQL Enterprise Monitor**, **Grafana + Prometheus**.
* Track:
  * Slow queries (`slow_query_log`).
  * Deadlocks.
  * Replication lag.
  * Buffer pool hit ratio.
  * Disk I/O waits.

## 🔹 7. **Application-Level Optimization**

### **Caching**:
* Redis/Memcached for hot reads.
* Query results caching in app tier.

### **Connection Pooling**:
* Use libraries like `mysql2`, `sequelize-pool`, or ProxySQL.

### **Retry & Circuit Breaker Logic**: 
* For distributed failures.