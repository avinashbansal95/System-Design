# System-Design
# Kubernetes Architecture - Master and Worker Nodes

## The High-Level Architecture: Master and Worker Nodes

A Kubernetes cluster is made up of at least one **Master Node** (the control plane) and one or more **Worker Nodes** (where your applications actually run).

## 1. The Master Node (The Control Plane / The Brain)

The Master is the brain of the entire cluster. It's responsible for making global decisions about the cluster (e.g., scheduling applications), detecting and responding to cluster events (e.g., a pod crashing), and managing the overall cluster state. You talk to the Master to control the cluster.

It consists of several key components:

### kube-apiserver
This is the **front door** to the control plane. It's the only component you (or any other component) talk to directly. It exposes a REST API that you use with tools like `kubectl` (the Kubernetes CLI). All communication, whether from a user, a worker node, or internal components, goes through the API server. It validates and processes requests.

### etcd
This is the **"single source of truth"** for the entire cluster. It's a consistent and highly-available key-value store. etcd stores all cluster data, such as what nodes exist, what pods are running, their state, their configuration, and secrets. The API server is the only component that talks to etcd to ensure data is stored correctly.

### kube-scheduler
This is the **matchmaker**. Its only job is to watch for newly created Pods (a group of one or more containers) that have no node assigned. For every Pod, the scheduler finds the best Worker Node for it to run on based on factors like:

- Resource requirements (e.g., CPU, RAM)
- Software/hardware constraints (e.g., the pod needs a GPU)
- Affinity/anti-affinity rules (e.g., "run this pod near that other pod" or "don't run two copies of this pod on the same node")
- Taints and tolerations

### kube-controller-manager
This is the **continuous control loop**. A controller is a process that watches the current state of the cluster (via the API server) and works to move it towards the desired state.

- The **Node Controller** notices when nodes go down and responds
- The **Replication Controller** ensures the correct number of Pod replicas are running at all times (e.g., if you asked for 3 replicas and one dies, it makes a new one)
- There are many other controllers for jobs, endpoints, etc.

### cloud-controller-manager (Optional)
This lets you link your cluster into your cloud provider's API (e.g., AWS, GCP, Azure). It separates the Kubernetes core logic from cloud-specific logic for managing things like load balancers, storage volumes, and virtual machine nodes.

## 2. The Worker Nodes (The Muscle / The Workhorses)

Worker Nodes are the machines (VMs or physical servers) where your containerized applications actually run. Each node must run the necessary components to communicate with the Master and manage the container runtime.

### kubelet
This is the primary **"node agent"**. It runs on every node. Its job is to take a set of PodSpecs (YAML/JSON definitions) provided to it (usually from the API server) and ensure that the containers described in those PodSpecs are running and healthy. It's the bridge between the Master and the container runtime on the node.

### kube-proxy
This is the **network wizard** on each node. It maintains network rules on the node. These rules allow network communication to your Pods from inside or outside the cluster. It is responsible for implementing the concept of a Kubernetes Service (a stable network endpoint to talk to a group of Pods), often using load-balancing.

### Container Runtime
This is the underlying software that is responsible for running containers. Kubernetes supports several runtimes through the Container Runtime Interface (CRI), such as:
- **containerd** (most common now)
- **CRI-O**
- **Docker Engine** (deprecated)

## How It All Works Together: A Simple Example

Let's say you want to run a web application (nginx) with 3 replicas.

### 1. You Issue a Command
You write a YAML file defining your deployment and run `kubectl apply -f nginx-deployment.yaml`. kubectl talks to the `kube-apiserver`.

### 2. API Server Persists
The `kube-apiserver` validates your request and stores the desired state (3 nginx pods) in `etcd`.

### 3. Scheduler Acts
The `kube-scheduler` sees, via the API server, that there are new Pods with no assigned node. It chooses the best Worker Nodes for them based on resources and constraints.

### 4. Kubelet Executes
The `kubelet` on each chosen Worker Node is notified by the API server that it has a Pod to run. The kubelet instructs the container runtime (e.g., containerd) to pull the nginx image and start the container.

### 5. Controllers Maintain
The `kube-controller-manager` is continuously watching. If a Pod on a Worker Node crashes, the Replication Controller notices the current state (2 pods) does not match the desired state (3 pods). It tells the API server to create a new Pod, and the cycle repeats.

### 6. kube-proxy Handles Traffic
You create a Service. The `kube-proxy` on each node sets up rules so that any request to that Service's IP is correctly load-balanced to one of the 3 healthy nginx Pods, regardless of which node they are on.

## Summary Table

| Component | Runs On | What It Does |
|-----------|---------|--------------|
| **kube-apiserver** | Master | Front-end API for the cluster; the only way to interact with the cluster |
| **etcd** | Master | Highly available key-value store holding all cluster data |
| **kube-scheduler** | Master | Watches for unscheduled Pods and assigns them to a Node |
| **kube-controller-manager** | Master | Runs controllers that handle routine cluster tasks (e.g., healing Pods) |
| **kubelet** | Every Node | Agent that ensures containers are running in a Pod on its Node |
| **kube-proxy** | Every Node | Maintains network rules to allow communication to Pods |
| **Container Runtime** | Every Node | Software that runs the containers (e.g., containerd, CRI-O) |

This is the core foundation. You now understand the "machinery" of a Kubernetes cluster.

## What's Next?

Some ideas for diving deeper:

- The basic Kubernetes objects: Pods, Deployments, Services, ConfigMaps, Secrets
- How to write a simple YAML file to deploy an app
- How networking works between Pods
- How storage is handled