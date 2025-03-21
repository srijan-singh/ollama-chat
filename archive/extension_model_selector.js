// Import necessary modules
const vscode = require('vscode');
const axios = require('axios');
const { exec } = require('child_process');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    let disposable = vscode.commands.registerCommand('ollama-chat.start', async () => {
        let models = await getOllamaModels();

        if (!models || models.length === 0) {
            vscode.window.showErrorMessage('No Ollama models found. Please ensure Ollama is running and models are pulled.');
            return;
        }

        const selectedModel = await vscode.window.showQuickPick(models, {
            placeHolder: 'Select an Ollama model'
        });

        if (!selectedModel) {
            return; // User canceled
        }

        const panel = vscode.window.createWebviewPanel(
            'ollamaChat',
            'Ollama Chat',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'sendMessage') {
                const response = await queryOllama(message.text, selectedModel); // Use the selected model
                panel.webview.postMessage({ command: 'receiveMessage', text: response });
            }
        });
    });

    context.subscriptions.push(disposable);
}

async function getOllamaModels() {
    return new Promise((resolve, reject) => {
        exec('ollama list', (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                reject(null);
                return;
            }
            const lines = stdout.trim().split('\n');
            const models = lines.slice(1).map(line => line.split(/\s+/)[0]); // Extract model names
            resolve(models);
        });
    });
}

async function queryOllama(prompt, model) {
    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: model,
            prompt: prompt,
            stream: false
        });
        return response.data.response;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

function getWebviewContent() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ollama Chat</title>
    </head>
    <body>
        <div id="chat-container" style="height: 400px; overflow-y: auto;"></div>
        <textarea id="input" rows="3" style="width: 100%;"></textarea>
        <button onclick="sendMessage()">Send</button>

        <script>
            const vscode = acquireVsCodeApi();

            function sendMessage() {
                const input = document.getElementById('input');
                const text = input.value;
                if (!text.trim()) return;

                const chatContainer = document.getElementById('chat-container');
                chatContainer.innerHTML += '<p><strong>You:</strong> ' + text + '</p>';

                vscode.postMessage({ command: 'sendMessage', text: text });
                input.value = '';
            }

            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'receiveMessage') {
                    const chatContainer = document.getElementById('chat-container');
                    chatContainer.innerHTML += '<p><strong>Ollama:</strong> ' + message.text + '</p>';
                }
            });
        </script>
    </body>
    </html>`;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};