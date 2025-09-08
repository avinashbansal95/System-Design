take a node.js exmaple for calculator to add,multiply
add and multiply are two microservices
treat all microservices in other repo
calculator wants to use add and multiply function. of those services
how does the grpc communication and files look like

# Complete gRPC Microservices Architecture Guide

This guide demonstrates how to build a scalable microservices architecture using gRPC with Node.js, featuring a clear separation of repositories and centralized protocol definitions.

## Project Structure (3 Separate Repositories)

### 1. company-proto (Central Protocol Definitions Repository)

```
company-proto/
├── proto/
│   ├── add_service.proto
│   └── multiply_service.proto
├── package.json
└── README.md
```

### 2. add-service (Microservice Repo 1)

```
add-service/
├── server.js
├── package.json
└── generated/          # Auto-generated files
    ├── add_service_pb.js
    └── add_service_grpc_pb.js
```

### 3. multiply-service (Microservice Repo 2)

```
multiply-service/
├── server.js
├── package.json
└── generated/          # Auto-generated files
    ├── multiply_service_pb.js
    └── multiply_service_grpc_pb.js
```

### 4. calculator-app (Client Application Repo)

```
calculator-app/
├── app.js
├── package.json
└── generated/          # Auto-generated files
    ├── add_service_pb.js
    ├── add_service_grpc_pb.js
    ├── multiply_service_pb.js
    └── multiply_service_grpc_pb.js
```

## Step 1: Central Protocol Definitions (company-proto)

### proto/add_service.proto

```protobuf
syntax = "proto3";

package calculator;

service AddService {
  rpc Add (AddRequest) returns (AddResponse) {};
}

message AddRequest {
  double a = 1;
  double b = 2;
}

message AddResponse {
  double result = 1;
}
```

### proto/multiply_service.proto

```protobuf
syntax = "proto3";

package calculator;

service MultiplyService {
  rpc Multiply (MultiplyRequest) returns (MultiplyResponse) {};
}

message MultiplyRequest {
  double a = 1;
  double b = 2;
}

message MultiplyResponse {
  double result = 1;
}
```

### package.json

```json
{
  "name": "@mycompany/calculator-proto",
  "version": "1.0.0",
  "description": "Central protocol definitions for calculator services",
  "scripts": {
    "build": "echo 'Protocol files are ready to use'"
  }
}
```

## Step 2: Add Microservice (add-service)

### package.json

```json
{
  "name": "add-service",
  "version": "1.0.0",
  "scripts": {
    "generate:proto": "grpc_tools_node_protoc --proto_path=../company-proto/proto --js_out=import_style=commonjs,binary:./generated --grpc_out=./generated --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` ../company-proto/proto/add_service.proto",
    "start": "node server.js"
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.6.0",
    "@grpc/proto-loader": "^0.6.0"
  },
  "devDependencies": {
    "grpc-tools": "^1.11.0"
  }
}
```

### server.js

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load the generated code
const addProto = require('./generated/add_service_grpc_pb');
const messages = require('./generated/add_service_pb');

// Implement the Add service
function add(call, callback) {
  console.log(`[AddService] Calculating: ${call.request.getA()} + ${call.request.getB()}`);
  
  const result = call.request.getA() + call.request.getB();
  const response = new messages.AddResponse();
  response.setResult(result);
  
  callback(null, response);
}

function main() {
  const server = new grpc.Server();
  server.addService(addProto.AddServiceService, { add });
  server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    console.log('[AddService] gRPC server running on port 50051');
    server.start();
  });
}

main();
```

## Step 3: Multiply Microservice (multiply-service)

### package.json

```json
{
  "name": "multiply-service",
  "version": "1.0.0",
  "scripts": {
    "generate:proto": "grpc_tools_node_protoc --proto_path=../company-proto/proto --js_out=import_style=commonjs,binary:./generated --grpc_out=./generated --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` ../company-proto/proto/multiply_service.proto",
    "start": "node server.js"
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.6.0",
    "@grpc/proto-loader": "^0.6.0"
  },
  "devDependencies": {
    "grpc-tools": "^1.11.0"
  }
}
```

### server.js

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load the generated code
const multiplyProto = require('./generated/multiply_service_grpc_pb');
const messages = require('./generated/multiply_service_pb');

// Implement the Multiply service
function multiply(call, callback) {
  console.log(`[MultiplyService] Calculating: ${call.request.getA()} * ${call.request.getB()}`);
  
  const result = call.request.getA() * call.request.getB();
  const response = new messages.MultiplyResponse();
  response.setResult(result);
  
  callback(null, response);
}

function main() {
  const server = new grpc.Server();
  server.addService(multiplyProto.MultiplyServiceService, { multiply });
  server.bindAsync('0.0.0.0:50052', grpc.ServerCredentials.createInsecure(), () => {
    console.log('[MultiplyService] gRPC server running on port 50052');
    server.start();
  });
}

main();
```

