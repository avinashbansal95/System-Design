# TypeScript Record Type: Complete Guide

## What is the Record Type?

The `Record` type in TypeScript is a utility type that creates an object type with specific keys and value types. It's a shorthand for creating mapped types where you know the shape of the keys and values.

## Syntax

```typescript
Record<K, T>
```

Where:
- `K` = The type of keys (must be string, number, or symbol)
- `T` = The type of values

This is equivalent to:
```typescript
{
  [P in K]: T;
}
```

## Basic Examples

### Simple Record Types

```typescript
// Record with string keys and string values
type UserRoles = Record<string, string>;
const roles: UserRoles = {
  admin: "Administrator",
  user: "Regular User",
  guest: "Guest User"
};

// Record with specific keys and number values
type Scores = Record<'math' | 'science' | 'english', number>;
const studentScores: Scores = {
  math: 95,
  science: 87,
  english: 92
  // All keys are required!
};
```

### Compared to Regular Object Types

```typescript
// Without Record (verbose)
type ConfigWithoutRecord = {
  development: string;
  staging: string;
  production: string;
}

// With Record (concise)
type Config = Record<'development' | 'staging' | 'production', string>;

// Both are equivalent!
const config: Config = {
  development: "dev.example.com",
  staging: "staging.example.com",
  production: "example.com"
};
```

## Real-Life Scenarios

### 1. HTTP Status Code Messages

```typescript
type HttpStatusCode = 200 | 201 | 400 | 401 | 404 | 500;
type StatusMessages = Record<HttpStatusCode, string>;

const statusMessages: StatusMessages = {
  200: "OK",
  201: "Created",
  400: "Bad Request",
  401: "Unauthorized", 
  404: "Not Found",
  500: "Internal Server Error"
};

// Usage in an API response handler
function getStatusMessage(code: HttpStatusCode): string {
  return statusMessages[code];
}

console.log(getStatusMessage(404)); // "Not Found"
```

### 2. Theme Configuration

```typescript
type ThemeColors = 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
type ColorPalette = Record<ThemeColors, string>;

const lightTheme: ColorPalette = {
  primary: "#007bff",
  secondary: "#6c757d", 
  success: "#28a745",
  danger: "#dc3545",
  warning: "#ffc107"
};

const darkTheme: ColorPalette = {
  primary: "#0d6efd",
  secondary: "#495057",
  success: "#198754", 
  danger: "#b02a37",
  warning: "#ffca2c"
};

// Usage in a component
function Button({ color }: { color: ThemeColors }) {
  const backgroundColor = lightTheme[color];
  return `<button style="background-color: ${backgroundColor}">Click me</button>`;
}
```

### 3. User Permissions System

```typescript
type Permission = 'read' | 'write' | 'delete' | 'admin';
type UserPermissions = Record<Permission, boolean>;

const userPermissions: UserPermissions = {
  read: true,
  write: true,
  delete: false,
  admin: false
};

// Check if user can perform an action
function canPerformAction(action: Permission): boolean {
  return userPermissions[action];
}

if (canPerformAction('delete')) {
  console.log("User can delete items");
} else {
  console.log("Access denied");
}
```

### 4. Form Validation Errors

```typescript
type FormFields = 'email' | 'password' | 'confirmPassword';
type FormErrors = Record<FormFields, string | null>;

const validationErrors: FormErrors = {
  email: null,
  password: "Password must be at least 8 characters",
  confirmPassword: "Passwords don't match"
};

// Usage in form validation
function validateForm(errors: FormErrors): boolean {
  return Object.values(errors).every(error => error === null);
}

const isFormValid = validateForm(validationErrors); // false
```

### 5. Language Translations

```typescript
type TranslationKeys = 'welcome' | 'goodbye' | 'thankyou' | 'error';
type Translations = Record<TranslationKeys, string>;

const englishTranslations: Translations = {
  welcome: "Welcome!",
  goodbye: "Goodbye!",
  thankyou: "Thank you!",
  error: "An error occurred"
};

const spanishTranslations: Translations = {
  welcome: "¡Bienvenido!",
  goodbye: "¡Adiós!",
  thankyou: "¡Gracias!",
  error: "Ocurrió un error"
};

// Translation function
function translate(key: TranslationKeys, language: 'en' | 'es' = 'en'): string {
  const translations = language === 'en' ? englishTranslations : spanishTranslations;
  return translations[key];
}

console.log(translate('welcome', 'es')); // "¡Bienvenido!"
```

