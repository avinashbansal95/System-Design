# MongoDB Durability: Journaling & Write Concerns

## How MongoDB Ensures Durability

MongoDB ensures durability via **journaling** (default in WiredTiger).

- Once a transaction is committed, the journal is written to disk. Even if MongoDB crashes, recovery is possible.

## Example with Write Concern

```javascript
db.accounts.updateOne(
  { _id: 1 },
  { $inc: { balance: -50 } },
  { writeConcern: { w: "majority", j: true } }
)
```

### Write Concern Parameters Explained

- `w: "majority"` → waits until a majority of replica set members acknowledge.
- `j: true` → waits until data is written to the journal.

## Write Concern Options

| Parameter | Value | Behavior | Durability Level |
|-----------|--------|----------|------------------|
| `w: 1` | Default | Primary acknowledges only | Basic |
| `w: "majority"` | Recommended | Majority of nodes acknowledge | High |
| `j: true` | Recommended | Wait for journal write | High |
| `j: false` | Fast but risky | Don't wait for journal | Low |

## Durability Scenarios

### High Durability (Recommended)
```javascript
{
  writeConcern: { 
    w: "majority", 
    j: true,
    wtimeout: 5000
  }
}
```
- Waits for majority acknowledgment
- Ensures journal write to disk
- Has timeout for safety

### Fast but Risky
```javascript
{
  writeConcern: { 
    w: 1, 
    j: false 
  }
}
```
- Only primary acknowledges
- Doesn't wait for journal
- Risk of data loss on crash

## Limitations

### Configuration Issues
If you don't configure write concern properly, durability may be weaker:
- `w: 1` without journaling → only primary ack, not majority safe
- Risk of data loss if primary fails before replication

### Performance Trade-offs
- Durability across distributed transactions can cause performance overhead
- Higher write concerns increase latency
- Journal writes add disk I/O overhead

## Recovery Process

### On Crash Recovery
1. MongoDB starts up and reads data files (last checkpoint state)
2. Replays journal entries since last checkpoint
3. Brings database to consistent, up-to-date state
4. Ready to accept new operations

### Visual Flow
```
Write Operation
    ↓
Applied to Cache (RAM)
    ↓
Written to Journal (Disk) ← Durability guarantee
    ↓
Acknowledged to Client
    ↓
Background: Checkpoint to Data Files
```

## Best Practices

### For Critical Data
```javascript
{
  writeConcern: { 
    w: "majority", 
    j: true,
    wtimeout: 5000
  }
}
```

### For High-Volume, Less Critical Data
```javascript
{
  writeConcern: { 
    w: 1, 
    j: true
  }
}
```

### Never Use (Unless You Accept Data Loss)
```javascript
{
  writeConcern: { 
    w: 1, 
    j: false
  }
}
```

## Monitoring Durability

### Check Journal Status
```javascript
db.serverStatus().dur
```

### Check Write Concern Acknowledgments
```javascript
db.serverStatus().metrics.repl.apply
```

## Key Takeaways

1. **Journaling is critical** for crash recovery and durability
2. **Write concerns control** the durability vs. performance trade-off
3. **`w: "majority", j: true`** provides the strongest durability guarantees
4. **Performance overhead** increases with stronger durability requirements
5. **Recovery is automatic** through journal replay on startup