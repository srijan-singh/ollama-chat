## Installation

# Ollama Chat - VS Code Extension

1. Clone this repository:
   ```sh
   git clone https://github.com/srijan-singh/ollama-chat.git
   cd ollama-chat
   ```
2. Install dependencies:
   ```sh
   npm install
   ```

## Usage

1. Open VS Code.
2. Press `Cmd + Shift + P` (Mac) or `Ctrl + Shift + P` (Windows/Linux).
3. Search for "Ollama Chat: Start Session" and select it.
4. Interact with the Ollama model in the chat panel.

## Directory Layout

```
ollama-chat/
├── extension.js                          # Main entry point
├── package.json                          # Extension manifest
├── src/
│   ├── commands/
│   │   └── commandHandler.js             # Command orchestration
│   ├── services/
│   │   └── ollamaService.js              # Ollama API interactions
│   └── webview/
│       ├── webviewManager.js             # Webview creation and management
│       ├── styles/
│       │   └── chat.css                  # CSS styles
│       └── scripts/
│           └── chat.js                   # Client-side JavaScript
└── node_modules/                         # Dependencies
```

## Module Responsibilities

### 1. **extension.js** (Main Entry Point)
- Extension activation/deactivation
- Service initialization
- Command registration
- Minimal logic, delegates to other modules

### 2. **src/services/ollamaService.js** (Business Logic)
- Ollama API communication
- Model listing and querying
- Error handling for API calls
- Service availability checking

### 3. **src/commands/commandHandler.js** (Command Orchestration)
- Handles VS Code commands
- Coordinates between services and UI
- User interaction logic (model selection)
- Message routing between webview and services

### 4. **src/webview/webviewManager.js** (UI Management)
- Webview creation and lifecycle
- HTML content generation
- Resource URI