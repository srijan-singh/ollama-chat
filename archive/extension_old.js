// Import necessary modules
const local_model = "deepseek-r1";
const vscode = require('vscode');
const axios = require('axios');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let disposable = vscode.commands.registerCommand('ollama-chat.start', async () => {
        const panel = vscode.window.createWebviewPanel(
            'ollamaChat',
            'Ollama Chat',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'sendMessage') {
                const response = await queryOllama(message.text);
                panel.webview.postMessage({ command: 'receiveMessage', text: response });
            }
        });
    });

    context.subscriptions.push(disposable);
}

async function queryOllama(prompt) {
    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: local_model, // Change this to your preferred model
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
