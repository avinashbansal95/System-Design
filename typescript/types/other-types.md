# TypeScript Utility Types Guide

## `Exclude<T, U>` - Excludes Types from Union

**What it does**: Removes specified types from a union type.

**Syntax**: `Exclude<T, U>` - removes `U` from `T`

```typescript
type Colors = 'red' | 'blue' | 'green' | 'yellow';
type PrimaryColors = Exclude<Colors, 'green' | 'yellow'>; // 'red' | 'blue'

type Mixed = string | number | boolean;
type StringsAndNumbers = Exclude<Mixed, boolean>; // string | number
```

**Use Cases**:
```typescript
// API response filtering
type AllHttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type ReadOnlyMethods = Exclude<AllHttpMethods, 'POST' | 'PUT' | 'DELETE' | 'PATCH'>; // 'GET'

// Event filtering
type AllEvents = 'click' | 'scroll' | 'resize' | 'keydown';
type MouseEvents = Exclude<AllEvents, 'scroll' | 'resize' | 'keydown'>; // 'click'

// Role-based permissions
type AllRoles = 'admin' | 'user' | 'guest' | 'moderator';
type NonAdminRoles = Exclude<AllRoles, 'admin'>; // 'user' | 'guest' | 'moderator'
```

---

## `Extract<T, U>` - Extracts Types from Union

**What it does**: Keeps only the specified types from a union type (opposite of Exclude).

**Syntax**: `Extract<T, U>` - keeps only `U` from `T`

```typescript
type Colors = 'red' | 'blue' | 'green' | 'yellow';
type WarmColors = Extract<Colors, 'red' | 'yellow'>; // 'red' | 'yellow'

type Mixed = string | number | boolean;
type Primitives = Extract<Mixed, string | boolean>; // string | boolean
```

**Use Cases**:
```typescript
// Form field types
type AllInputTypes = 'text' | 'email' | 'password' | 'number' | 'checkbox' | 'radio';
type TextInputs = Extract<AllInputTypes, 'text' | 'email' | 'password'>; // Text-based inputs

// File type filtering
type AllFileTypes = 'jpg' | 'png' | 'pdf' | 'docx' | 'mp4' | 'mp3';
type ImageTypes = Extract<AllFileTypes, 'jpg' | 'png'>; // 'jpg' | 'png'

// Status filtering
type AllStatuses = 'pending' | 'approved' | 'rejected' | 'draft';
type ActiveStatuses = Extract<AllStatuses, 'pending' | 'approved'>; // 'pending' | 'approved'
```

---

## `NonNullable<T>` - Excludes null and undefined

**What it does**: Removes `null` and `undefined` from a type.

**Syntax**: `NonNullable<T>` - equivalent to `Exclude<T, null | undefined>`

```typescript
type MaybeString = string | null | undefined;
type DefiniteString = NonNullable<MaybeString>; // string

type Optional = number | null;
type Required = NonNullable<Optional>; // number
```

**Use Cases**:
```typescript
// API response handling
interface User {
  id: number;
  name: string;
  email?: string | null;
}

function processUser(user: User) {
  // Email might be null/undefined, so we need to handle it
  if (user.email) {
    const validEmail: NonNullable<User['email']> = user.email; // string
    sendEmail(validEmail);
  }
}

// Array filtering
const mixedArray: (string | null | undefined)[] = ['hello', null, 'world', undefined];
const validStrings: NonNullable<typeof mixedArray[0]>[] = mixedArray.filter(
  (item): item is NonNullable<typeof item> => item != null
); // string[]

// Configuration with optional values
interface Config {
  apiUrl?: string | null;
  timeout?: number | null;
}

function initializeApp(config: Config) {
  const apiUrl: NonNullable<Config['apiUrl']> = config.apiUrl || 'default-api-url';
  const timeout: NonNullable<Config['timeout']> = config.timeout || 5000;
}
```

---

