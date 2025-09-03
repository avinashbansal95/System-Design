# Online Schema Migration Tools: pt-osc vs gh-ost

## 🔹 1. **pt-online-schema-change (pt-osc)** — Percona Toolkit

### How it works
1. Creates a **shadow table** with the desired schema.
2. Adds **triggers** on the original table:
   * `AFTER INSERT`
   * `AFTER UPDATE`
   * `AFTER DELETE`
3. Copies rows in small **chunks** into the shadow table.
4. Triggers keep shadow table up-to-date with live writes.
5. At the end → `RENAME TABLE` (atomic cutover).

### Key Features
* Well-tested (been around for years).
* Works with **all MySQL variants** (including RDS).
* Requires **triggers** on the table → performance impact.
* Can be blocked if too many triggers already.

### Drawbacks
* Triggers add extra load on primary (every write executes both).
* Can't run on tables with foreign keys (tool blocks).
* More invasive → not "transparent" to application.

## 🔹 2. **gh-ost** — GitHub's Online Schema Migration Tool

### How it works
1. Creates a **ghost table** (like pt-osc).
2. Instead of triggers, it reads **binlogs** directly (as if it were a replica).
3. Copies rows in small **chunks** into ghost table.
4. Applies binlog changes (inserts/updates/deletes) to keep ghost table in sync.
5. At the end → `RENAME TABLE` (atomic cutover).

### Key Features
* No triggers → **lighter load on primary**.
* Safer: built-in throttling based on replication lag and server load.
* Can run migrations while you sleep → auto-throttles when system is busy.
* Designed for **cloud environments** (RDS, Aurora).

### Drawbacks
* Only works with **MySQL 5.6+** with binlog row format.
* Slightly newer compared to pt-osc (but battle-tested at GitHub, Shopify, etc.).

## 🔹 3. Side-by-Side Comparison

| Feature | pt-online-schema-change (pt-osc) | gh-ost |
|---------|-----------------------------------|---------|
| **Sync mechanism** | **Triggers** | **Binlog parsing** |
| Load on primary | Higher (extra trigger writes) | Lower (binlog only) |
| Replica lag handling | Manual throttling flags | Built-in lag detection + auto throttle |
| RDS/Aurora support | ✅ Works | ✅ Works (even better fit) |
| Foreign key support | ❌ Not supported | ✅ Safer (FKs still tricky but better) |
| Safety (production-grade) | ✅ Mature, widely used | ✅ Designed for web-scale |
| Complexity | Easier, older | More config options |
| Cutover | `RENAME TABLE` (same for both) | `RENAME TABLE` (same) |

## 🔹 4. Which One Should You Use in AWS RDS?

### Use `gh-ost` when:
* You're on **AWS RDS / Aurora**.
* Tables are **large with heavy write traffic**.
* You want **less overhead** on primary.
* You need **automatic throttling** based on replication lag.

👉 **Example:** Adding `last_login_at` to `users` with 1B rows.

### Use `pt-osc` when:
* You're in a **self-managed MySQL** environment.
* You need something simple & battle-tested.
* Your table doesn't have **foreign keys**.
* You don't mind triggers.

👉 **Example:** Smaller tables, or when binlog setup is tricky.

## 🔹 5. Real-World Big Tech Choices

* **GitHub, Shopify, Slack** → `gh-ost` (they built it for this).
* **Percona shops, legacy MySQL shops** → `pt-osc`.
* **AWS RDS** customers → usually `gh-ost` (because binlog-based sync is safer in managed DBs).

## ✅ **Summary**

* Both tools automate the "ghost table → sync → cutover" process.
* **pt-osc** = uses triggers, adds extra write load.
* **gh-ost** = uses binlogs, lighter, safer, better for cloud (RDS).
* In **AWS RDS distributed environments**, `gh-ost` is generally the best choice.