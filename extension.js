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

        panel.webview.html = getWebviewContent(selectedModel, context, panel);

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'sendMessage') {
                panel.webview.postMessage({ command: 'startLoading' }); // Start loading animation
                const response = await queryOllama(message.text, selectedModel);
                panel.webview.postMessage({ command: 'receiveMessage', text: response });
                panel.webview.postMessage({ command: 'stopLoading' }); // Stop loading animation
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
            const models = lines.slice(1).map(line => line.split(/\s+/)[0]);
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

function getWebviewContent(modelName, context, panel) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ollama Chat</title>
        <!-- Markdown style -->
        <script src="${panel.webview.asWebviewUri(vscode.Uri.file(context.extensionPath + '/node_modules/marked/marked.min.js'))}"></script>
        <!-- DOMPurify -->
        <script src="${panel.webview.asWebviewUri(vscode.Uri.file(context.extensionPath + '/node_modules/dompurify/dist/purify.min.js'))}"></script>
        <!-- Highlight -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/default.min.css">
        <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js"></script>
        <style>
            body { font-family: sans-serif; margin: 10px; }
            #chat-container { border: 1px solid #ccc; height: 300px; overflow-y: auto; padding: 10px; margin-bottom: 10px; }
            #input { width: 98%; padding: 8px; margin-bottom: 5px; border: 1px solid #ccc; }
            button { padding: 8px 15px; background-color: #007bff; color: white; border: none; cursor: pointer; }
            #loading { display: none; margin-top: 5px; }
            .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 2s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            pre code { border-radius: 4px; padding: 0.5em; background: #f0f0f0; }
            .hljs { background: #f0f0f0; }
        </style>
    </head>
    <body>
        <p>Connected to model: <strong>${modelName}</strong></p>
        <div id="chat-container"></div>
        <textarea id="input" rows="3"></textarea>
        <button onclick="sendMessage()">Send</button>
        <div id="loading"><div class="loader"></div></div>

        <script>
            const vscode = acquireVsCodeApi();
            const chatContainer = document.getElementById('chat-container');
            const loading = document.getElementById('loading');
            
            // Wait for highlight.js to be fully loaded
            document.addEventListener('DOMContentLoaded', () => {
                if (typeof hljs !== 'undefined') {
                    hljs.configure({ ignoreUnescapedHTML: true });
                }
            });

            // Configure marked to use highlight.js
            marked.setOptions({
                highlight: function(code, lang) {
                    if (typeof hljs === 'undefined') return code;
                    
                    try {
                        if (lang && hljs.getLanguage(lang)) {
                            return hljs.highlight(code, { language: lang }).value;
                        } else {
                            return hljs.highlightAuto(code).value;
                        }
                    } catch (e) {
                        console.error('Highlight.js error:', e);
                        return code;
                    }
                }
            });

            function sendMessage() {
                const input = document.getElementById('input');
                const text = input.value;
                if (!text.trim()) return;

                try {
                    const formattedUserText = DOMPurify.sanitize(marked.parse(text));
                    chatContainer.innerHTML += '<p><strong>You:</strong> ' + formattedUserText + '</p>';
                    vscode.postMessage({ command: 'sendMessage', text: text });
                    input.value = '';
                    highlightCodeBlocks();
                } catch (error) {
                    console.error('Error formatting user message:', error);
                    chatContainer.innerHTML += '<p><strong>You:</strong> ' + text + '</p>';
                    vscode.postMessage({ command: 'sendMessage', text: text });
                    input.value = '';
                }
            }

            // Function to apply highlighting to code blocks after content is added
            function highlightCodeBlocks() {
                if (typeof hljs !== 'undefined') {
                    document.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }
            }

            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'receiveMessage') {
                    try {
                        // Sanitize HTML and add Markdown support
                        const formattedText = DOMPurify.sanitize(marked.parse(message.text));
                        chatContainer.innerHTML += '<p><strong>Ollama:</strong> ' + formattedText + '</p>';
                        // Apply syntax highlighting to new code blocks
                        highlightCodeBlocks();
                    } catch (error) {
                        console.error('Error formatting Ollama response:', error);
                        chatContainer.innerHTML += '<p><strong>Ollama:</strong> ' + message.text + '</p>';
                    }
                } else if (message.command === 'startLoading') {
                    loading.style.display = 'block';
                } else if (message.command === 'stopLoading') {
                    loading.style.display = 'none';
                }
                chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll
            });

            // Check if libraries are loaded correctly
            window.addEventListener('load', () => {
                let errors = [];
                if (typeof marked === 'undefined') errors.push('Marked library not loaded');
                if (typeof DOMPurify === 'undefined') errors.push('DOMPurify library not loaded');
                if (typeof hljs === 'undefined') errors.push('Highlight.js library not loaded');
                if (errors.length > 0) {
                    document.getElementById('chat-container').innerHTML = 
                        '<p style="color: red;">Error loading libraries: ' + errors.join(', ') + '</p>';
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