## `ReturnType<T>` - Gets Function Return Type

**What it does**: Extracts the return type of a function type.

**Syntax**: `ReturnType<T>` where `T` is a function type

```typescript
function getUser() {
  return { id: 1, name: 'John', email: 'john@example.com' };
}

type User = ReturnType<typeof getUser>; // { id: number; name: string; email: string; }

const createProduct = () => ({
  id: 123,
  title: 'Product',
  price: 99.99
});

type Product = ReturnType<typeof createProduct>; // { id: number; title: string; price: number; }
```

**Use Cases**:
```typescript
// API response typing
async function fetchUsers() {
  const response = await fetch('/api/users');
  return response.json() as { users: User[]; total: number };
}

type FetchUsersResponse = ReturnType<typeof fetchUsers>; // Promise<{ users: User[]; total: number; }>
type UsersData = Awaited<ReturnType<typeof fetchUsers>>; // { users: User[]; total: number; }

// Hook return types (React-like)
function useCounter(initialValue: number = 0) {
  const [count, setCount] = useState(initialValue);
  return {
    count,
    increment: () => setCount(c => c + 1),
    decrement: () => setCount(c => c - 1),
    reset: () => setCount(initialValue)
  };
}

type CounterHook = ReturnType<typeof useCounter>; 
// { count: number; increment: () => void; decrement: () => void; reset: () => void; }

// Utility function typing
const parseApiResponse = (response: string) => {
  const data = JSON.parse(response);
  return {
    success: true,
    data,
    timestamp: new Date()
  };
};

type ApiParseResult = ReturnType<typeof parseApiResponse>;
// { success: boolean; data: any; timestamp: Date; }
```

---

## `Parameters<T>` - Gets Function Parameter Types

**What it does**: Extracts parameter types of a function as a tuple.

**Syntax**: `Parameters<T>` where `T` is a function type

```typescript
function createUser(name: string, age: number, email: string) {
  return { name, age, email };
}

type CreateUserParams = Parameters<typeof createUser>; // [string, number, string]

// Accessing individual parameters
type FirstParam = Parameters<typeof createUser>[0]; // string
type SecondParam = Parameters<typeof createUser>[1]; // number
```

**Use Cases**:
```typescript
// Function wrapper/decorator
function loggedFunction<T extends (...args: any[]) => any>(
  fn: T,
  ...args: Parameters<T>
): ReturnType<T> {
  console.log('Calling function with args:', args);
  return fn(...args);
}

const result = loggedFunction(createUser, 'John', 25, 'john@example.com');

// Event handler typing
const handleSubmit = (event: Event, formData: FormData, userId: number) => {
  // Handle form submission
};

type SubmitHandlerParams = Parameters<typeof handleSubmit>;
// [Event, FormData, number]

// Currying functions
function curry<T extends (...args: any[]) => any>(fn: T) {
  return (...args: Parameters<T>) => fn(...args);
}

// Middleware pattern
type MiddlewareFunction = (req: Request, res: Response, next: () => void) => void;
type MiddlewareParams = Parameters<MiddlewareFunction>; // [Request, Response, () => void]

function createMiddleware(handler: MiddlewareFunction) {
  return (...args: MiddlewareParams) => {
    // Pre-processing
    handler(...args);
    // Post-processing
  };
}
```

---

## `ConstructorParameters<T>` - Gets Constructor Parameter Types

**What it does**: Extracts parameter types of a constructor function.

**Syntax**: `ConstructorParameters<T>` where `T` is a constructor function

```typescript
class User {
  constructor(public name: string, public age: number, public email?: string) {}
}

type UserConstructorParams = ConstructorParameters<typeof User>; // [string, number, string?]

// Built-in constructors
type DateParams = ConstructorParameters<typeof Date>; // [string | number | Date]
type ArrayParams = ConstructorParameters<typeof Array>; // [number] | any[]
```

