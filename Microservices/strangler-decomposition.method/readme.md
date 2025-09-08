# The Strangler Fig Pattern: Safely Modernizing Legacy Systems

The Strangler Fig Pattern is one of the most important and practical patterns in a software engineer's toolkit, especially when dealing with legacy systems. The name comes from a real-life plant, the Strangler Fig, which grows around a host tree, eventually replacing it entirely while the host tree decomposes and disappears.

## What is the Strangler Fig Pattern?

It is an incremental, low-risk strategy for migrating a legacy monolithic system to a new architecture (like microservices) by gradually "strangling" the old system and replacing it with new services.

Instead of a risky "big bang" rewrite where you replace the entire monolith at once, you gradually intercept and redirect feature traffic from the old system to new services. Over time, the monolith's responsibilities shrink until it can be finally shut down.

## Real-Life Scenario: Modernizing an E-Commerce Monolith

Let's continue with our `BigShop.exe` e-commerce monolith. The business has decided to move to microservices. The goal is to replace the monolith without any business disruption.

**The Target:** The first service to extract is the Product Catalog. It's a well-defined domain and a read-heavy service that would benefit from its own database and caching.

## How to Implement and Configure the Strangler Fig Pattern

### Step 1: Identify a Function to Strangle

We choose a specific function to migrate. In this case, we'll start with the "View Product Details" page (e.g., `BigShop.com/products/{productId}`).

### Step 2: Implement the New Service

A new team builds the Product Service. This includes:

- A new RESTful API (e.g., `GET /api/products/{id}`)
- A new database optimized for product data (e.g., PostgreSQL or even a NoSQL DB like MongoDB for flexible product attributes)
- All the business logic for managing products

### Step 3: The Crucial Step: The Strangler Fig "Layer"

This is the heart of the pattern. We introduce a routing layer (an API Gateway or a simple reverse proxy like Nginx or Traefik) in front of both the monolith and the new services.

**Initial Configuration:** The routing layer sends all traffic (`/*`) to the legacy monolith.

**First Strangulation:** We configure a specific rule in the router:

```
Location: `/api/products/*`   --> Route to the new Product Service
Location: `/*`                --> Route to the legacy Monolith (catch-all)
```

Now, any frontend or client app calling `/api/products/123` is talking to the new service, while everything else (e.g., `/cart`, `/login`) still goes to the monolith.

### Step 4: Synchronize Data (The "Fig Roots")

The new Product Service needs live data. The monolith remains the source of truth during the transition. We set up data synchronization:

#### Option 1 (Simple)
The new service writes directly to the monolith's database for product updates (not ideal, as it creates coupling).

#### Option 2 (Better)
The monolith publishes events (e.g., `ProductCreated`, `ProductPriceUpdated`, `ProductDeleted`) to a message broker like Kafka or RabbitMQ.

The new Product Service subscribes to these events and updates its own database accordingly. This keeps the new service's data eventually consistent with the monolith.

This event-driven connection is like the roots of the Strangler Fig—it slowly takes sustenance from the host system.

### Step 5: Incrementally Strangle More Functions

Repeat the process for the next functionality.

**Next Target:** The "Product Search" functionality.

**Action:** Build a new Search Service (e.g., using Elasticsearch). Configure the router to send traffic from `/api/search*` to this new service.

The architecture now looks like this:

```
[Client] -> [API Gateway]
                  |
                  |--> /api/products/* -> [Product Service] -> [Product DB]
                  |--> /api/search/*   -> [Search Service]  -> [Elasticsearch]
                  |--> /*              -> [Legacy Monolith] -> [Monolith DB]
```

### Step 6: Eventually Retire the Monolith

After many iterations, the routing table might look like this:

```
Location: `/api/products/*`  -> [Product Service]
Location: `/api/search/*`    -> [Search Service]
Location: `/api/cart/*`      -> [Cart Service]
Location: `/api/orders/*`    -> [Order Service]
Location: `/api/users/*`     -> [User Service]
Location: `/*`               -> [Legacy Monolith] # Now only handles a few obscure admin features
```

Finally, the last few features in the monolith are either decommissioned or rewritten as microservices. The monolith is now a "hollow shell," handling no meaningful traffic. You can shut it down permanently.

## How to Configure It (Technical Example with Nginx)

Here's a simplified snippet of what the configuration for the API Gateway (Nginx) might look like during the middle of the strangulation process:

```nginx
# api_gateway.conf

upstream legacy_monolith {
    server bigshop-old-app.internal:8000;
}

upstream product_service {
    server bigshop-product-service.internal:8001;
}

upstream search_service {
    server bigshop-search-service.internal:8002;
}

server {
    listen 80;
    server_name bigshop.com;

    # Rule 1: Strangle Product Details API calls
    location /api/products/ {
        # Rewrite the URL to pass to the new service (if needed)
        # rewrite ^/api/products/(.*) /$1 break;
        proxy_pass http://product_service/;
    }

    # Rule 2: Strangle Search API calls
    location /api/search/ {
        proxy_pass http://search_service/;
    }

    # Rule 3: Default - send everything else to the old monolith
    location / {
        proxy_pass http://legacy_monolith;
    }
}
```

## Key Benefits of the Pattern

### 1. Low Risk
If the new Product Service fails, you can quickly revert the router configuration to send `/api/products/*` back to the monolith. The entire application isn't down.

### 2. Incremental
You can do this one feature at a time, at your own pace. The business doesn't need to freeze feature development for a year for a full rewrite.

### 3. Budget-Friendly
The migration cost is spread over time, aligning with normal development cycles.

### 4. Safe Testing
You can use the router to send a small percentage of live traffic (e.g., 5%) to the new service for canary testing before a full cut-over.

## Advanced Considerations

### Traffic Splitting for Canary Deployments

```nginx
# Advanced: Split traffic 95% to monolith, 5% to new service for testing
upstream backend {
    server bigshop-old-app.internal:8000 weight=95;
    server bigshop-product-service.internal:8001 weight=5;
}

location /api/products/ {
    proxy_pass http://backend;
}
```

### Health Checks and Fallback

```nginx
location /api/products/ {
    proxy_pass http://product_service;
    
    # Fallback to monolith if product service is down
    proxy_next_upstream error timeout http_500 http_502 http_503;
    proxy_next_upstream_tries 1;
    
    # If product service fails, try the monolith
    error_page 502 503 504 = @fallback;
}

location @fallback {
    proxy_pass http://legacy_monolith;
}
```

## Conclusion

The Strangler Fig Pattern is the industry-standard, sane approach to modernizing critical systems that you cannot afford to stop and rebuild from scratch. It respects the fact that most companies need to keep the business running while engineering evolves the platform.

### Key Takeaways

1. **Start small** - Pick one well-defined function to extract first
2. **Use routing** - An API Gateway or reverse proxy is essential
3. **Maintain data consistency** - Use events or shared databases during transition
4. **Be incremental** - One service at a time reduces risk
5. **Plan for rollback** - Always have a way to revert changes quickly
6. **Test safely** - Use traffic splitting for gradual rollouts

This pattern allows organizations to modernize their architecture while maintaining business continuity and minimizing risk.