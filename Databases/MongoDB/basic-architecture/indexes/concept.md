# MongoDB Index Storage & Access: Summary

## Index Storage & Access Fundamentals

- **Permanent Storage**: Indexes are persistently **stored on disk** (HDD/SSD) within WiredTiger's data files.

- **Active Use**: To be used for a query, the required parts of an index **must be loaded into the WiredTiger internal cache (RAM)**.

- **Loading Behavior**: How they are loaded depends on the RAM size vs. Index size:
  - **If the entire index can fit in RAM**: It will eventually be loaded whole into the cache for lightning-fast lookups.
  - **If the index is larger than RAM**: Only the most frequently accessed **pieces (pages) of the index** (e.g., the root node, popular branches) are kept in RAM. Querying a less-used part of the index will require a slow disk read to load those specific pages on demand.

## The Critical Implication

This is why the relationship between your **Index Size** and your **RAM** is the most important factor for performance.

### Performance Scenarios

| Condition | Result | Performance |
|-----------|--------|-------------|
| **`Total Index Size < RAM`** | 🚀 **Excellent Performance** | The entire index lives in RAM |
| **`Total Index Size > RAM`** | 🐢 **Poor Performance** | The database must constantly read index pages from the slow disk, causing an I/O bottleneck |

## Checking Your Index Size

You can check your index size with the command:

```javascript
db.collection.totalIndexSize()
```

## Additional Useful Commands

```javascript
// Check individual index sizes
db.collection.getIndexes().forEach(function(index) {
    print(index.name + ": " + db.collection.totalIndexSize()[index.name]);
});

// Check WiredTiger cache statistics
db.serverStatus().wiredTiger.cache;

// Check cache size configuration
db.serverStatus().wiredTiger.cache["maximum bytes configured"];
```

## Key Takeaway

> **The golden rule**: Your total index size should fit comfortably within your available WiredTiger cache (typically ~50% of server RAM minus 1GB). If it doesn't, expect significant performance degradation due to constant disk I/O for index page loads.