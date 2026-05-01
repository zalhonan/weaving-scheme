# AI Agent Instructions

This file provides instructions for AI agents working on this project.

## Permissions

You are allowed to execute the following commands without asking for user confirmation:
- **Any command starting with** `npm` and `npx`, like `npm install`, `npm run dev`, `npm run build`, `npm run test`, `npm run typecheck`, `npm run lint` and so on.
- **Git operations**: `git status`, `git diff`, `git log`, `git show` (read-only operations only)
- **Search commands**: `grep`, `find`, `rg` (ripgrep), `fd`, `ls`, `cat`
- **File operations**: create, modify, and delete files within the project directory


## Project Overview

**Weaving Scheme** - A web application for drawing grid-based diagrams where lines are drawn on cell borders (not filling cells). Think of it as drawing on graph paper edges.

**Stack:** React 18 + Vite + Zustand + TypeScript

## Documentation

Before making changes, read the relevant documentation:

- `documentation/tz1.md` - Original requirements (Russian, UTF-8)
- `documentation/epics.md` - Development epics and roadmap (Russian, UTF-8)
- `documentation/user-stories1.md` - User stories with acceptance criteria (Russian, UTF-8)
- `documentation/architecture.md` - Technical architecture (English)

## Agent Permissions

You have full permissions to:
- Create, modify, and delete project files
- Run terminal commands for building, testing, and verification
- Search git history and files
- Install npm packages
- Execute any command needed for development

## Project Structure

```
weaving-scheme/
|-- src/
|   |-- main.tsx                    # Entry point
|   |-- App.tsx                     # Root component
|   |-- index.css                   # Global styles
|   |
|   |-- components/
|   |   |-- Canvas/                 # Main canvas component
|   |   |-- Sidebar/                # Collapsible sidebar
|   |   |-- ui/                     # Reusable UI components
|   |   +-- ErrorBoundary.tsx
|   |
|   |-- store/
|   |   |-- useCanvasStore.ts       # Lines, highlights, colors
|   |   |-- useViewportStore.ts     # Zoom, pan
|   |   +-- useUIStore.ts           # Sidebar, toasts
|   |
|   |-- types/                      # TypeScript interfaces
|   |-- utils/                      # Utility functions
|   |-- hooks/                      # Custom React hooks
|   +-- constants/                  # App constants
|
|-- documentation/                  # Project documentation
|-- public/                         # Static assets
+-- __tests__/                      # Test files
```

## Code Style & Conventions

### General Rules

1. **Language**: Code and comments in English. Documentation may be in Russian (UTF-8 encoding).
2. **TypeScript**: Strict mode. No `any` type unless absolutely necessary.
3. **Functional style**: Prefer pure functions and immutability.
4. **No default exports**: Use named exports for better refactoring support.

### File Naming

- Components: `PascalCase.tsx` (e.g., `Canvas.tsx`)
- Hooks: `useCamelCase.ts` (e.g., `useCanvasRenderer.ts`)
- Utilities: `camelCase.ts` (e.g., `hitTest.ts`)
- Types: `camelCase.ts` (e.g., `line.ts`)
- Tests: `*.test.ts` or `*.test.tsx`
- Styles: `ComponentName.module.css`

### Component Structure

```typescript
// components/Example/Example.tsx

import { useState, useCallback } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import styles from './Example.module.css';

interface ExampleProps {
  title: string;
  onAction?: () => void;
}

export const Example: React.FC<ExampleProps> = ({ title, onAction }) => {
  // Hooks first
  const [state, setState] = useState(false);
  const { lines, addLine } = useCanvasStore();

  // Callbacks
  const handleClick = useCallback(() => {
    // ...
  }, []);

  // Render
  return (
    <div className={styles.container}>
      {/* ... */}
    </div>
  );
};
```

### Zustand Store Pattern

