// extension.js - Main entry point
const vscode = require('vscode');
const { OllamaService } = require('./src/services/ollamaService');
const { WebviewManager } = require('./src/webview/webviewManager');
const { CommandHandler } = require('./src/commands/commandHandler');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    // Initialize services
    const ollamaService = new OllamaService();
    const webviewManager = new WebviewManager(context);
    const commandHandler = new CommandHandler(ollamaService, webviewManager);

    // Register commands
    const disposable = vscode.commands.registerCommand('ollama-chat.start', () => {
        commandHandler.startChat();
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