## Step 4: Calculator Client App (calculator-app)

### package.json

```json
{
  "name": "calculator-app",
  "version": "1.0.0",
  "scripts": {
    "generate:proto": "grpc_tools_node_protoc --proto_path=../company-proto/proto --js_out=import_style=commonjs,binary:./generated --grpc_out=./generated --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` ../company-proto/proto/*.proto",
    "start": "node app.js"
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.6.0",
    "@grpc/proto-loader": "^0.6.0",
    "readline": "^1.3.0"
  },
  "devDependencies": {
    "grpc-tools": "^1.11.0"
  }
}
```

### app.js

```javascript
const grpc = require('@grpc/grpc-js');
const readline = require('readline');

// Load generated clients
const addProto = require('./generated/add_service_grpc_pb');
const multiplyProto = require('./generated/multiply_service_grpc_pb');
const addMessages = require('./generated/add_service_pb');
const multiplyMessages = require('./generated/multiply_service_pb');

// Create gRPC clients
const addClient = new addProto.AddServiceClient(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

const multiplyClient = new multiplyProto.MultiplyServiceClient(
  'localhost:50052',
  grpc.credentials.createInsecure()
);

// Helper function to make gRPC calls
function makeRpcCall(client, method, requestMessage) {
  return new Promise((resolve, reject) => {
    client[method](requestMessage, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

// Main calculator function
async function calculate() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  while (true) {
    const input = await new Promise(resolve => {
      rl.question('Enter operation (e.g., "2 + 3" or "4 * 5", type "exit" to quit): ', resolve);
    });

    if (input.toLowerCase() === 'exit') {
      rl.close();
      break;
    }

    const [a, op, b] = input.split(' ');
    const numA = parseFloat(a);
    const numB = parseFloat(b);

    if (isNaN(numA) || isNaN(numB)) {
      console.log('Invalid numbers\n');
      continue;
    }

    try {
      let result;
      if (op === '+') {
        const request = new addMessages.AddRequest();
        request.setA(numA);
        request.setB(numB);
        const response = await makeRpcCall(addClient, 'add', request);
        result = response.getResult();
      } else if (op === '*') {
        const request = new multiplyMessages.MultiplyRequest();
        request.setA(numA);
        request.setB(numB);
        const response = await makeRpcCall(multiplyClient, 'multiply', request);
        result = response.getResult();
      } else {
        console.log('Unsupported operation. Use + or *\n');
        continue;
      }

      console.log(`Result: ${result}\n`);
    } catch (error) {
      console.error(`Error: ${error.details || error.message}\n`);
    }
  }
}

calculate().catch(console.error);
```

## How to Run This Example

### 1. Clone all repositories into the same parent directory

### 2. Setup each service:

```bash
# Terminal 1 - Add Service
cd add-service
npm install
npm run generate:proto
npm start

# Terminal 2 - Multiply Service  
cd multiply-service
npm install
npm run generate:proto
npm start

# Terminal 3 - Calculator App
cd calculator-app
npm install
npm run generate:proto
npm start
```

### 3. Use the calculator:

```
Enter operation (e.g., "2 + 3" or "4 * 5", type "exit" to quit): 5 + 3
Result: 8

Enter operation: 4 * 6  
Result: 24
```

## Key Architecture Points

### Separation of Concerns
Each service is completely independent and can be developed, deployed, and scaled separately.

### Centralized Contracts
All services use the same `.proto` definitions from the central repository, ensuring consistency across the entire system.

### Polyglot Ready
You could write the Add Service in Go, Multiply Service in Python, and Calculator App in Node.js - gRPC handles the interoperability.

### Service Discovery
In production environments, you would use service names (e.g., `add-service:50051`) instead of `localhost` for better container orchestration.

### Error Handling
Proper error handling in the client handles network issues and service failures gracefully.

This architecture demonstrates a clean, scalable microservices setup using gRPC that can easily be extended with additional services and clients!