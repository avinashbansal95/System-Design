now let's start with common question asked in system design interbiew
1) let's say you are working in a big tech comoany and someone said there i page or component in app not working
how would you go about in invegtigating and solving the issue


# Production Incident Response Guide - Kubernetes Troubleshooting

## Step 1: Triage and Initial Assessment (The "Blast Radius")

Before diving deep, get a high-level understanding of the issue.

### Reproduce & Define the Issue
"First, I'd try to reproduce the issue myself to understand the exact symptom. Is it a 500 error? A timeout? Incorrect data? Is it affecting all users or a specific segment? Is it a specific page or a whole class of functionality?"

### Check Dashboards & Alerts
"I'd immediately look at our high-level observability dashboards:

- **Service Health Dashboards:** Are there spikes in error rates, latency, or a drop in traffic?
- **Infrastructure Health:** CPU, memory, disk I/O on hosts? Is a data store (MySQL, Redis) down?
- **Alerting Systems** (PagerDuty, Opsgenie): What alerts are already firing? This often points directly to the root cause.
- **CDN & DNS:** Is the CDN (Cloudflare, Cloud CDN) healthy? Are there DNS issues?

This helps me understand the blast radius—is this a global outage or a localized failure?"

## Step 2: The Investigation Path (The "Stack Walk")

If dashboards don't immediately reveal the cause, you start a methodical walk through the stack. Always start from the client and move backwards.

### A. Client-Side (The Browser/Mobile App)

#### Check Network Requests
"I'd open the browser's Developer Tools (Network tab) for the failing page. What is the HTTP status code for the failed API call? Is it a 5xx (server error), 4xx (client error, e.g., 429 Rate Limit), or a timeout?"

#### Inspect Response
"If there's a response, what is the body? Often, backend services return helpful error messages or stack traces even for a 500."

#### Console Errors
"Are there any JavaScript errors that might prevent the page from rendering correctly, even if the API call succeeded?"

### B. Network & Edge

#### DNS & CDN
"Using tools like `dig` or online checkers, I'd verify DNS resolution is correct. I'd check if the CDN is serving cached error pages."

#### Load Balancer / Ingress Controller
"I'd check the logs for our LB/Ingress (e.g., Nginx, GCLB, ALB). Are requests reaching there? What HTTP status codes is it returning? Is it failing to route to upstream services?"

### C. Application Layer (The Backend - This is usually where the problem is)

This is where your Kubernetes knowledge shines.

#### API Gateway / Reverse Proxy
"I'd check the logs of our API Gateway (Kong, Istio, our custom Express gateway). Is it receiving the request? Is it successfully routing to the downstream microservice, or is it timing out or getting an error?"

#### Target Microservice

##### Kubernetes Pods
"I'd use `kubectl` to check the health of the pods for the suspected microservice."

```bash
# 1. Get all pods for the 'order-service'
kubectl get pods -l app=order-service

# 2. Check if pods are Running, Ready, and how many restarts they have
# A high restart count indicates a crashing application.

# 3. If a pod is CrashLoopBackOff, examine its logs immediately.
kubectl logs -l app=order-service --previous # logs from the last crashed container
kubectl logs -l app=order-service # logs from the current container

# 4. Describe the pod for events (e.g., failed to pull image, insufficient resources)
kubectl describe pod -l app=order-service
```

##### Service & Endpoints
"I'd verify the Service is correctly pointing to the Pods."

```bash
# Check if the Service has valid Endpoints
kubectl get endpoints order-service

# If no endpoints, the Service's selector doesn't match any Pods,
# or the Pods' readiness probes are failing.
```

##### Application Logs
"I'd tail the application logs for the specific microservice, looking for errors, exceptions, or stack traces at the time of the request. This is often the fastest way to find the bug."

```bash
kubectl logs -l app=order-service -f --tail=100
```

##### Resource Usage
"I'd check if the application is under resource pressure (CPU, Memory) within the container."

```bash
# Get resource usage for pods
kubectl top pods -l app=order-service
```

### D. Dependencies (What the Microservice Calls)

"A component often fails because something it depends on fails."

#### Downstream Services
"Is the order-service failing because the user-service or product-service is down? I'd check the health and logs of those services as well."

#### Data Stores
"Is the database connection pool exhausted? Is there a slow query blocking the entire application? I'd check database metrics (CPU, connections, slow query logs)."

#### Caches (Redis)
"Is Redis down, causing a thundering herd of requests to the database?"

#### Third-Party APIs
"Are we getting rate-limited or is an external API we depend on (e.g., payments, email) down?"

### E. Recent Changes (The "What Changed?" Question)

"This is a critical step. Systems that were working rarely break without a change."

#### Deployment
"Was there a recent deployment of the microservice or its dependency? Can we roll back to the previous known-good version?"

#### Configuration Change
"Was there a change to a ConfigMap or Secret that was deployed?"

```bash
kubectl describe configmap my-app-config
kubectl get secret my-app-secret -o yaml # check if data was updated
```

#### Infrastructure Change
"Was there a change to the Kubernetes cluster itself? A node pool upgrade? A network policy?"

## Step 3: Resolution and Follow-up

### Mitigate vs. Root Cause
"The immediate goal is to mitigate the issue and restore service. This might involve rolling back a bad deployment, restarting a pod (`kubectl rollout restart deployment/order-service`), scaling up, or failing over to a backup region."

### Post-Mortem (Blameless)
"Once the service is restored, the most important work begins: conducting a blameless post-mortem. We need to document the root cause, what we did to fix it, and most importantly, define actionable items to prevent it from happening again. This could be adding better monitoring, improving tests, adding circuit breakers, or fixing a flawed process."

## Summary: How to Present Your Answer

| Phase | Key Actions | Example Commands/Tools |
|-------|-------------|------------------------|
| **1. Triage** | Reproduce, check dashboards, assess blast radius | Grafana, Prometheus, PagerDuty |
| **2. Investigate** | Client → Network → App → Dependencies. Follow the request path | Browser DevTools, `kubectl get pods`, `kubectl logs`, `kubectl describe` |
| **3. Resolve** | Mitigate first (rollback, restart), find root cause later | `kubectl rollout undo`, `kubectl scale` |
| **4. Learn** | Conduct a blameless post-mortem, create action items | JIRA, Confluence |

## Final Tip

**Practice this flow.** You can even use the microservice example we just built ("Imagine the `/orders` endpoint is returning 500 errors...") and walk through how you'd investigate it using the commands provided. This shows practical, hands-on expertise.