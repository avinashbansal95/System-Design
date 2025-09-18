# TypeScript: `type` vs `interface` - Complete Guide

Great question! In TypeScript, both `type` and `interface` are used to define the shape of objects, but they have important differences in behavior, philosophy, and best practices. Here's a comprehensive breakdown:

## ✅ Key Differences Between `type` and `interface`

| Feature | `interface` | `type` |
|---------|-------------|--------|
| **Extensibility** | Can be extended with `extends` and merged (declaration merging) | Cannot be extended or merged (but can use `&` for intersection) |
| **Usage for primitives/unions** | ❌ Cannot define primitive types, unions, tuples directly | ✅ Can define: `string`, `number`, `boolean`, `union`, `tuple`, literal types |
| **Declaration Merging** | ✅ Supported — multiple interfaces with same name merge into one | ❌ Not supported — duplicate `type` declarations cause errors |
| **Syntax Style** | More "class-like", object-oriented | More flexible, functional/ADT style |
| **Performance / Tooling** | Slightly better performance in large codebases due to merging optimizations | Slightly more overhead when complex unions/intersections are involved |

## 📌 Examples

### 1. Defining Object Shapes (Both work similarly)

```typescript
// Interface
interface User {
  name: string;
  age: number;
}

// Type alias
type User = {
  name: string;
  age: number;
};
```

✅ Both are interchangeable here.

### 2. Union Types & Primitives → Only `type` works

```typescript
type Status = 'active' | 'inactive' | 'pending'; // ✅ OK
type Point = [number, number]; // ✅ Tuple

interface Status { } // ❌ Error: interface can't be a union
interface Point { }  // ❌ Error: interface can't be a tuple
```

### 3. Extending Types

```typescript
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
}

// Equivalent with type:
type Animal = { name: string };
type Dog = Animal & { breed: string }; // Uses intersection
```

👉 `interface` is more natural for inheritance-style patterns.

### 4. Declaration Merging → Only `interface` supports this

```typescript
interface User {
  name: string;
}

interface User {
  age: number; // ✅ Merged!
}

// Now User has both name and age
const u: User = { name: "Alice", age: 30 };
```

This is impossible with `type`:

```typescript
type User = { name: string };
type User = { age: number }; // ❌ Duplicate identifier error!
```

💡 Declaration merging is useful in libraries where you want to allow users to extend types without modifying the original source (e.g., augmenting third-party types).

### 5. Mapped Types & Complex Utilities

```typescript
type PartialUser = Partial<User>; // ✅ Works with type aliases
interface PartialUser = Partial<User>; // ❌ Syntax error!
```

You can't use utility types like `Partial<T>`, `Pick<T>`, `Record<K,T>` on interfaces directly — only on `type`.

## 🤔 When to Use Which?

### ✅ Use `interface` when:

- You're defining object shapes (especially for APIs, components, or data models).
- You expect extensibility via `extends`.
- You're working in a team using declaration merging (common in library development).
- You want to follow OOP-style conventions.
- You're defining React component props (popular convention).

🟢 **"Use interface for object contracts."**

### ✅ Use `type` when:

- You need unions, primitives, tuples, or literal types.
- You want to create mapped types (`Partial<T>`, etc.).
- You're defining complex intersections (`A & B & C`).
- You're creating aliases for readability (e.g., `type ButtonVariant = 'primary' | 'secondary'`).
- You don't need declaration merging.

🟢 **"Use type for everything else — especially non-object shapes."**

## 🏆 Best Practice Summary (Community Consensus)

| Use Case | Recommended | Alternative |
|----------|-------------|-------------|
| Defining object structure (e.g., API response, component props) | ✅ `interface` | `type` |
| Union types (`string \| number`) | ✅ `type` | - |
| Tuples (`[string, number]`) | ✅ `type` | - |
| Utility types (`Partial<T>`, `Pick<T>`) | ✅ `type` | - |
| Extending existing types (like React's `ComponentProps`) | ✅ `interface` | `type` |
| Library author wanting to allow augmentation | ✅ `interface` | - |
| Simple alias for clarity | ✅ `type` | - |
| You're unsure | ✅ Start with `type` — it's more flexible | - |

⚠️ **Pro Tip:** Many teams prefer `type` for consistency since it's more powerful and covers all cases — except when you specifically need declaration merging.

## 💡 Real-World Example: React Props

```tsx
// ✅ Recommended: interface for component props (convention)
interface ButtonProps {
  onClick: () => void;
  variant: 'primary' | 'secondary';
  disabled?: boolean;
}

// ✅ Also fine: type
type ButtonProps = {
  onClick: () => void;
  variant: 'primary' | 'secondary';
  disabled?: boolean;
};

// But if you want to extend later...
interface ButtonProps {
  ariaLabel?: string; // ✅ Declaration merging allows this elsewhere
}
```

In React ecosystems, `interface` is still the de facto standard for props — mostly due to historical reasons and tooling support (e.g., IDE autocomplete). But `type` is equally valid.

## ✅ Final Decision Flowchart (Simplified)

```
Do you need to define:
├── A plain object shape?          → Use interface (or type, your call)
├── A union/tuple/literal?         → Use type
├── A mapped/picked utility type?  → Use type
├── Want to extend later?          → Use interface
└── Are you writing a library?     → Consider interface for merging
```

## 🔥 Modern Recommendation

**Use `type` by default** unless you specifically need declaration merging or are following a team/library convention that prefers `interface`.

**Why?** `type` is more expressive and covers all cases. `interface` is a subset.

## ✅ Bonus: TypeScript Team's Official Stance

- **Old advice:** "Use `interface` when you can, `type` when you must."
- **Today:** "Use whichever feels right — they're mostly interchangeable." — TypeScript Handbook

The TS team now considers them largely equivalent for object shapes, so consistency within your project matters more than dogma.

## ✅ TL;DR — Quick Rules

| Use Case | Recommendation |
|----------|----------------|
| Object shapes | Either — `interface` is traditional, `type` is modern |
| Unions, literals, tuples | ✅ Only `type` |
| Extending types | ✅ Prefer `interface` |
| Merging declarations | ✅ Only `interface` |
| Utility types (Partial, etc.) | ✅ Only `type` |
| React props | ✅ `interface` preferred (community norm) |
| **General rule** | ✅ **Use `type` unless you need merging** |

---

Let me know if you'd like a cheat sheet PDF version or examples for React, Node.js, or NestJS contexts!