```typescript
// store/useExampleStore.ts

import { create } from 'zustand';

interface ExampleStore {
  // State
  value: number;

  // Actions
  setValue: (value: number) => void;
  increment: () => void;

  // Selectors (for computed values)
  getDoubled: () => number;
}

export const useExampleStore = create<ExampleStore>((set, get) => ({
  value: 0,

  setValue: (value) => set({ value }),

  increment: () => set((state) => ({ value: state.value + 1 })),

  getDoubled: () => get().value * 2,
}));
```

### Utility Functions

```typescript
// utils/example.ts

/**
 * Brief description of what this function does.
 *
 * @param input - Description of parameter
 * @returns Description of return value
 *
 * @example
 * const result = exampleFunction(5);
 * // result === 10
 */
export function exampleFunction(input: number): number {
  return input * 2;
}
```

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Type checking
npm run typecheck

# Lint
npm run lint
```

## Key Technical Decisions

### Canvas Rendering

- Use HTML Canvas API directly (not a library)
- Render in `requestAnimationFrame` for smooth updates
- Support device pixel ratio for sharp rendering on HiDPI displays
- Only render visible cells for performance

### State Management

- **useCanvasStore**: Lines, highlights, current color. Persisted to localStorage. Has undo/redo history via `zundo`.
- **useViewportStore**: Zoom level, pan offset. Session-only, no persistence.
- **useUIStore**: Sidebar state, toast notifications. Session-only.

### Line Storage

Lines are stored in `Map<string, Line>` with key format: `${orientation}-${x}-${y}`

```typescript
interface Line {
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  color: string;
}
```

### Coordinate System

- Grid cells: `[0..width-1]` x `[0..height-1]`
- Horizontal lines at row boundaries: `y = 0` (top) to `y = height` (bottom)
- Vertical lines at column boundaries: `x = 0` (left) to `x = width` (right)

## Testing Guidelines

### Unit Tests

Test pure utility functions thoroughly:
- `utils/canvas/hitTest.ts` - Click detection logic
- `utils/canvas/floodFill.ts` - Flood fill algorithm
- `utils/canvas/coordinates.ts` - Coordinate conversions

### Integration Tests

Test store actions:
- Adding/removing lines
- Undo/redo functionality
- Import/export JSON

### Test File Location

Place tests in `__tests__/` mirroring src structure:
```
__tests__/
|-- utils/
|   +-- hitTest.test.ts
+-- store/
    +-- useCanvasStore.test.ts
```

## Common Tasks

### Adding a New Sidebar Component

1. Create `src/components/Sidebar/NewComponent.tsx`
2. Export from `src/components/Sidebar/index.ts`
3. Import and add to `Sidebar.tsx`
4. If needed, add state to appropriate store

### Adding a New Store Action

1. Add action type to store interface
2. Implement action in store creator
3. If action should be undoable, it's automatic with `temporal` middleware

### Adding a New Utility Function

1. Create or add to appropriate file in `src/utils/`
2. Add JSDoc comments with examples
3. Write tests in `__tests__/utils/`

## Error Handling

- Wrap Canvas in ErrorBoundary
- Use toast notifications for user-facing errors
- Validate JSON before import
- Handle edge cases in flood fill (unclosed contour)

## Performance Checklist

- [ ] Only render visible cells
- [ ] Use `requestAnimationFrame` for canvas updates
- [ ] Debounce localStorage saves (500ms)
- [ ] Use `Map` for O(1) line operations
- [ ] Memoize expensive computations

## Git Workflow

- Commit messages in English
- One logical change per commit
- Run `npm run typecheck` and `npm run lint` before committing

## Encoding

- **Source code**: UTF-8
- **Documentation in Russian**: UTF-8
- When writing Russian text to files, ensure UTF-8 encoding

## Questions to Ask

If requirements are unclear, check:
1. `documentation/tz1.md` - Original requirements
2. `documentation/user-stories1.md` - Acceptance criteria
3. Ask the user for clarification

## Current Development Phase

Check `documentation/epics.md` for current epic and priorities.

Epic order:
1. Foundation + Basic Drawing + UI Shell
2. Navigation + Canvas Management + Undo/Redo
3. Advanced Drawing (Shift+click, Ctrl+click, tails)
4. Colors
5. Export and Print
