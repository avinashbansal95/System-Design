# New Relic on GKE Tutorial - Project Apollo API

This is a very common and important real-world scenario. Let's design a setup for our "Project Apollo" API on GCP's Kubernetes Engine (GKE).

## The Scenario

- **App:** "Project Apollo" Node.js API (same bookstore API from before, but dockerized)
- **Infrastructure:** Google Kubernetes Engine (GKE) cluster
- **Database:** Cloud SQL for MySQL (managed MySQL on GCP)
- **Goal:** Monitor the application performance, traces, and infrastructure health with New Relic

## 1. The Dummy Application Structure

Let's create a simple structure for our dockerized app:

```
project-apollo/
├── Dockerfile
├── k8s/
│   ├── deployment.yaml
│   └── service.yaml
├── newrelic.js
└── app.js (and package.json, etc.)
```

### Dockerfile

```dockerfile
# Use a specific Node version for stability
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source and New Relic config
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the app, requiring newrelic first
CMD ["node", "-r", "newrelic", "app.js"]
```

> **Note:** The `-r newrelic` flag is the standard way to require the New Relic agent before any other code in a Docker container.

## 2. Where to Store the New Relic License Key (The Critical Part)

Storing secrets like license keys in code or Docker images is a major security anti-pattern. In Kubernetes, we always use Secrets.

We will create a Kubernetes Secret to store the New Relic license key.

### Step 1: Create the Secret

First, encode your license key in base64:

```bash
echo -n 'YOUR_NRAK_LICENSE_KEY_HERE' | base64
# This will output something like: WU9VUl9OUkFLX0xJQ0VOU0VfS0VZSEVSRQ==
```

Now, create a file `k8s/newrelic-secret.yaml`:

```yaml
# k8s/newrelic-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: newrelic-license
  # You can add labels here for better organization
type: Opaque
data:
  # The key must be exactly 'license_key'
  license_key: WU9VUl9OUkFLX0xJQ0VOU0VfS0VZSEVSRQ== # <-- Paste your base64-encoded key here
```

Apply it to your cluster:

```bash
kubectl apply -f k8s/newrelic-secret.yaml
```

### Step 2: Modify the Deployment to Use the Secret

We need to inject the secret as an environment variable into our Pod. Here's the updated `k8s/deployment.yaml`:

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: project-apollo-api
  labels:
    app: project-apollo-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: project-apollo-api
  template:
    metadata:
      labels:
        app: project-apollo-api
    spec:
      containers:
      - name: project-apollo-api
        image: gcr.io/your-gcp-project/project-apollo-api:latest # Your container image in Google Container Registry
        ports:
        - containerPort: 3000
        env:
          # Inject the New Relic license key from the Kubernetes Secret
          - name: NEW_RELIC_LICENSE_KEY
            valueFrom:
              secretKeyRef:
                name: newrelic-license  # Name of the Secret we created
                key: license_key        # Key within the secret
          # Other environment variables (e.g., for DB connection)
          - name: DB_HOST
            valueFrom:
              secretKeyRef:
                name: cloud-sql-credentials
                key: host
        # ... other container config like liveness probes ...
---
# A simple Service to expose the Pods
apiVersion: v1
kind: Service
metadata:
  name: project-apollo-service
spec:
  selector:
    app: project-apollo-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer # Creates a GCP Network Load Balancer with a public IP
```

### Step 3: Modify newrelic.js to Use the Environment Variable

This is the final piece that connects everything. The agent will now read the key from the environment variable instead of a hardcoded value.

```javascript
// newrelic.js
'use strict'
exports.config = {
  app_name: ['Project Apollo Production'],
  // The key is now read from the environment variable injected by Kubernetes
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  distributed_tracing: { enabled: true },
  logging: {
    level: 'info',
    filepath: 'stdout'
  },
  // ... rest of your config ...
};
```

## 3. How We View the Data in New Relic

After deploying this to your GKE cluster (`kubectl apply -f k8s/`), the data will flow into New Relic. Here's where you look:

### APM & Services
Your main dashboard for application performance. You'll see "Project Apollo Production" here with all the metrics we discussed (Apdex, throughput, error rate, response time). You can drill down into slow transactions and errors just like before.

### Infrastructure > Kubernetes
This is a huge benefit. New Relic automatically discovers your GKE cluster and provides a detailed dashboard showing:

- **Cluster health:** CPU/Memory allocation and usage across all nodes
- **Workload status:** The state of your Deployments, Pods (e.g., are all 3 replicas running?)
- **Data correlation:** You can click on a node in the cluster view and see which Pods are running on it. You can then click on your "project-apollo-api" Pod and click through directly to the APM data for that application. This connects infrastructure problems directly to application performance.

### Logs
You can configure New Relic to collect logs from your Pods. This means you can see your application logs, combined with the request traces from APM, all in one place. You can see the exact log lines that were generated for a specific failed request.

## How to Explain This in an Interview

> "In my previous project, we ran our Node.js services on GKE. My role was to integrate New Relic for observability. The key challenge was managing the license key securely. Instead of hardcoding it, I created a Kubernetes Secret to store it. I then updated our Deployment configuration to inject the key from the Secret into the container as an environment variable. Finally, I configured the newrelic.js file to read from that environment variable.
>
> This approach ensured the secret wasn't exposed in our codebase or Docker images. Once deployed, we got immediate visibility not just into application metrics like Apdex and slow database queries, but also into the underlying Kubernetes infrastructure. We could directly correlate a pod being evicted due to memory pressure in the Kubernetes dashboard with a spike in application error rates in the APM dashboard, which made troubleshooting incredibly efficient."

This answer shows you understand:
- **Security** (Secrets)
- **Configuration management** (environment variables)
- **Containerization** (Docker)
- **Kubernetes** (Deployments, Services, Secrets)
- **Observability** (APM + Infrastructure monitoring)
- **Problem correlation** (connecting infrastructure issues to application performance)