### 6. Environment Configuration

```typescript
type Environment = 'development' | 'staging' | 'production';
type EnvConfig = Record<Environment, {
  apiUrl: string;
  dbUrl: string;
  logLevel: 'debug' | 'info' | 'error';
}>;

const environmentConfig: EnvConfig = {
  development: {
    apiUrl: "http://localhost:3000/api",
    dbUrl: "mongodb://localhost:27017/myapp-dev",
    logLevel: "debug"
  },
  staging: {
    apiUrl: "https://staging-api.myapp.com",
    dbUrl: "mongodb://staging-db.myapp.com:27017/myapp",
    logLevel: "info"
  },
  production: {
    apiUrl: "https://api.myapp.com",
    dbUrl: "mongodb://prod-db.myapp.com:27017/myapp",
    logLevel: "error"
  }
};

// Get current environment config
function getConfig(env: Environment) {
  return environmentConfig[env];
}

const currentConfig = getConfig('development');
console.log(currentConfig.apiUrl); // "http://localhost:3000/api"
```

### 7. Component Props Mapping

```typescript
type ComponentName = 'Button' | 'Input' | 'Modal' | 'Card';
type ComponentProps = Record<ComponentName, {
  className?: string;
  disabled?: boolean;
}>;

const defaultProps: ComponentProps = {
  Button: {
    className: "btn btn-primary",
    disabled: false
  },
  Input: {
    className: "form-control",
    disabled: false
  },
  Modal: {
    className: "modal",
    disabled: false
  },
  Card: {
    className: "card",
    disabled: false
  }
};

// Usage
function getComponentProps(componentName: ComponentName) {
  return defaultProps[componentName];
}
```

## Advanced Patterns

### Record with Complex Value Types

```typescript
type ApiEndpoint = 'users' | 'products' | 'orders';
type EndpointConfig = Record<ApiEndpoint, {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  requiresAuth: boolean;
}>;

const apiEndpoints: EndpointConfig = {
  users: {
    method: 'GET',
    url: '/api/users',
    requiresAuth: true
  },
  products: {
    method: 'GET', 
    url: '/api/products',
    requiresAuth: false
  },
  orders: {
    method: 'POST',
    url: '/api/orders',
    requiresAuth: true
  }
};
```

### Partial Record (Optional Keys)

```typescript
// All keys are optional
type PartialSettings = Partial<Record<'theme' | 'language' | 'notifications', string>>;

const userSettings: PartialSettings = {
  theme: 'dark',
  // language and notifications are optional
};
```

### Record with Union Types

```typescript
type LogLevel = 'error' | 'warn' | 'info' | 'debug';
type LogConfig = Record<LogLevel, {
  color: string;
  enabled: boolean;
}>;

const logConfiguration: LogConfig = {
  error: { color: 'red', enabled: true },
  warn: { color: 'yellow', enabled: true },
  info: { color: 'blue', enabled: true },
  debug: { color: 'gray', enabled: false }
};
```

## When to Use Record vs Other Types

### Use Record When:
- ✅ You have a known set of keys
- ✅ All values have the same type structure
- ✅ You want type safety for key access
- ✅ You need to ensure all keys are present

### Use Regular Object Type When:
- ❌ Keys have different value types
- ❌ Some properties are optional while others aren't
- ❌ You need different property modifiers (readonly, optional)

### Use Index Signature When:
- ❌ Keys are completely dynamic/unknown
- ❌ You don't know the key names at compile time

```typescript
// Record: Known keys, same value type
type Scores = Record<'math' | 'science', number>;

// Object type: Different value types
type User = {
  id: number;
  name: string;
  active: boolean;
};

// Index signature: Dynamic keys
type DynamicObject = {
  [key: string]: any;
};
```

## Key Benefits

1. **Type Safety**: Ensures all specified keys are present
2. **IntelliSense**: Better autocomplete and error detection
3. **Maintainability**: Easy to update key types in one place
4. **Readability**: Clear intent about object structure
5. **Consistency**: Enforces uniform value types across keys

## Summary

The `Record` type is perfect for creating type-safe objects where:
- You know the exact keys you want
- All values share the same type structure  
- You want to ensure all keys are implemented
- You need compile-time guarantees about object shape

It's commonly used for configurations, mappings, lookup tables, and any scenario where you have a finite set of keys with consistent value types.