**Use Cases**:
```typescript
// Factory pattern
class DatabaseConnection {
  constructor(private host: string, private port: number, private database: string) {}
}

function createConnection(...args: ConstructorParameters<typeof DatabaseConnection>) {
  console.log('Creating connection with:', args);
  return new DatabaseConnection(...args);
}

const connection = createConnection('localhost', 5432, 'myapp');

// Dependency injection
class EmailService {
  constructor(private apiKey: string, private sender: string) {}
}

class NotificationService {
  constructor(private emailService: EmailService, private smsService: any) {}
}

type EmailServiceDeps = ConstructorParameters<typeof EmailService>; // [string, string]
type NotificationDeps = ConstructorParameters<typeof NotificationService>; // [EmailService, any]

// Generic factory
function createInstance<T extends new (...args: any[]) => any>(
  constructor: T,
  ...args: ConstructorParameters<T>
): InstanceType<T> {
  return new constructor(...args);
}

const user = createInstance(User, 'John', 25, 'john@example.com');
```

---

## `InstanceType<T>` - Gets Instance Type of Constructor

**What it does**: Gets the instance type that a constructor function creates.

**Syntax**: `InstanceType<T>` where `T` is a constructor function

```typescript
class User {
  constructor(public name: string, public age: number) {}
  
  greet() {
    return `Hello, I'm ${this.name}`;
  }
}

type UserInstance = InstanceType<typeof User>; // User instance type

// Built-in constructors
type DateInstance = InstanceType<typeof Date>; // Date
type ArrayInstance = InstanceType<typeof Array>; // any[]
```

**Use Cases**:
```typescript
// Generic repository pattern
abstract class Repository<T> {
  abstract find(id: string): T | null;
  abstract save(entity: T): void;
}

class UserRepository extends Repository<User> {
  find(id: string): User | null {
    // Implementation
    return null;
  }
  
  save(user: User): void {
    // Implementation
  }
}

type RepositoryInstance = InstanceType<typeof UserRepository>; // UserRepository
type BaseRepositoryType<T extends new (...args: any[]) => Repository<any>> = InstanceType<T>;

// Plugin system
interface Plugin {
  name: string;
  init(): void;
}

class AuthPlugin implements Plugin {
  name = 'auth';
  constructor(private config: { secret: string }) {}
  init() { console.log('Auth plugin initialized'); }
}

class LoggingPlugin implements Plugin {
  name = 'logging';
  constructor(private level: 'info' | 'debug' | 'error') {}
  init() { console.log('Logging plugin initialized'); }
}

type PluginConstructor = new (...args: any[]) => Plugin;

function registerPlugin<T extends PluginConstructor>(
  PluginClass: T,
  ...args: ConstructorParameters<T>
): InstanceType<T> {
  const plugin = new PluginClass(...args);
  plugin.init();
  return plugin;
}

const authPlugin = registerPlugin(AuthPlugin, { secret: 'my-secret' });
const loggingPlugin = registerPlugin(LoggingPlugin, 'debug');

// Type-safe event emitter
class EventEmitter<T extends Record<string, any[]>> {
  private listeners: { [K in keyof T]?: Array<(...args: T[K]) => void> } = {};
  
  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }
}

type EventEmitterInstance = InstanceType<typeof EventEmitter<{
  'user-login': [string, Date];
  'user-logout': [string];
}>>;
```

## Summary

These utility types are powerful tools for:

- **`Exclude/Extract`**: Filtering union types for specific use cases
- **`NonNullable`**: Ensuring type safety by removing null/undefined
- **`ReturnType`**: Getting function return types for type inference
- **`Parameters`**: Extracting function parameters for wrappers/decorators
- **`ConstructorParameters`**: Building factory patterns and dependency injection
- **`InstanceType`**: Working with class instances in generic contexts

They're essential for building type-safe, maintainable TypeScript applications, especially when working with functions, classes, and complex type manipulations.