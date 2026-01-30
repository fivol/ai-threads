# AI Threads

A thinking tool that generates AI-powered thought continuations to help you explore and develop ideas.

## Demo

[Live Demo](https://your-username.github.io/ai-threads)

## How It Works

1. **Create a thread** and write your initial thought
2. **AI generates** multiple continuation candidates
3. **Select** the ones that resonate with you
4. **Keep exploring** as new candidates appear when you scroll

Only selected thoughts become the AI's context. Everything else is temporary.

## Features

- **Infinite stream** — scroll down to generate more ideas automatically
- **Smart selection** — choosing a candidate removes skipped ones
- **Regenerate** — tap sparkle button to get fresh candidates
- **Star thoughts** — mark important ideas for later
- **Export/Import** — backup and restore your threads as JSON
- **Custom prompts** — set global or per-thread AI instructions
- **Multiple providers** — supports OpenAI and Anthropic (Claude)
- **Offline-first** — all data stored locally in browser (IndexedDB)
- **Token tracking** — monitor API usage per thread and globally

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI or Anthropic API key

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/ai-threads.git
cd ai-threads

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

1. Open the app and click the **Settings** icon (gear)
2. Select your AI provider (OpenAI or Anthropic)
3. Enter your API key
4. Choose a model using Quick Presets or enter manually
5. Optionally customize the global prompt

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build tool**: Vite
- **State management**: MobX
- **Storage**: IndexedDB (via idb library)
- **Styling**: CSS (mobile-first design)
- **Routing**: React Router

## Project Structure

```
src/
├── components/         # React components
│   ├── Home.tsx             # Thread list view
│   ├── ThreadView.tsx       # Main thinking interface
│   ├── Settings.tsx         # Global settings
│   ├── ThreadSettings.tsx   # Per-thread settings
│   ├── Starred.tsx          # Starred thoughts view
│   ├── Icons.tsx            # SVG icon components
│   └── Toast.tsx            # Notifications
├── stores/             # MobX state management
│   ├── ThreadsStore.ts      # Threads & thoughts
│   └── SettingsStore.ts     # App configuration
├── services/           # External services
│   └── ai.ts                # AI provider abstraction
├── db/                 # Data persistence
│   └── index.ts             # IndexedDB operations
└── types/              # TypeScript definitions
    └── index.ts
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Deployment

The app is configured for GitHub Pages deployment. Push to `main` branch triggers automatic deployment.

### Manual Deployment

```bash
npm run build
# Deploy the `dist` folder to your hosting
```

## Privacy

- All data is stored locally in your browser
- API keys are stored in browser's IndexedDB
- No data is sent to any server except your configured AI provider
- Export your data anytime as JSON backup

## License

MIT
