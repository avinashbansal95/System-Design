# TypeScript Types: `any`, `unknown`, and `never`

In TypeScript, `any`, `unknown`, and `never` are three distinct types that serve different purposes in the type system. Let me explain each one and when to use them:

## `any` Type

The `any` type essentially disables TypeScript's type checking for that value. It can represent any JavaScript value and allows you to access any property or call it as a function.

```typescript
let value: any = 42;
value = "hello";        // ✅ OK
value = true;           // ✅ OK
value.foo.bar.baz;      // ✅ OK (no type checking)
value();                // ✅ OK (assumes it's callable)
```

### When to use `any`:
- Migrating JavaScript code to TypeScript incrementally
- Working with dynamic content where the type is truly unknown
- Interfacing with third-party libraries without type definitions
- Rapid prototyping (though use sparingly)

## `unknown` Type

The `unknown` type is the type-safe counterpart to `any`. It can hold any value, but you must perform type checking before using it.

```typescript
let value: unknown = 42;
value = "hello";        // ✅ OK
value = true;           // ✅ OK

// value.foo;           // ❌ Error: Object is of type 'unknown'
// value();             // ❌ Error: Object is of type 'unknown'

// Type checking required
if (typeof value === "string") {
    console.log(value.toUpperCase()); // ✅ OK - TypeScript knows it's a string
}
```

### When to use `unknown`:
- APIs that can return different types (like JSON parsing)
- User input validation
- Error handling where you don't know the error type
- When you want type safety but need to handle multiple possible types

## `never` Type

The `never` type represents values that never occur. It's used for functions that never return or variables that can never have a value.

```typescript
// Function that never returns
function throwError(message: string): never {
    throw new Error(message);
}

// Exhaustive type checking
type Color = "red" | "green" | "blue";

function handleColor(color: Color) {
    switch (color) {
        case "red":
            return "Stop";
        case "green":
            return "Go";
        case "blue":
            return "Caution";
        default:
            // This should never be reached
            const exhaustiveCheck: never = color;
            return exhaustiveCheck;
    }
}
```

### When to use `never`:
- Functions that always throw errors
- Functions with infinite loops
- Exhaustive type checking in switch statements or conditionals
- Representing impossible states in your type system
- Generic constraints to exclude certain types

## Practical Scenarios

### API Response Handling
```typescript
// Using unknown for API responses
async function fetchData(): Promise<unknown> {
    const response = await fetch('/api/data');
    return response.json(); // Returns unknown, not any
}

// Then validate the data
const data = await fetchData();
if (isValidUser(data)) {
    // Now TypeScript knows data is a User type
    console.log(data.name);
}
```

### Error Handling
```typescript
// Using unknown for caught errors
try {
    riskyOperation();
} catch (error: unknown) {
    if (error instanceof Error) {
        console.log(error.message);
    } else {
        console.log("An unknown error occurred");
    }
}
```

### State Machine with Never
```typescript
type State = "loading" | "success" | "error";

function handleState(state: State): string {
    switch (state) {
        case "loading":
            return "Loading...";
        case "success":
            return "Success!";
        case "error":
            return "Error occurred";
        default:
            // Ensures all cases are handled
            const exhaustive: never = state;
            throw new Error(`Unhandled state: ${exhaustive}`);
    }
}
```

## Key Takeaways

- **`any`**: Use when you need an escape hatch from TypeScript's type system (use sparingly)
- **`unknown`**: Use when you have a value of uncertain type but want to maintain type safety
- **`never`**: Use to represent impossible states or functions that never return normally

The general rule is to prefer `unknown` over `any` when dealing with uncertain types, as it forces you to write safer code through proper type checking.