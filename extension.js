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
            :root {
                /* VS Code Theme Colors */
                --vscode-editor-background: var(--vscode-editor-background);
                --vscode-foreground: var(--vscode-foreground);
                --vscode-panel-border: var(--vscode-panel-border);
                --vscode-input-background: var(--vscode-input-background);
                --vscode-input-foreground: var(--vscode-input-foreground);
                --vscode-input-border: var(--vscode-input-border);
                --vscode-button-background: var(--vscode-button-background);
                --vscode-button-foreground: var(--vscode-button-foreground);
                --vscode-button-hoverBackground: var(--vscode-button-hoverBackground);
                --vscode-textCodeBlock-background: var(--vscode-textCodeBlock-background);
                --vscode-textCodeBlock-foreground: var(--vscode-textCodeBlock-foreground);
                --vscode-activityBar-activeBorder: var(--vscode-activityBar-activeBorder);
                --vscode-terminal-ansiBrightBlue: var(--vscode-terminal-ansiBrightBlue);
                --vscode-editorGroup-border: var(--vscode-editorGroup-border);

                /* Custom Colors (adjust for better contrast in light/dark themes) */
                --chat-background: var(--vscode-editor-background);
                --user-message-bg: var(--vscode-terminal-ansiBrightBlue);
                --user-message-text: var(--vscode-terminal-background); /* Often dark in dark theme, light in light theme for contrast */
                --ollama-message-bg: var(--vscode-editorGroup-border);
                --ollama-message-text: var(--vscode-foreground);
                --input-area-bg: var(--vscode-editor-background); /* Background of the input bar */
            }

            body {
                font-family: var(--vscode-font-family, sans-serif);
                font-size: var(--vscode-font-size, 13px);
                line-height: 1.5;
                margin: 0;
                padding: 15px;
                display: flex;
                flex-direction: column;
                height: calc(100vh - 30px); /* Account for padding */
                background-color: var(--vscode-editor-background);
                color: var(--vscode-foreground);
                overflow: hidden; /* Prevent body scroll */
            }

            p {
                margin: 0 0 8px 0; /* Consistent paragraph spacing */
            }

            strong {
                color: var(--vscode-activityBar-activeBorder); /* Highlight strong text */
            }

            #header-info {
                margin-bottom: 15px;
                font-size: 0.9em;
                color: var(--vscode-editorWidget-foreground);
            }

            #chat-container {
                flex-grow: 1; /* Allows chat container to fill available space */
                overflow-y: auto;
                padding-right: 10px; /* Space for scrollbar */
                margin-bottom: 15px;
                scroll-behavior: smooth; /* Smooth scrolling for new messages */
            }

            /* Custom Scrollbar Styles (Webkit) */
            #chat-container::-webkit-scrollbar {
                width: 8px;
            }
            #chat-container::-webkit-scrollbar-track {
                background: var(--vscode-editor-background); /* Match background */
            }
            #chat-container::-webkit-scrollbar-thumb {
                background-color: var(--vscode-scrollbarSlider-background);
                border-radius: 4px;
                border: 2px solid var(--vscode-editor-background);
            }
            #chat-container::-webkit-scrollbar-thumb:hover {
                background-color: var(--vscode-scrollbarSlider-hoverBackground);
            }

            /* Message Bubbles */
            .message {
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                margin-bottom: 10px;
                padding: 10px 15px;
                border-radius: 18px; /* Rounded corners for bubble effect */
                max-width: 80%; /* Limit bubble width */
                word-wrap: break-word; /* Ensure long words break */
                font-size: 0.95em;
            }

            .message.fade-in {
                opacity: 1;
                transform: translateY(0);
            }

            .user-message {
                margin-left: auto; /* Push to the right */
                background-color: var(--user-message-bg);
                color: var(--user-message-text);
                border-bottom-right-radius: 4px; /* Slightly less rounded at the "tail" */
            }

            .ollama-message {
                margin-right: auto; /* Push to the left */
                background-color: var(--ollama-message-bg);
                color: var(--ollama-message-text);
                border-bottom-left-radius: 4px; /* Slightly less rounded at the "tail" */
            }

            /* Input Area */
            .input-area {
                display: flex;
                gap: 10px; /* Space between textarea and button */
                padding-top: 10px;
                border-top: 1px solid var(--vscode-panel-border); /* Separator line */
                background-color: var(--input-area-bg); /* Match body background */
            }

            #input {
                flex-grow: 1; /* Textarea takes most space */
                padding: 10px;
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 5px;
                resize: vertical; /* Allow vertical resize */
                min-height: 40px;
                max-height: 150px; /* Prevent excessive growth */
                font-size: 1em;
                line-height: 1.4;
            }

            button {
                padding: 10px 20px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                cursor: pointer;
                border-radius: 5px; /* Match input border-radius */
                transition: background-color 0.2s ease, transform 0.1s ease;
                font-size: 1em;
                white-space: nowrap; /* Prevent button text wrapping */
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
                transform: translateY(-1px); /* Subtle lift effect */
            }
            button:active {
                transform: translateY(0);
            }
            
            #loading {
                display: flex;
                align-items: center;
                justify-content: center; /* Center the dots */
                padding: 10px 0;
                color: var(--vscode-foreground);
                font-size: 0.9em;
            }

            /* Improved Typing Indicator Animation */
            .typing-indicator span {
                display: inline-block;
                width: 8px;
                height: 8px;
                margin: 0 4px;
                background-color: var(--vscode-activityBar-activeBorder);
                border-radius: 50%;
                opacity: 0;
                animation: bubble 1.4s infinite ease-in-out forwards; /* forwards to keep last state */
            }

            .typing-indicator span:nth-child(1) { animation-delay: 0s; }
            .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
            .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

            @keyframes bubble {
                0%, 80%, 100% {
                    transform: translateY(0);
                    opacity: 0.4; /* Slightly visible when "down" */
                }
                40% {
                    transform: translateY(-8px); /* More pronounced bounce */
                    opacity: 1;
                }
            }

            /* Code Block Styling (already good, just ensure theme consistency) */
            pre code {
                border-radius: 4px;
                padding: 0.8em; /* More padding */
                background: var(--vscode-textCodeBlock-background);
                font-size: 0.9em;
                display: block; /* Ensures it takes full width within message */
                white-space: pre-wrap; /* Wrap long lines in code blocks */
                word-break: break-all; /* Break long words */
            }
            .hljs {
                background: var(--vscode-textCodeBlock-background);
                color: var(--vscode-textCodeBlock-foreground);
            }
            
            /* Basic responsiveness: Adjust padding for smaller widths if needed */
            @media (max-width: 600px) {
                body {
                    padding: 10px;
                }
                .message {
                    max-width: 90%;
                }
            }
        </style>
    </head>
    <body>
        <div id="header-info">
            <p>Connected to model: <strong>${modelName}</strong></p>
        </div>
        <div id="chat-container"></div>
        
        <div class="input-area">
            <textarea id="input" rows="1" placeholder="Type your message..."></textarea>
            <button onclick="sendMessage()">Send</button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const chatContainer = document.getElementById('chat-container');
            const loading = document.getElementById('loading');
            const input = document.getElementById('input');
            
            // Auto-resize textarea
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = input.scrollHeight + 'px';
            });
            
            // Send on Enter (Shift+Enter for new line)
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // Prevent new line
                    sendMessage();
                }
            });

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

            function addMessage(sender, text, isUser = false) {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message');
                messageDiv.classList.add(isUser ? 'user-message' : 'ollama-message');

                // Markdown parsing and DOMPurify sanitization
                let formattedHtml;
                try {
                    formattedHtml = DOMPurify.sanitize(marked.parse(text));
                } catch (error) {
                    console.error('Error parsing or sanitizing message:', error);
                    formattedHtml = DOMPurify.sanitize(text); // Fallback to plain text if markdown fails
                }
                
                // Add sender prefix, but make it less prominent for bubbles
                if (isUser) {
                    messageDiv.innerHTML = formattedHtml;
                } else {
                    messageDiv.innerHTML = formattedHtml;
                }
                
                chatContainer.appendChild(messageDiv);
                
                // Trigger fade-in animation
                setTimeout(() => {
                    messageDiv.classList.add('fade-in');
                    chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll after animation
                }, 50); // Small delay to ensure render before animation
                
                highlightCodeBlocks();
            }

            function sendMessage() {
                const text = input.value.trim();
                if (!text) return;

                addMessage('You', text, true);
                vscode.postMessage({ command: 'sendMessage', text: text });
                input.value = '';
                input.style.height = 'auto'; // Reset textarea height
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
                    addMessage('Ollama', message.text, false);
                } else if (message.command === 'startLoading') {
                    loading.style.display = 'flex'; // Use flex to center spans
                } else if (message.command === 'stopLoading') {
                    loading.style.display = 'none';
                }
            });

            // Check if libraries are loaded correctly and apply VS Code theme class
            window.addEventListener('load', () => {
                let errors = [];
                if (typeof marked === 'undefined') errors.push('Marked library not loaded');
                if (typeof DOMPurify === 'undefined') errors.push('DOMPurify library not loaded');
                if (typeof hljs === 'undefined') errors.push('Highlight.js library not loaded');
                if (errors.length > 0) {
                    document.getElementById('chat-container').innerHTML = 
                        '<p style="color: red;">Error loading libraries: ' + errors.join(', ') + '</p>';
                }
                // Apply VS Code theme to body for consistent styling
                const bodyClasses = document.body.classList;
                if (document.documentElement.classList.contains('vscode-dark') || window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    bodyClasses.add('vscode-dark');
                } else {
                    bodyClasses.add('vscode-light');
                }

                // Initial textarea height adjustment in case of pre-filled content (though unlikely here)
                input.style.height = input.scrollHeight + 'px';
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
