# New Relic Node.js Tutorial - Building a Bookstore API

This is the best way to learn New Relic! We'll build a simple Node.js application, intentionally introduce some problems, and watch New Relic catch them.

We'll create a simple "Bookstore API" using Express and MySQL.

## Step 1: Setup a New Relic Account

1. Go to [newrelic.com](https://newrelic.com) and sign up for a free account. You don't need a credit card.
2. Once logged in, you'll be taken to the homepage. Your account is already created.
3. Find your License Key:
   - Click on your account name in the top-right → Account settings
   - Under "API keys", you'll see your "License key"
   - Copy it. We'll need it soon.

## Step 2: Setup the MySQL Database

1. Start MySQL on your Mac. (If you have it installed via Homebrew, it might be `brew services start mysql`)
2. Connect to MySQL as root (`mysql -u root -p`)
3. Run the following SQL commands to create a database, a user, and a simple table:

```sql
CREATE DATABASE bookstore;
USE bookstore;

CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  year_published INT
);

-- Insert some sample data
INSERT INTO books (title, author, year_published) VALUES
('The Great Gatsby', 'F. Scott Fitzgerald', 1925),
('To Kill a Mockingbird', 'Harper Lee', 1960),
('1984', 'George Orwell', 1949);

-- Create a user for our Node.js app (choose a better password!)
CREATE USER 'bookuser'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON bookstore.* TO 'bookuser'@'localhost';
FLUSH PRIVILEGES;
```

## Step 3: Create the Node.js Project

Open your terminal and follow these steps:

```bash
# 1. Create a new directory and enter it
mkdir newrelic-demo
cd newrelic-demo

# 2. Initialize a new Node.js project (accept all defaults)
npm init -y

# 3. Install necessary dependencies
npm install express mysql2 newrelic

# 4. Create the main application file
touch app.js

# 5. Create the New Relic configuration file
touch newrelic.js
```

## Step 4: Configure New Relic

Open the `newrelic.js` file in your code editor and paste the following configuration. Replace `'YOUR_LICENSE_KEY_HERE'` with the actual key you copied in Step 1.

```javascript
// newrelic.js
'use strict'
/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name: ['My Local Bookstore API'],
  /**
   * Your New Relic license key.
   */
  license_key: 'YOUR_LICENSE_KEY_HERE', // <-- REPLACE THIS!
  /**
   * This setting controls distributed tracing.
   * Distributed tracing lets you see the path that a request takes through your
   * distributed system. Enabling distributed tracing changes the behavior of some
   * New Relic features, so carefully consult the transition guide before enabling.
   */
  distributed_tracing: {
    /**
     * Enables distributed tracing.
     *
     * @env NEW_RELIC_DISTRIBUTED_TRACING_ENABLED
     */
    enabled: true
  },
  logging: {
    /**
     * Level at which to log. 'info' is a good default for production.
     * Use 'debug' or 'trace' for more verbose logging.
     */
    level: 'info',
    // Log to stdout for easier management in containers
    filepath: 'stdout'
  },
  /**
   * When true, all request headers except for those listed in attributes.exclude
   * will be captured for all traces, unless otherwise specified in a destination's
   * attributes include/exclude list.
   */
  allow_all_headers: true,
  attributes: {
    /**
     * Prefix of attributes to exclude from all destinations. Allows * as wildcard
     * at end.
     *
     * NOTE: If excluding headers, they must be in camelCase form to be filtered.
     */
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  }
};
```

## Step 5: Write the Application Code (With Intentional Problems)

Now, open `app.js` and paste the following code. This creates a simple API with a fast route, a slow route, and a route that errors out.

**Remember to make this the first line:** `require('newrelic');`

```javascript
// app.js - THIS MUST BE THE FIRST LINE
require('newrelic');

const express = require('express');
const mysql = require('mysql2/promise'); // Using promise-based API

const app = express();
const port = 3000;

app.use(express.json());

// --- Create a MySQL connection pool (better than single connection) ---
const pool = mysql.createPool({
  host: 'localhost',
  user: 'bookuser',
  password: 'password',
  database: 'bookstore',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- Helper function to simulate delay ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- API Routes ---

// 1. A fast, healthy route
app.get('/api/books', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM books LIMIT 5');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Database error');
  }
});

// 2. A route with a SLOW QUERY (Simulates a missing index)
app.get('/api/books/slow', async (req, res) => {
  try {
    // This is a inefficient query on a small table, imagine it on a huge one
    const [rows] = await pool.execute('SELECT * FROM books WHERE author LIKE "%e%"');
    // Let's make it even worse with an artificial delay
    await delay(3000); // Delay for 3 seconds!
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Database error');
  }
});

// 3. A route that SOMETIMES FAILS
app.get('/api/books/random', async (req, res) => {
  // Randomly cause an error ~30% of the time
  if (Math.random() < 0.3) {
    // This will cause a 500 error because 'nonexistent_table' doesn't exist
    const [rows] = await pool.execute('SELECT * FROM nonexistent_table');
    res.json(rows);
  } else {
    const [rows] = await pool.execute('SELECT * FROM books ORDER BY RAND() LIMIT 1');
    res.json(rows);
  }
});

// 4. A route that does nothing (to show very fast response time)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Bookstore API listening at http://localhost:${port}`);
  console.log('Make some traffic!');
  console.log('Fast:    curl http://localhost:3000/api/books');
  console.log('Slow:    curl http://localhost:3000/api/books/slow');
  console.log('Random:  curl http://localhost:3000/api/books/random');
  console.log('Health:  curl http://localhost:3000/api/health');
});
```

## Step 6: Run the Application and Generate Traffic

1. Start your app:

```bash
node app.js
```

You should see the messages with the example curl commands.

2. **Generate Traffic:** Open a new terminal window and start running the curl commands. Mix them up! Run them multiple times. This simulates users hitting your API.

```bash
# Run the fast one a bunch of times
curl http://localhost:3000/api/books

