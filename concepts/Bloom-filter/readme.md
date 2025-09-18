# Bloom Filters: Explained with Node.js Implementation

## What is a Bloom Filter?

A Bloom filter is a space-efficient probabilistic data structure that tells you whether an element is **possibly in a set** or **definitely not in a set**. It's designed to be extremely memory-efficient at the cost of occasional false positives.

## Problems It Solves

1. **Memory efficiency**: Uses significantly less memory than hash tables
2. **Fast lookups**: Constant-time O(1) operations
3. **Set membership testing**: Perfect for "does this exist?" questions
4. **Avoiding expensive operations**: Prevents unnecessary database/API calls

## Key Characteristics

* **False positives possible**: May say an item exists when it doesn't
* **No false negatives**: If it says an item doesn't exist, it definitely doesn't
* **Cannot remove elements**: Standard Bloom filters don't support deletion

## Real-Life Scenario: URL Checker for Web Crawler

Imagine you're building a web crawler that needs to avoid visiting the same URL multiple times. Checking every URL against a database would be slow and resource-intensive. A Bloom filter can quickly tell you if a URL has **probably** been visited before.

```javascript
// URL: https://example.com/page1
// Bloom filter says: "Probably visited" → might check database to confirm
// Bloom filter says: "Definitely not visited" → safe to crawl without DB check
```

## Node.js Implementation

```javascript
const { createHash } = require('crypto');

class BloomFilter {
  constructor(size, numHashes) {
    this.size = size;
    this.numHashes = numHashes;
    this.bitArray = new Array(size).fill(false);
  }

  // Generate multiple hash values for an item
  getHashValues(item) {
    const hashes = [];
    for (let i = 0; i < this.numHashes; i++) {
      const hash = createHash('sha256')
        .update(item + i.toString()) // Add salt for different hashes
        .digest('hex');
      
      // Convert hash to integer and mod by array size
      const intValue = parseInt(hash.substring(0, 8), 16);
      hashes.push(intValue % this.size);
    }
    return hashes;
  }

  // Add an item to the filter
  add(item) {
    const indices = this.getHashValues(item);
    indices.forEach(index => {
      this.bitArray[index] = true;
    });
  }

  // Check if an item might be in the filter
  mightContain(item) {
    const indices = this.getHashValues(item);
    return indices.every(index => this.bitArray[index]);
  }

  // Calculate false positive probability
  falsePositiveProbability(insertedItems) {
    const k = this.numHashes;
    const m = this.size;
    const n = insertedItems;
    
    return Math.pow(1 - Math.pow(1 - 1/m, k * n), k);
  }
}

// Example usage with web crawler scenario
function simulateWebCrawler() {
  // Create bloom filter with 100,000 bits and 5 hash functions
  const bloomFilter = new BloomFilter(100000, 5);
  const visitedUrls = new Set(); // Actual storage for comparison
  
  const urlsToCheck = [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3',
    'https://example.com/page1', // Duplicate
    'https://example.com/newpage'
  ];

  console.log('Web Crawler Simulation:\n');

  urlsToCheck.forEach(url => {
    if (bloomFilter.mightContain(url)) {
      // Possible false positive - need to check actual storage
      if (visitedUrls.has(url)) {
        console.log(`✓ ${url} - Already visited (confirmed)`);
      } else {
        console.log(`✗ ${url} - False positive! Actually new URL`);
      }
    } else {
      // Definitely not visited - safe to crawl
      console.log(`→ ${url} - New URL, starting crawl...`);
      bloomFilter.add(url);
      visitedUrls.add(url);
    }
  });

  console.log(`\nFalse positive probability: ${(bloomFilter.falsePositiveProbability(visitedUrls.size) * 100).toFixed(2)}%`);
  console.log(`Memory used: ${bloomFilter.size / 8} bytes vs ${visitedUrls.size * 50} bytes for actual storage`);
}

// Run the simulation
simulateWebCrawler();
```

## How to Use

1. Save the code above as `bloom-filter.js`
2. Run with Node.js: `node bloom-filter.js`
3. Observe how the Bloom filter efficiently identifies potentially visited URLs

## Benefits in Practice

- **Space Efficiency**: Uses only ~12.5KB for 100,000 bits vs potentially MBs for URL storage
- **Speed**: O(1) lookup time regardless of data size
- **Scalability**: Perfect for large-scale applications like web crawlers, CDNs, and databases

The Bloom filter's probabilistic nature makes it ideal for scenarios where occasional false positives are acceptable but false negatives would be costly.