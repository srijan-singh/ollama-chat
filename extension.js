// Import necessary modules
const vscode = require('vscode');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path'); // Added for path manipulation

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

        // Ensure proper URI for local resources
        const markedUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'marked', 'marked.min.js')));
        const domPurifyUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'dompurify', 'dist', 'purify.min.js')));

        panel.webview.html = getWebviewContent(selectedModel, markedUri, domPurifyUri);

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
                vscode.window.showErrorMessage('Failed to list Ollama models. Is Ollama installed and running?');
                reject(null);
                return;
            }
            const lines = stdout.trim().split('\n');
            if (lines.length <= 1) { // Only header or no models
                 resolve([]);
                 return;
            }
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
            stream: false // For now, keep it non-streaming for simplicity in this example
        });
        return response.data.response;
    } catch (error) {
        console.error('Error querying Ollama:', error);
        if (error.code === 'ECONNREFUSED') {
            return `Error: Could not connect to Ollama. Please ensure Ollama is running on http://localhost:11434.`;
        }
        return `Error: ${error.message}`;
    }
}

// Pass webview URIs directly to the function
function getWebviewContent(modelName, markedUri, domPurifyUri) {
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
        <style>
            :root {
                /* VS Code Theme Colors - Fallbacks added for external use */
                --vscode-editor-background: var(--vscode-editor-background, #1e1e1e);
                --vscode-foreground: var(--vscode-foreground, #cccccc);
                --vscode-panel-border: var(--vscode-panel-border, #303030);
                --vscode-input-background: var(--vscode-input-background, #3c3c3c);
                --vscode-input-foreground: var(--vscode-input-foreground, #cccccc);
                --vscode-input-border: var(--vscode-input-border, #555555);
                --vscode-button-background: var(--vscode-button-background, #0e639c);
                --vscode-button-foreground: var(--vscode-button-foreground, #ffffff);
                --vscode-button-hoverBackground: var(--vscode-button-hoverBackground, #1177bb);
                --vscode-textCodeBlock-background: var(--vscode-textCodeBlock-background, #0a0a0a);
                --vscode-textCodeBlock-foreground: var(--vscode-textCodeBlock-foreground, #cccccc);
                --vscode-activityBar-activeBorder: var(--vscode-activityBar-activeBorder, #007acc);
                --vscode-terminal-ansiBrightBlue: var(--vscode-terminal-ansiBrightBlue, #2472c2);
                --vscode-editorGroup-border: var(--vscode-editorGroup-border, #444444);
                --vscode-scrollbarSlider-background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
                --vscode-scrollbarSlider-hoverBackground: var(--vscode-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.7));
                --vscode-editorWidget-foreground: var(--vscode-editorWidget-foreground, #cccccc);


                /* Custom Colors derived from VS Code theme */
                --chat-background: var(--vscode-editor-background);
                --user-message-bg: var(--vscode-terminal-ansiBrightBlue); /* A distinct blue for user messages */
                --user-message-text: var(--vscode-button-foreground); /* White text on blue for contrast */
                --ollama-message-bg: var(--vscode-input-background); /* A neutral background for Ollama messages */
                --ollama-message-text: var(--vscode-foreground);
                --input-area-bg: var(--vscode-editor-background);
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
            
            /* Loading Indicator (Typing Animation) */
            #loading-indicator {
                display: none; /* Hidden by default */
                justify-content: flex-start; /* Align dots to the left like an incoming message */
                align-items: center;
                padding: 10px 15px; /* Match message padding */
                margin-bottom: 10px;
            }
            .loading-wave-container {
                display: none; /* Controlled by JS */
                align-items: center;
                justify-content: flex-start;
                padding: 10px 15px;
                margin-bottom: 10px;
                background-color: var(--ollama-message-bg);
                border-radius: 18px;
                max-width: 150px; /* Adjust as needed */
            }
            .loading-wave {
                width: 50px; /* Adjust size */
                height: 20px;
                margin-right: 10px;
                stroke-linecap: round;
            }
            .loading-text {
                color: var(--ollama-message-text);
                font-style: italic;
                opacity: 0.8;
            }

            .typing-indicator span {
                display: inline-block;
                width: 8px;
                height: 8px;
                margin: 0 4px;
                background-color: var(--vscode-activityBar-activeBorder); /* Use accent color for dots */
                border-radius: 50%;
                opacity: 0.4;
                animation: bubble 1.4s infinite ease-in-out forwards;
            }

            .typing-indicator span:nth-child(1) { animation-delay: 0s; }
            .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
            .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

            @keyframes bubble {
                0%, 80%, 100% {
                    transform: translateY(0);
                    opacity: 0.4;
                }
                40% {
                    transform: translateY(-8px);
                    opacity: 1;
                }
            }

            /* Code Block Styling */
            pre code {
                border-radius: 4px;
                padding: 0.8em;
                background: var(--vscode-textCodeBlock-background);
                font-size: 0.9em;
                display: block;
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
            <button onclick="sendMessage()">Send</button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const chatContainer = document.getElementById('chat-container');
            const loadingIndicator = document.getElementById('loading-indicator');
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

            // Configure marked to use highlight.js
            marked.setOptions({
                highlight: function(code, lang) {
                    if (typeof hljs === 'undefined') {
                        console.warn('highlight.js not loaded, cannot highlight code.');
                        return code;
                    }
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
                },
                // Add this if you want to allow raw HTML in markdown (be cautious with untrusted input)
                // gfm: true, // GitHub Flavored Markdown
                // breaks: true // Add <br> on a single newline
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
                
                messageDiv.innerHTML = formattedHtml;
                
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
                chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to bottom immediately after user message
            }

            // Function to apply highlighting to code blocks after content is added
            function highlightCodeBlocks() {
                if (typeof hljs !== 'undefined') {
                    document.querySelectorAll('.message pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }
            }

            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'receiveMessage') {
                    // Hide loading indicator before adding the actual message
                    loadingIndicator.style.display = 'none';
                    addMessage('Ollama', message.text, false);
                } else if (message.command === 'startLoading') {
                    loadingIndicator.style.display = 'flex'; // Show the typing animation
                    // Scroll to bottom to show the loading indicator
                    chatContainer.scrollTop = chatContainer.scrollHeight; 
                } else if (message.command === 'stopLoading') {
                    loadingIndicator.style.display = 'none';
                }
            });

            // Initial setup on load
            window.addEventListener('load', () => {
                // Ensure highlight.js is configured after it's loaded
                if (typeof hljs !== 'undefined') {
                    hljs.configure({ ignoreUnescapedHTML: true });
                } else {
                     console.warn('highlight.js not available on load.');
                }

                // Initial textarea height adjustment
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
