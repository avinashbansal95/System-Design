# Complete Vitess Deployment Guide with Node.js

You want to go from scratch: deploy Vitess, hook it up with MySQL (RDS/Aurora), and then make a Node.js app talk to it with a real-life sharding example.

Let's walk through it step by step like a tech company would do.

## 🔹 Real-Life Scenario

Suppose you are building a multi-tenant e-commerce platform (like Shopify).

* Each merchant has many products, orders, customers.
* DB grows huge (billions of rows).
* You decide to shard by `merchant_id`.
* You're using AWS RDS (Aurora MySQL) as the storage backend.
* To simplify sharding logic, you introduce Vitess as middleware.

## 🔹 Step 1: Deploy Vitess Cluster

Vitess has 3 main parts:

* **vtgate** → SQL proxy, entry point for apps (looks like MySQL).
* **vttablet** → runs alongside each MySQL instance, manages queries/shards.
* **Topology service** (etcd/ZooKeeper/Consul) → stores cluster metadata.

### Option A (for learning/dev): Run Vitess locally with Docker

Vitess has official images. Quickstart:

```bash
# Clone Vitess repo
git clone https://github.com/vitessio/vitess.git
cd vitess

# Start a local Vitess cluster with sample keyspace/shards
./examples/local/vitess-up.sh
```

This spins up:
* vtgate (proxy at localhost:15306)
* 2 shards (-80, 80-) each with MySQL running inside vttablet

👉 In production (AWS):
* You would deploy Vitess on EKS (Kubernetes) or EC2,
* Point vttablet to your RDS/Aurora MySQL instances instead of local MySQL.

## 🔹 Step 2: Create a Sharded Keyspace

A keyspace in Vitess = database (can be sharded).

Example: create commerce keyspace, sharded on merchant_id.

```bash
# Create a sharded keyspace with 2 shards: -80 and 80-
vtctlclient CreateKeyspace --sharding_column_name=merchant_id --sharding_column_type=uint64 commerce

# Init tablets (one primary per shard)
vtctlclient InitShardPrimary commerce/-80 zone1-0000000100
vtctlclient InitShardPrimary commerce/80- zone1-0000000101
```

👉 Meaning:
* Merchants with merchant_id < 128 (hex 80) go to shard -80.
* Merchants with merchant_id >= 128 go to shard 80-.

## 🔹 Step 3: Define Schema with VSchema

Vitess needs a VSchema (Vitess Schema) to understand how to route queries.

Example: **vschema.json**

```json
{
  "tables": {
    "merchants": {
      "column_vindexes": [
        { "column": "merchant_id", "name": "hash" }
      ]
    },
    "products": {
      "column_vindexes": [
        { "column": "merchant_id", "name": "hash" }
      ]
    },
    "orders": {
      "column_vindexes": [
        { "column": "merchant_id", "name": "hash" }
      ]
    }
  },
  "vindexes": {
    "hash": { "type": "hash" }
  }
}
```

Apply it:

```bash
vtctlclient ApplyVSchema -vschema_file=vschema.json commerce
```

👉 This tells Vitess:
* Use `merchant_id` as the shard key.
* Use a hash vindex (built-in).

## 🔹 Step 4: Insert Some Data

Once schema is applied, connect to vtgate (`mysql -h 127.0.0.1 -P 15306 -u root`) and run:

```sql
CREATE TABLE merchants (
  merchant_id BIGINT PRIMARY KEY,
  name VARCHAR(255)
);

CREATE TABLE products (
  product_id BIGINT AUTO_INCREMENT,
  merchant_id BIGINT,
  name VARCHAR(255),
  price DECIMAL(10,2),
  PRIMARY KEY (product_id)
);

INSERT INTO merchants (merchant_id, name) VALUES (101, 'Nike'), (205, 'Adidas');
INSERT INTO products (merchant_id, name, price) VALUES (101, 'Shoe', 120.50), (205, 'Jacket', 200.00);
```

Vitess automatically places:
* Nike's data (merchant_id=101) in shard -80.
* Adidas's data (merchant_id=205) in shard 80-.

## 🔹 Step 5: Node.js Integration

Now, instead of connecting directly to RDS, your Node.js app connects to vtgate.

```javascript
import mysql from "mysql2/promise";

// Connect to Vitess vtgate (acts like MySQL)
const pool = mysql.createPool({
  host: "127.0.0.1",   // in AWS, vtgate service endpoint
  port: 15306,         // default vtgate MySQL port
  user: "root",
  password: "",
  database: "commerce"
});

async function getMerchantProducts(merchantId) {
  const [rows] = await pool.query(
    "SELECT * FROM products WHERE merchant_id = ?",
    [merchantId]
  );
  return rows;
}

// Example usage
(async () => {
  console.log(await getMerchantProducts(101)); // gets from shard -80
  console.log(await getMerchantProducts(205)); // gets from shard 80-
})();
```

👉 Node.js app doesn't know about shards — vtgate figures it out.

## 🔹 Step 6: Scaling & Resharding

When one shard gets too big:

```bash
vtctlclient SplitClone commerce/-80
```

* Vitess will split shard -80 into -40 and 40-80, moving data online with minimal downtime.
* Your Node.js app continues to query vtgate without code changes.

## 🔹 AWS Production Setup

* **RDS Aurora MySQL** as backend DB.
* Deploy **Vitess on EKS** (Kubernetes):
  * vtgate (load-balanced, exposed as service).
  * vttablets (one per RDS instance).
  * etcd as topology service.
* Node.js app → vtgate endpoint → queries automatically routed.

## ✅ Summary

* Vitess sits between Node.js and MySQL RDS.
* You define shard key (merchant_id) and VSchema.
* Vitess handles query routing, cross-shard queries, and resharding.
* Node.js connects to Vitess as if it's a single MySQL DB.
* This is exactly how YouTube, Slack, Shopify, GitHub scale MySQL.