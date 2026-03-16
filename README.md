# Ankur Vibium AI Test Framework

> AI-native browser automation test framework — **Vibium + Jest + TypeScript + MCP + Claude**
>
> Rebuilt & modernized by **Ankur Pratap** from the [K11 Software Solutions](https://github.com/K11-Software-Solutions/k11TechLab-vibium-jest-ai-test-framework) reference framework.

## What's Different in This Fork

| Area | Original (K11) | This Rebuild |
|---|---|---|
| **AI backbone** | OpenAI Responses API | **Claude (Anthropic)** with tool use |
| **Type safety** | `any` throughout | Shared type definitions (`src/types/`) |
| **Config** | Single hardcoded env | Multi-environment support with env overrides |
| **Logging** | Basic console.log behind flag | Structured logger with levels, timestamps, file output |
| **API utils** | Assertion-only | Full HTTP client with typed responses + timing |
| **Data provider** | CSV-only | CSV + JSON + inline parametric data |
| **MCP server** | 4 tools | **8 tools** (+ type_text, screenshot, evaluate, wait_for_selector, go_back) |
| **Agent** | OpenAI loop, basic output | Claude tool-use loop with HTML+JSON reports |
| **Wait utils** | Basic state waits | + URL wait, retry helper, network idle |
| **Error handling** | Sparse | Retry logic, structured errors, screenshot-on-failure |

## Architecture

```
src/
├── types/              # Shared TypeScript interfaces
├── k11-platform/
│   ├── config/         # Multi-env app configuration
│   ├── hooks/          # Vibium browser lifecycle
│   ├── pageObjects/    # Typed page models (Home, Login, Forms, Tables, Locators)
│   ├── testdata/       # CSV/JSON test data
│   └── tests/
│       ├── smoke/      # Quick health checks
│       ├── functional/ # Feature validation
│       ├── api/        # REST API tests
│       ├── db/         # Database validation
│       ├── devices/    # Device emulation
│       ├── e2e/        # End-to-end flows
│       ├── lighthouse/ # Performance audits
│       └── generated/  # AI-generated tests
└── utils/              # API, DB, UI, Wait, Data, Debug utilities

agent/                  # Claude-powered MCP agent
mcp-server/             # Vibium MCP tool server (8 tools)
scripts/ai/             # AI test generator
reports/                # Timestamped HTML/JSON reports
artifacts/              # Screenshots, Lighthouse outputs
.github/workflows/      # CI/CD pipelines
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Anthropic API key (for AI agent)

### Install

```bash
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

### Run Tests

```bash
npm test                  # All tests
npm run test:smoke        # Smoke tests
npm run test:functional   # Functional tests
npm run test:api          # API tests
npm run test:e2e          # End-to-end tests
npm run test:ci           # CI suite (API + smoke)
```

### AI Agent (Claude + MCP)

```bash
# Start the MCP server
npm run mcp:server

# Run the agent with a goal
npm run agent:run -- "Open the K11 homepage and verify the contact page is reachable."
```

### AI Test Generation

```bash
npm run ai:generate:test -- --page-object HomePage --goal "Verify hero and navigate to services" --run
```

## Environment Configuration

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...        # Required for AI agent
CLAUDE_MODEL=claude-sonnet-4-20250514  # Model selection
TEST_ENV=production                  # local | dev | staging | production
K11_DEBUG=true                       # Enable debug logging
LOG_LEVEL=info                       # debug | info | warn | error
```

## Tech Stack

- **Vibium** — AI-native browser automation (WebDriver BiDi)
- **Jest** — Test runner and assertions
- **TypeScript** — Type-safe framework code
- **Claude (Anthropic)** — AI agent reasoning and test generation
- **MCP** — Model Context Protocol for structured tool invocation
- **Lighthouse** — Performance auditing
- **GitHub Actions** — CI/CD

## Credits

- Original framework: [K11 Software Solutions](https://github.com/K11-Software-Solutions) by **Kavita Jadhav**
- Whitepaper: [Vibium in Context: AI-Native Browser Automation](https://github.com/K11-Software-Solutions/Whitepapers)
- Rebuild: **Ankur Pratap** — modernized core, Claude integration, enhanced tooling

## License

MIT
