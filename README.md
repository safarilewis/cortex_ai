# Knowledge Graph Notes

An intelligent note-taking application built as an MCP (Model Context Protocol) server that automatically builds and visualizes knowledge graphs from your notes. Create interconnected notes, visualize relationships, and discover insights through an interactive graph interface.

## Features

✨ **Interactive Knowledge Graph Visualization** — See your notes as an interactive force-directed graph, with visual connections showing how notes relate to each other.

📝 **Smart Note Creation** — Add notes with titles, content, and tags. The system automatically analyzes connections between notes.

🔗 **Automatic Relationship Detection** — The knowledge graph automatically computes connections between notes with strength metrics and reasoning.

🏷️ **Tag-Based Organization** — Organize notes with flexible tagging for easy discovery and filtering.

🔍 **Full-Text Search** — Search across note titles and content with PostgreSQL's powerful text search capabilities.

💾 **Persistent Storage** — All notes are stored in Supabase, ensuring your knowledge graph persists across sessions.

⚡ **Real-Time UI Updates** — Built with React and Tailwind CSS for a responsive, modern interface.

## Tech Stack

- **Backend**: TypeScript, Node.js
- **Frontend**: React 19, React Router, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Server Framework**: mcp-use
- **Visualization**: React Force Graph for knowledge graph rendering
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (for persistence, optional for local development)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd trial
```

2. Install dependencies:

```bash
npm install
```

3. (Optional) Set up environment variables for Supabase persistence:

```bash
cp .env.example .env
```

Then add your Supabase credentials:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-or-anon-key
```

If you don't configure Supabase, the app will work in-memory (notes won't persist across restarts).

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3000/inspector](http://localhost:3000/inspector).

The server automatically reloads as you make changes to the code.

### Building

Build the project for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Project Structure

```
trial/
├── index.ts                           # Main MCP server with tools and resources
├── package.json                       # Dependencies and scripts
├── schema.sql                         # Supabase database schema
├── tsconfig.json                      # TypeScript configuration
├── resources/
│   ├── styles.css                     # Global styles
│   └── knowledge-graph/               # Knowledge graph widget
│       ├── widget.tsx                 # Main React widget component
│       ├── types.ts                   # TypeScript types and schemas
│       ├── hooks/
│       │   └── useForceGraph.ts       # Force graph visualization hook
│       └── components/
│           ├── GraphView.tsx          # Knowledge graph visualization
│           ├── NotesList.tsx          # Notes sidebar/list view
│           ├── NoteDetail.tsx         # Individual note detail view
│           └── AddNoteForm.tsx        # Form for creating new notes
└── public/
    └── fruits/                        # Static assets
```

## Database Schema

The project uses Supabase with PostgreSQL. The schema includes:

- **notes** table with full-text search support
- Indexes for fast tag queries and content searching
- Optional Row-Level Security (RLS) for multi-tenant deployment

Run [schema.sql](schema.sql) in your Supabase SQL Editor to set up the database.

## Available Tools

The MCP server exposes the following tools:

- **add-note** — Create a new note with title, content, and tags
- **get-notes** — Retrieve all notes or filter by tags
- **delete-note** — Remove a note and its connections
- **compute-connections** — Analyze and compute relationships between notes

## Deployment

Deploy to Manufact Cloud:

```bash
npm run deploy
```

This will build the project and deploy the MCP server to the cloud.

## Configuration

### Environment Variables

| Variable       | Description                             | Required                        |
| -------------- | --------------------------------------- | ------------------------------- |
| `SUPABASE_URL` | Your Supabase project URL               | Optional                        |
| `SUPABASE_KEY` | Supabase API key (service-role or anon) | Optional                        |
| `MCP_URL`      | Base URL for the MCP server             | No (defaults to localhost:3000) |

### TypeScript

The project uses TypeScript with strict type checking. Run the postinstall script to generate MCP types automatically.

## Development Workflow

1. **Edit the server** (`index.ts`) — Add or modify tools and resources
2. **Edit the UI** (`resources/knowledge-graph/`) — Update React components
3. **The dev server auto-reloads** — Changes are reflected immediately
4. **Visit the inspector** — Test your changes at http://localhost:3000/inspector

## Learn More

- [mcp-use Documentation](https://mcp-use.com/docs/typescript/getting-started/quickstart)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)

## License

MIT
