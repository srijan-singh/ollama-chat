// src/commands/commandHandler.js - Handles VS Code commands and orchestrates services
const vscode = require('vscode');

class CommandHandler {
    constructor(ollamaService, webviewManager) {
        this.ollamaService = ollamaService;
        this.webviewManager = webviewManager;
        this.selectedModel = null;
    }

    /**
     * Start the chat command handler
     */
    async startChat() {
        try {
            // Get available models
            const models = await this.ollamaService.getModels();

            if (!models || models.length === 0) {
                vscode.window.showErrorMessage('No Ollama models found. Please ensure Ollama is running and models are pulled.');
                return;
            }

            // Let user select a model
            this.selectedModel = await vscode.window.showQuickPick(models, {
                placeHolder: 'Select an Ollama model'
            });

            if (!this.selectedModel) {
                return; // User canceled
            }

            // Create the webview panel
            const panel = this.webviewManager.createChatPanel(
                this.selectedModel,
                this._handleWebviewMessage.bind(this)
            );

            // Handle panel disposal
            panel.onDidDispose(() => {
                this.webviewManager.dispose();
            });

        } catch (error) {
            console.error('Error starting chat:', error);
            vscode.window.showErrorMessage('Failed to start chat. Please check the console for details.');
        }
    }

    /**
     * Handle messages received from the webview
     * @param {Object} message - Message from webview
     */
    async _handleWebviewMessage(message) {
        if (message.command === 'sendMessage') {
            try {
                // Start loading animation
                this.webviewManager.postMessage({ command: 'startLoading' });

                // Query Ollama
                const response = await this.ollamaService.query(message.text, this.selectedModel);

                // Send response back to webview
                this.webviewManager.postMessage({ 
                    command: 'receiveMessage', 
                    text: response 
                });

                // Stop loading animation
                this.webviewManager.postMessage({ command: 'stopLoading' });

            } catch (error) {
                console.error('Error handling message:', error);
                this.webviewManager.postMessage({ 
                    command: 'receiveMessage', 
                    text: `Error: ${error.message}` 
                });
                this.webviewManager.postMessage({ command: 'stopLoading' });
            }
        }
        else if (message.command === 'resetMessage') {
            this.ollamaService.resetChatHistory();
        }
    }
}

module.exports = { CommandHandler };
