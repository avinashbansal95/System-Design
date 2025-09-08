now how we can confgire for a aprticular microservice we only want to navigate 40% of traffic to new and 60 % to still old one?
how to configure

# Traffic Splitting for Safe Canary Deployments

This is a crucial technique for canary releases and blue-green deployments within the Strangler Fig pattern. You don't want to flip a switch and send 100% of traffic to a new, potentially unstable service.

The goal is to configure your routing layer (API Gateway / Load Balancer) to split traffic based on a percentage, allowing for safe, gradual rollouts of new services.

## Real-Life Scenario: Canary Launch of the Product Service

You've built the new Product Service. It's tested in staging, but you want to minimize risk in production. You decide to send 40% of traffic to the new service and 60% to the old monolith's product functionality.

## Configuration Methods

Here's how to configure traffic splitting with common technologies:

### 1. NGINX (as a Load Balancer/API Gateway)

NGINX uses a weighted load-balancing algorithm. You define multiple upstream servers and assign a weight to each.

**Configuration Snippet (nginx.conf):**

```nginx
http {
    # Define upstream groups for the PRODUCT functionality
    upstream product_services {
        # server <destination> weight=<n>
        server new_product_service:8001 weight=4; # 40% of traffic (4 / (4+6) = 40%)
        server legacy_monolith:8000 weight=6;     # 60% of traffic (6 / (4+6) = 60%)
    }

    upstream other_services {
        server legacy_monolith:8000; # All other traffic still goes 100% to monolith
    }

    server {
        listen 80;

        # Location block for product calls - SPLITS TRAFFIC
        location /api/products/ {
            proxy_pass http://product_services; # This request goes to the upstream group
            proxy_set_header Host $host;
        }

        # Default catch-all - still 100% to monolith
        location / {
            proxy_pass http://other_services;
        }
    }
}
```

**How it works:** NGINX uses the weight parameters to distribute requests proportionally. For every 10 requests to `/api/products/`, approximately 4 will go to `new_product_service` and 6 to the `legacy_monolith`.

### 2. Kubernetes (with a Service Mesh like Istio)

This is the most common method in modern cloud-native environments. Istio provides incredibly fine-grained traffic control.

#### Step 1: Define Your Destinations (Kubernetes Services)

```yaml
# product-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: legacy-product-svc
spec:
  selector:
    app: legacy-monolith
  ports:
  - port: 80
---
apiVersion: v1
kind: Service
metadata:
  name: new-product-svc
spec:
  selector:
    app: new-product-service
  ports:
  - port: 80
```

#### Step 2: Apply an Istio VirtualService to Split Traffic

```yaml
# product-traffic-split.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: product-vs
spec:
  hosts:
  - bigshop.com # Your external hostname
  http:
  - match:
    - uri:
        prefix: /api/products # Apply this rule to product calls
    route:
    - destination:
        host: new-product-svc.default.svc.cluster.local
      weight: 40
    - destination:
        host: legacy-product-svc.default.svc.cluster.local
      weight: 60
  - route: # A catch-all route for everything else
    - destination:
        host: legacy-monolith-svc.default.svc.cluster.local
```

**How it works:** The Istio control plane configures the Envoy sidecar proxies running in your pods. They now intelligently route 40% of requests for `/api/products` to the new service and 60% to the old one.

### 3. AWS (with Application Load Balancer - ALB)

ALBs have built-in support for weighted target groups.

#### Steps:

