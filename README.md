# Threads - A Thinking Engine

A cognitive tool for growing and evolving lines of thought. Not a chat, not a notes app — a thinking engine.

## Concept

At any moment, there exists only one thing that matters: the set of thoughts you've chosen to keep. These chosen thoughts are the mind of the system.

The interface is a single infinite stream:
- **Top**: Thoughts you selected earlier (the thread)
- **Bottom**: New AI-generated candidates

You scroll down to continue the mind. You scroll up to see what the mind is built from. By tapping a thought, you decide: this belongs to the thread, or this is discarded.

Only selected thoughts are passed back to the AI. Everything else is temporary.

## Features

- **Infinite stream**: Scroll down for continuous AI-generated thought candidates
- **Selection-based context**: Only what you select becomes the AI's context
- **Garbage collection**: Unselected thoughts automatically disappear
- **Starred thoughts**: Save important thoughts across threads
- **Thread prompts**: Per-thread AI behavior customization
- **Multiple providers**: Supports OpenAI and Anthropic (Claude)
- **Token tracking**: Monitor usage per thread and globally
- **Offline-first**: All data stored locally in IndexedDB

## Tech Stack

- **Framework**: React + TypeScript
- **Build tool**: Vite
- **State management**: MobX
- **Storage**: IndexedDB (via idb library)
- **Styling**: CSS (mobile-first design)
- **Routing**: React Router

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Configuration

1. Open Settings (gear icon)
2. Select your AI provider (OpenAI or Anthropic)
3. Enter your API key
4. Choose a model (or use Quick Presets)
5. Optionally customize the global prompt

## Project Structure

```
src/
├── components/     # React components
│   ├── Home.tsx         # Thread list view
│   ├── ThreadView.tsx   # Main thinking interface
│   ├── Settings.tsx     # Global settings
│   ├── ThreadSettings.tsx # Per-thread settings
│   ├── Starred.tsx      # Starred thoughts view
│   └── Icons.tsx        # SVG icon components
├── stores/         # MobX state management
│   ├── ThreadsStore.ts  # Threads & thoughts
│   └── SettingsStore.ts # App configuration
├── services/       # External services
│   └── ai.ts            # AI provider abstraction
├── db/             # Data persistence
│   └── index.ts         # IndexedDB operations
└── types/          # TypeScript definitions
    └── index.ts
```

## How It Works

1. Write a thought or select existing ones
2. Selected thoughts become the current "mind"
3. AI looks only at that mind and produces new possibilities
4. You choose what survives
5. Everything else disappears
6. The mind evolves

## License

MIT
