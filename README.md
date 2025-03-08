# Deep Research Lab

<p align="center">
  <img src="https://via.placeholder.com/200x200?text=DRL" alt="Deep Research Lab Logo" width="200" height="200">
</p>

<p align="center">
  <b>Advanced AI-Powered Research System with Plugin Architecture</b>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#plugins">Plugins</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## Overview

Deep Research Lab is a TypeScript implementation of the DeepSearch system with a modular plugin architecture. It enables continuous research, automated web exploration, and reasoning capabilities to find answers to complex questions by leveraging the power of Large Language Models.

> **This project is under active development**

## Features

### MVP (Completed)

- **Plugin Architecture**: Flexible, extensible plugin system for custom functionality
- **Workflow Engine**: Graph-based workflow compilation and execution
- **Execution Service**: Runtime environment for executing workflows with proper state management
- **Core Plugins**:
  - Web Reader: Extract and process content from web pages
  - Search: Query search engines for relevant information
  - Reasoning: Process and analyze gathered information
  - Token Budget: Manage token consumption for LLM interactions
  - End: Properly terminate workflow execution
- **Modular Design**: Workspace-based package structure for better code organization

### Key Capabilities

- **Continuous Research**: Automatically search and read relevant web content
- **Reasoning**: Analyze information and generate insights
- **Autonomous Exploration**: Continue exploring until finding answers or reaching token budget limits

## Getting Started

```bash
# Install dependencies
pnpm install

# Run a simple example
pnpm run example

# Run the execution example
pnpm run execution-example
```

## Architecture

Deep Research Lab follows a modular architecture with these key components:

- **Plugin System**: Core framework for registering and managing plugins
- **Workflow Compiler**: Transforms workflow definitions into executable graphs
- **Execution Service**: Manages the runtime execution of compiled workflows
- **Built-in Plugins**: Pre-defined plugins providing core functionality

## Plugins

Plugins are the core building blocks of the system. Each plugin has:

- Defined input/output schemas
- Configuration options
- Processing logic

Current plugins include:
- Search Plugin: Finds relevant web resources
- Web Reader Plugin: Extracts and processes content from websites
- Reasoning Plugin: Analyzes information using LLMs
- Token Budget Plugin: Manages token consumption
- End Plugin: Terminates workflow execution properly

## Roadmap

### Planned Features

- [ ] Enhanced UI with modern design principles
  - Intuitive workflow creation interface
  - Real-time monitoring dashboard
  - Responsive design for all devices
- [ ] Advanced LLM Integration
  - Support for multiple LLM providers (OpenAI, Gemini, Anthropic)
  - Streaming responses
  - Advanced prompt engineering templates
- [ ] Research Capabilities
  - Multi-step reasoning chains
  - Citation and source tracking
  - Knowledge graph construction
- [ ] Data Management
  - Vector database integration
  - Persistent storage for workflow states
  - Historical research archiving
- [ ] Performance Optimization
  - Parallel execution of compatible tasks
  - Caching for repeated operations
  - Token usage optimization
- [ ] Developer Experience
  - Comprehensive documentation
  - Plugin development SDK
  - Testing utilities for custom plugins
- [ ] Deployment
  - Docker containerization
  - Cloud deployment guides
  - CI/CD pipeline templates

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

```bash
# Development workflow
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<p align="center">
  Made with ❤️ by the Deep Research Lab team
</p>