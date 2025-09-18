# TypeScript Generics: Complete Guide

## What are Generic Types?

Generic types in TypeScript are a way to create reusable code components that can work with multiple types rather than a single one. They allow you to write functions, classes, and interfaces that can work with any type while preserving type information.

Think of generics as "type variables" - placeholders for types that will be specified later when the generic is used.

## Why Do We Need Generics?

### The Problem Without Generics

Consider this function that returns the first element of an array:

```typescript
// Without generics - loses type information
function getFirstElement(arr: any[]): any {
    return arr[0];
}

const numbers = [1, 2, 3];
const firstNumber = getFirstElement(numbers); // Type is 'any', not 'number'
console.log(firstNumber.toFixed(2)); // No type safety!
```

### The Solution With Generics

```typescript
// With generics - preserves type information
function getFirstElement<T>(arr: T[]): T {
    return arr[0];
}

const numbers = [1, 2, 3];
const firstNumber = getFirstElement(numbers); // Type is 'number'
console.log(firstNumber.toFixed(2)); // ✅ Type safe!

const strings = ["hello", "world"];
const firstString = getFirstElement(strings); // Type is 'string'
console.log(firstString.toUpperCase()); // ✅ Type safe!
```

## Generic Syntax

### Basic Syntax

The basic syntax uses angle brackets `<>` with type parameters:

```typescript
// Function generic
function functionName<T>(param: T): T {
    return param;
}

// Interface generic
interface InterfaceName<T> {
    value: T;
}

// Class generic
class ClassName<T> {
    private value: T;
    constructor(value: T) {
        this.value = value;
    }
}

// Type alias generic
type TypeName<T> = {
    data: T;
}
```

### Multiple Type Parameters

```typescript
function pair<T, U>(first: T, second: U): [T, U] {
    return [first, second];
}

const result = pair("hello", 42); // Type is [string, number]
```

### Generic Constraints

You can constrain generics to extend certain types:

```typescript
// Constraint: T must have a length property
function logLength<T extends { length: number }>(item: T): T {
    console.log(`Length: ${item.length}`);
    return item;
}

logLength("hello");     // ✅ Works - string has length
logLength([1, 2, 3]);   // ✅ Works - array has length
// logLength(123);      // ❌ Error - number doesn't have length
```

### Conditional Types

```typescript
type ApiResponse<T> = T extends string ? string : T extends number ? number : object;

type StringResponse = ApiResponse<string>; // string
type NumberResponse = ApiResponse<number>; // number
type ObjectResponse = ApiResponse<boolean>; // object
```

## Real-World Scenarios and Use Cases

### 1. API Response Handling

```typescript
interface ApiResponse<T> {
    data: T;
    status: number;
    message: string;
}

interface User {
    id: number;
    name: string;
    email: string;
}

interface Product {
    id: number;
    title: string;
    price: number;
}

async function fetchData<T>(url: string): Promise<ApiResponse<T>> {
    const response = await fetch(url);
    return response.json();
}

// Usage with type safety
const userResponse = await fetchData<User>('/api/user/1');
console.log(userResponse.data.name); // ✅ TypeScript knows this is a string

const productResponse = await fetchData<Product>('/api/product/1');
console.log(productResponse.data.price); // ✅ TypeScript knows this is a number
```

### 2. Repository Pattern

```typescript
interface Repository<T> {
    findById(id: string): Promise<T | null>;
    findAll(): Promise<T[]>;
    create(entity: Omit<T, 'id'>): Promise<T>;
    update(id: string, entity: Partial<T>): Promise<T>;
    delete(id: string): Promise<void>;
}

class UserRepository implements Repository<User> {
    async findById(id: string): Promise<User | null> {
        // Database logic here
        return null;
    }
    
    async findAll(): Promise<User[]> {
        // Database logic here
        return [];
    }
    
    async create(userData: Omit<User, 'id'>): Promise<User> {
        // Database logic here
        return { id: 1, ...userData };
    }
    
    async update(id: string, userData: Partial<User>): Promise<User> {
        // Database logic here
        return { id: 1, name: '', email: '', ...userData };
    }
    
    async delete(id: string): Promise<void> {
        // Database logic here
    }
}

// Same pattern works for any entity
class ProductRepository implements Repository<Product> {
    // Implementation for Product entity
    // ... methods with Product-specific types
}
```

### 3. Event System

```typescript
interface EventMap {
    'user-login': { userId: string; timestamp: Date };
    'user-logout': { userId: string };
    'product-purchased': { productId: string; userId: string; amount: number };
}

class EventEmitter<T extends Record<string, any>> {
    private listeners: { [K in keyof T]?: Array<(data: T[K]) => void> } = {};
    
    on<K extends keyof T>(event: K, callback: (data: T[K]) => void): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event]!.push(callback);
    }
    
    emit<K extends keyof T>(event: K, data: T[K]): void {
        const callbacks = this.listeners[event];
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}

const eventEmitter = new EventEmitter<EventMap>();

// Type-safe event handling
eventEmitter.on('user-login', (data) => {
    console.log(`User ${data.userId} logged in at ${data.timestamp}`);
    // data is automatically typed as { userId: string; timestamp: Date }
});

eventEmitter.emit('user-login', {
    userId: '123',
    timestamp: new Date()
    // ✅ TypeScript ensures correct data structure
});
```

