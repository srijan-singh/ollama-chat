// src/webview/webviewManager.js - Manages webview creation and communication
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class WebviewManager {
    constructor(context) {
        this.context = context;
        this.panel = null;
    }

    /**
     * Create and show the chat webview
     * @param {string} modelName - The selected Ollama model
     * @param {Function} messageHandler - Function to handle messages from webview
     */
    createChatPanel(modelName, messageHandler) {
        this.panel = vscode.window.createWebviewPanel(
            'ollamaChat',
            'Ollama Chat',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        // Set the HTML content
        this.panel.webview.html = this._getWebviewContent(modelName);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(messageHandler);

        return this.panel;
    }

    /**
     * Send a message to the webview
     * @param {Object} message - Message object to send
     */
    postMessage(message) {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    /**
     * Get the HTML content for the webview
     * @param {string} modelName - The selected model name
     * @returns {string} HTML content
     */
    _getWebviewContent(modelName) {
        // Get URIs for local resources
        const markedUri = this.panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules', 'marked', 'marked.min.js'))
        );
        const domPurifyUri = this.panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules', 'dompurify', 'dist', 'purify.min.js'))
        );

        // Load CSS and JS files
        const cssContent = this._loadFile('src/webview/styles/chat.css');
        const jsContent = this._loadFile('src/webview/scripts/chat.js');

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ollama Chat</title>
            <script src="${markedUri}"></script>
            <script src="${domPurifyUri}"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/styles/default.min.css">
            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/highlight.min.js"></script>
            <style>${cssContent}</style>
        </head>
        <body>
            <div id="header-info">
                <p>Connected to model: <strong>${modelName}</strong></p>
            </div>
            <div id="chat-container"></div>
            
            <div id="loading-indicator" class="ollama-message loading-wave-container">
                <svg class="loading-wave" viewBox="0 0 100 20">
                    <path d="M 0 10 Q 25 0 50 10 T 100 10" stroke="var(--vscode-activityBar-activeBorder)" stroke-width="2" fill="none">
                        <animateTransform attributeName="transform"
                                        attributeType="XML"
                                        type="translate"
                                        from="-50 0"
                                        to="0 0"
                                        dur="1s"
                                        repeatCount="indefinite"/>
                    </path>
                    <circle cx="50" cy="10" r="3" fill="var(--vscode-activityBar-activeBorder)">
                        <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;1;0.8" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                </svg>
                <span class="loading-text">Thinking...</span>
            </div>

            <div class="input-area">
                <textarea id="input" rows="1" placeholder="Type your message..."></textarea>
                <button id="send-button">Send</button>
            </div>

            <script>${jsContent}</script>
        </body>
        </html>`;
    }

    /**
     * Load file content from the extension directory
     * @param {string} relativePath - Relative path to the file
     * @returns {string} File content
     */
    _loadFile(relativePath) {
        try {
            const filePath = path.join(this.context.extensionPath, relativePath);
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            console.error(`Failed to load file ${relativePath}:`, error);
            return '';
        }
    }

    /**
     * Dispose of the webview panel
     */
    dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }
}

module.exports = { WebviewManager };
