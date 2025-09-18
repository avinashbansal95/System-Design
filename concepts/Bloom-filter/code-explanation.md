# Bloom Filter: Working and Code Explanation

## How Bloom Filters Work

A Bloom filter is a probabilistic data structure that uses **multiple hash functions** and a **bit array** to test whether an element is possibly in a set or definitely not in a set.

### Core Mechanism:

1. **Initialization**: Create a bit array of size `m` (all bits set to 0)
2. **Adding elements**:
   * Hash the element through `k` different hash functions
   * Set the bits at all `k` positions to 1
3. **Checking membership**:
   * Hash the element through the same `k` hash functions
   * If **all** corresponding bits are 1 → "probably in set"
   * If **any** bit is 0 → "definitely not in set"

## Code Walkthrough

### 1. Constructor

```javascript
constructor(size, numHashes) {
  this.size = size;          // Size of bit array
  this.numHashes = numHashes; // Number of hash functions
  this.bitArray = new Array(size).fill(false); // Initialize all bits to false/0
}
```

### 2. Hash Generation (`getHashValues`)

```javascript
getHashValues(item) {
  const hashes = [];
  for (let i = 0; i < this.numHashes; i++) {
    const hash = createHash('sha256')
      .update(item + i.toString()) // Add index as salt for different hashes
      .digest('hex');
    
    const intValue = parseInt(hash.substring(0, 8), 16); // Get first 8 chars as number
    hashes.push(intValue % this.size); // Ensure index is within array bounds
  }
  return hashes;
}
```

**Why multiple hashes?** Using the same hash function with different salts (0, 1, 2, ...) simulates multiple independent hash functions.

### 3. Adding Items (`add`)

```javascript
add(item) {
  const indices = this.getHashValues(item);
  indices.forEach(index => {
    this.bitArray[index] = true; // Set all corresponding bits to 1
  });
}
```

### 4. Checking Membership (`mightContain`)

```javascript
mightContain(item) {
  const indices = this.getHashValues(item);
  return indices.every(index => this.bitArray[index]); // All bits must be 1
}
```

### 5. False Positive Probability Calculation

```javascript
falsePositiveProbability(insertedItems) {
  const k = this.numHashes;
  const m = this.size;
  const n = insertedItems;
  
  return Math.pow(1 - Math.pow(1 - 1/m, k * n), k);
}
```

This formula calculates the probability that all `k` bits for a new item might coincidentally be set to 1 by other items.

## Web Crawler Simulation Explained

The simulation demonstrates a practical use case:

```javascript
// For each URL:
if (bloomFilter.mightContain(url)) {
  // Possibly visited before - check actual storage to confirm
  if (visitedUrls.has(url)) {
    console.log(`✓ ${url} - Already visited (confirmed)`);
  } else {
    console.log(`✗ ${url} - False positive! Actually new URL`);
  }
} else {
  // Definitely new - safe to crawl without expensive check
  console.log(`→ ${url} - New URL, starting crawl...`);
  bloomFilter.add(url);
  visitedUrls.add(url);
}
```

## Visual Example

Let's trace through a simple example with a small filter:

**Filter**: size = 10, numHashes = 3

**Adding "example.com"**:
* Hash 1 → position 2
* Hash 2 → position 5
* Hash 3 → position 8
* Set bits [2, 5, 8] to 1

**Checking "example.com"**:
* Check bits [2, 5, 8] → all 1 → "probably exists"

**Checking "newexample.com"**:
* Hash 1 → position 2 (1)
* Hash 2 → position 7 (0) ← found 0!
* Result: "definitely doesn't exist"

**False positive scenario**: If another item sets bits [2, 7, 8] to 1, then checking "newexample.com" would find all bits set to 1, causing a false positive.

## Key Advantages Shown in Code

1. **Memory efficiency**: 100,000 bits = ~12.5KB vs actual URL storage
2. **Fast operations**: O(k) time complexity (k = number of hashes)
3. **No false negatives**: If it says "not present", it's definitely not present
4. **Trade-off**: Configurable false positive rate based on size and hash count