### 4. Form Validation

```typescript
type ValidationRule<T> = {
    validate: (value: T) => boolean;
    message: string;
};

type FormSchema<T> = {
    [K in keyof T]: ValidationRule<T[K]>[];
};

class FormValidator<T extends Record<string, any>> {
    constructor(private schema: FormSchema<T>) {}
    
    validate(data: T): { isValid: boolean; errors: Partial<Record<keyof T, string[]>> } {
        const errors: Partial<Record<keyof T, string[]>> = {};
        let isValid = true;
        
        for (const field in this.schema) {
            const fieldErrors: string[] = [];
            const rules = this.schema[field];
            const value = data[field];
            
            for (const rule of rules) {
                if (!rule.validate(value)) {
                    fieldErrors.push(rule.message);
                    isValid = false;
                }
            }
            
            if (fieldErrors.length > 0) {
                errors[field] = fieldErrors;
            }
        }
        
        return { isValid, errors };
    }
}

// Usage
interface LoginForm {
    email: string;
    password: string;
}

const loginValidator = new FormValidator<LoginForm>({
    email: [
        {
            validate: (email) => email.includes('@'),
            message: 'Email must contain @'
        },
        {
            validate: (email) => email.length > 0,
            message: 'Email is required'
        }
    ],
    password: [
        {
            validate: (password) => password.length >= 8,
            message: 'Password must be at least 8 characters'
        }
    ]
});

const result = loginValidator.validate({
    email: 'user@example.com',
    password: '12345'
});
```

### 5. State Management

```typescript
type Action<T extends string, P = {}> = {
    type: T;
    payload: P;
};

interface State {
    user: User | null;
    products: Product[];
    loading: boolean;
}

type AppAction = 
    | Action<'SET_USER', User>
    | Action<'CLEAR_USER'>
    | Action<'SET_PRODUCTS', Product[]>
    | Action<'SET_LOADING', boolean>;

function createReducer<S, A extends Action<string, any>>(
    initialState: S,
    handlers: {
        [K in A['type']]?: (
            state: S,
            action: A extends Action<K, infer P> ? Action<K, P> : never
        ) => S;
    }
) {
    return (state: S = initialState, action: A): S => {
        const handler = handlers[action.type];
        return handler ? handler(state, action as any) : state;
    };
}

const appReducer = createReducer<State, AppAction>(
    {
        user: null,
        products: [],
        loading: false
    },
    {
        'SET_USER': (state, action) => ({
            ...state,
            user: action.payload // TypeScript knows this is User
        }),
        'CLEAR_USER': (state) => ({
            ...state,
            user: null
        }),
        'SET_PRODUCTS': (state, action) => ({
            ...state,
            products: action.payload // TypeScript knows this is Product[]
        }),
        'SET_LOADING': (state, action) => ({
            ...state,
            loading: action.payload // TypeScript knows this is boolean
        })
    }
);
```

## Advanced Generic Patterns

### Utility Types with Generics

```typescript
// Pick specific properties
type UserProfile = Pick<User, 'name' | 'email'>;

// Omit specific properties
type CreateUser = Omit<User, 'id'>;

// Make all properties optional
type PartialUser = Partial<User>;

// Make all properties required
type RequiredUser = Required<Partial<User>>;

// Create a record with specific keys and values
type UserRoles = Record<'admin' | 'user' | 'guest', boolean>;
```

### Generic Constraints with keyof

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
    return obj[key];
}

const user: User = { id: 1, name: 'John', email: 'john@example.com' };
const userName = getProperty(user, 'name'); // Type is string
const userId = getProperty(user, 'id');     // Type is number
// const invalid = getProperty(user, 'invalid'); // ❌ Error
```

## Best Practices

1. **Use meaningful generic parameter names**:
   ```typescript
   // ❌ Poor
   function process<T, U, V>(a: T, b: U): V { ... }
   
   // ✅ Good
   function transform<TInput, TOutput, TConfig>(
       input: TInput, 
       config: TConfig
   ): TOutput { ... }
   ```

2. **Constrain generics when possible**:
   ```typescript
   // ✅ Better with constraints
   function sortBy<T extends { id: number }>(items: T[], key: keyof T): T[] {
       return items.sort((a, b) => a.id - b.id);
   }
   ```

3. **Provide default generic types**:
   ```typescript
   interface ApiResponse<T = any> {
       data: T;
       status: number;
   }
   ```

## Summary

Generics are essential for:
- **Type Safety**: Preserving type information across function calls
- **Code Reusability**: Writing functions/classes that work with multiple types
- **API Design**: Creating flexible yet type-safe interfaces
- **Library Development**: Building reusable components
- **Complex Data Structures**: Managing collections and transformations

They enable you to write more maintainable, scalable, and type-safe TypeScript code while avoiding duplication and maintaining flexibility.