1. **Create Two Target Groups:**
   - `TG-LegacyMonolith` (points to monolith's EC2 instances/IPs)
   - `TG-NewProductService` (points to new service's instances/IPs)

2. **Edit Your Listener Rules:** In the ALB console, you edit the rule for the path `/api/products/*`.

3. **Add Two Actions:** Forward to `TG-NewProductService` with a weight of 40, and forward to `TG-LegacyMonolith` with a weight of 60.

#### Visual ALB Rule:

```
IF Path is /api/products/*
THEN
    Forward to: TG-NewProductService (Weight: 40)
    Forward to: TG-LegacyMonolith (Weight: 60)
```

## Critical Considerations for a Safe Rollout

Simply splitting traffic isn't enough. You need to be strategic.

### 1. Monitoring and Observability

This is non-negotiable. Before you shift any traffic, ensure you have metrics and dashboards set up for both the new and old services. Key metrics to compare:

#### Technical Metrics
- **Error Rate (5XX responses):** Is the new service causing more failures?
- **Latency (P50, P95, P99):** Is the new service slower?
- **Throughput (Requests per second):** Is it behaving under load?

#### Business Metrics
- **Conversion Rate:** Is the conversion rate on product pages affected?
- **User Experience:** Are there any functional regressions?

### 2. Session Affinity (Sticky Sessions)

Usually, you do **not** want this for a canary. You want stateless traffic to be distributed randomly to accurately test the new service under real load. If a user's requests are "stuck" on a faulty new service instance, their experience will be broken until they clear their cookies. Random distribution spreads the risk.

### 3. Automated Rollback

For advanced setups, you can link your monitoring (e.g., Prometheus) with your deployment tool (e.g., Argo Rollouts, Spinnaker) to automatically revert the traffic split to 0% if error rates exceed a certain threshold. This is the pinnacle of safe deployment strategies.

#### Example Automated Rollback Configuration (Argo Rollouts)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: product-service-rollout
spec:
  strategy:
    canary:
      analysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: product-service
      steps:
      - setWeight: 5
      - pause: {duration: 10m}
      - setWeight: 20
      - pause: {duration: 10m}
      - setWeight: 40
      - pause: {duration: 10m}
      - setWeight: 60
      - pause: {duration: 10m}
```

## The Step-by-Step Rollout Process

### 1. Start with 1%
Don't start at 40%. Start with 1% of traffic to the new service. This tests it in production with minimal impact.

### 2. Monitor Closely
Watch your dashboards for a pre-defined period (e.g., 15-30 minutes).

### 3. Increase Gradually
If metrics look good, gradually increase the weight:
```
1% -> 5% -> 10% -> 25% -> 40% -> 60% -> 80% -> 100%
```

### 4. Pause or Rollback if Issues Arise
If at any step your metrics deteriorate, pause the rollout or roll back the traffic to the previous stable weight to investigate.

## Advanced Traffic Splitting Scenarios

### Feature Flags Integration

Combine traffic splitting with feature flags for even more control:

```nginx
# Route based on custom headers (feature flags)
map $http_x_feature_flag $backend_pool {
    "new-product-ui" product_services_new;
    default product_services_legacy;
}

location /api/products/ {
    proxy_pass http://$backend_pool;
}
```

### Geography-Based Splitting

Test new services in specific regions first:

```yaml
# Istio VirtualService with geography-based routing
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: geo-product-vs
spec:
  http:
  - match:
    - headers:
        x-user-region:
          exact: "us-west"
      uri:
        prefix: /api/products
    route:
    - destination:
        host: new-product-svc
      weight: 50  # Higher weight for test region
    - destination:
        host: legacy-product-svc
      weight: 50
  - match:
    - uri:
        prefix: /api/products
    route:
    - destination:
        host: new-product-svc
      weight: 10  # Lower weight for other regions
    - destination:
        host: legacy-product-svc
      weight: 90
```

## Best Practices Summary

### Do's ✅
- **Start small** (1% traffic) and increase gradually
- **Monitor extensively** with both technical and business metrics
- **Have rollback procedures** ready and tested
- **Use stateless traffic distribution** for accurate testing
- **Document your rollout plan** with clear success criteria
- **Communicate with stakeholders** about the rollout schedule

### Don'ts ❌
- **Don't skip monitoring setup** before starting traffic splits
- **Don't use sticky sessions** during canary testing
- **Don't rush the process** - take time to observe at each step
- **Don't ignore business metrics** - technical success ≠ business success
- **Don't forget to test rollback procedures** beforehand

## Conclusion

By using these traffic-splitting techniques, you achieve a controlled, safe, and data-driven migration, which is the entire philosophy behind the Strangler Fig pattern. The key is to be methodical, monitor extensively, and always have a rollback plan ready.

This approach minimizes risk while providing real-world validation of your new services under actual production load - the gold standard for safe deployments in critical systems.