// src/webview/scripts/chat.js - Client-side JavaScript for the chat interface

class ChatInterface {
    constructor() {
        this.vscode = acquireVsCodeApi();
        this.chatContainer = document.getElementById('chat-container');
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.input = document.getElementById('input');
        document.getElementById('send-button').addEventListener('click', sendMessage);
        document.getElementById('reset-button').addEventListener('click', resetChat);
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.configureMarkdown();
        this.setupHighlightJs();
    }

    setupEventListeners() {
        // Auto-resize textarea
        this.input.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = this.input.scrollHeight + 'px';
        });
        
        // Send on Enter (Shift+Enter for new line)
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Listen for messages from extension
        window.addEventListener('message', (event) => {
            this.handleExtensionMessage(event.data);
        });

        // Initial setup on load
        window.addEventListener('load', () => {
            this.onPageLoad();
        });
    }

    configureMarkdown() {
        if (typeof marked !== 'undefined') {
            marked.use({
                highlight: (code, lang) => {
                    return this.highlightCode(code, lang);
                }
            });
        }
    }

    setupHighlightJs() {
        if (typeof hljs !== 'undefined') {
            hljs.configure({ ignoreUnescapedHTML: true });
        } else {
            console.warn('highlight.js not available on load.');
        }
    }

    highlightCode(code, lang) {
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
    }

    addMessage(sender, text, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(isUser ? 'user-message' : 'ollama-message');

        // Markdown parsing and DOMPurify sanitization
        let formattedHtml;
        try {
            if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
                formattedHtml = DOMPurify.sanitize(marked.parse(text));
            } else {
                formattedHtml = text; // Fallback to plain text
            }
        } catch (error) {
            console.error('Error parsing or sanitizing message:', error);
            formattedHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(text) : text;
        }
        
        messageDiv.innerHTML = formattedHtml;
        this.chatContainer.appendChild(messageDiv);
        
        // Trigger fade-in animation
        setTimeout(() => {
            messageDiv.classList.add('fade-in');
            this.scrollToBottom();
        }, 50);
        
        this.highlightCodeBlocks();
    }

    sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.addMessage('You', text, true);
        this.vscode.postMessage({ command: 'sendMessage', text: text });
        this.input.value = '';
        this.input.style.height = 'auto';
        this.scrollToBottom();
    }

    resetChat() {
        this.chatContainer.innerHTML = '';
        this.vscode.postMessage({ command: 'resetMessage' });
    }

    highlightCodeBlocks() {
        if (typeof hljs !== 'undefined') {
            document.querySelectorAll('.message pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
    }

    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    showLoading() {
        this.loadingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }

    hideLoading() {
        this.loadingIndicator.style.display = 'none';
    }

    handleExtensionMessage(message) {
        switch (message.command) {
            case 'receiveMessage':
                this.hideLoading();
                this.addMessage('Ollama', message.text, false);
                break;
            case 'startLoading':
                this.showLoading();
                break;
            case 'stopLoading':
                this.hideLoading();
                break;
            default:
                console.warn('Unknown message command:', message.command);
        }
    }

    onPageLoad() {
        // Initial textarea height adjustment
        this.input.style.height = this.input.scrollHeight + 'px';
    }
}

// Global function for button onclick (backward compatibility)
function sendMessage() {
    if (window.chatInterface) {
        window.chatInterface.sendMessage();
    }
}

function resetChat() {
    if (window.chatInterface) {
        window.chatInterface.resetChat();
    }
}

// Initialize chat interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatInterface = new ChatInterface();
});