# Run the slow one a few times (it will take ~3 seconds each time)
curl http://localhost:3000/api/books/slow

# Run the random one until you trigger an error
curl http://localhost:3000/api/books/random

# Run the health check
curl http://localhost:3000/api/health
```

Keep doing this for 5-10 minutes. The New Relic agent batches data and sends it every minute, so you need to generate enough data for it to report.

## Step 7: Explore the New Relic Dashboard

1. Go back to your browser where New Relic is open.

2. **Go to APM > Summary:** You should see your application "My Local Bookstore API" in the list. Click on it.

### What you'll see: The main dashboard! 

Watch the charts update in near-real-time. You'll see:

- **Apdex** (Application Performance Index): This will likely be "Suffering" or "Tolerating" because of our slow route.
- **Throughput** (RPM): A bar chart showing how many requests per minute you made.
- **Response time**: A line chart. You should see a high average because of the 3-second delay on the /slow route.
- **Error rate**: A chart showing the percentage of failed requests. It will spike each time you trigger the error in /random.

3. **Click on the "Transactions" tab:**

### What you'll see: 
A list of all your endpoints (`/api/books`, `/api/books/slow`, etc.).

Find the "Slowest" average response time. The `/api/books/slow` route will be at the top. Click on its name to drill down.

4. **Drill into the "slow" transaction:**

### What you'll see: 
A detailed breakdown of that specific route.

- Look at the "Transactions breakdown" chart. It will show that almost all the time is spent in "Database" (the slow query) and "Web Transaction" (the artificial delay we added with `delay(3000)`).
- Scroll down to the "Database" section. You'll see the exact slow SQL query: `SELECT * FROM books WHERE author LIKE "%e%"`. This is gold for a developer – it pinpoints the problem immediately.

5. **Click on the "Errors" tab:**

### What you'll see: 
A list of all errors. You should see the `ER_NO_SUCH_TABLE` error from MySQL because we tried to select from `nonexistent_table`.

Click on the error to see the full stack trace, showing you exactly which line in `app.js` caused the problem.

## What You've Just Experienced

You've built a working application and seen, in real-time, how New Relic:

- **Tracks throughput** (requests per minute)
- **Visualizes response times** and immediately identifies the slowest endpoints
- **Breaks down transaction time** to show if the time is spent in your code, the database, or elsewhere
- **Surfaces slow database queries** with the exact SQL code
- **Aggregates and traces errors**, making debugging incredibly fast

This hands-on experience is exactly what interviewers want to hear about. You can now say, "I set it up locally to test its capabilities," and describe exactly what you saw.