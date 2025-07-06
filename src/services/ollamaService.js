// src/services/ollamaService.js - Handles all Ollama API interactions
const axios = require('axios');
const { exec } = require('child_process');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class OllamaService {
    constructor() {
        this.baseUrl = 'http://localhost:11434';
        this.chatHistory = []; // Initialize chat history
    }

    /**
     * Get list of available Ollama models
     * @returns {Promise<string[]>} Array of model names
     */
    async getModels() {
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

    /**
     * Query Ollama API with a prompt, maintaining conversational memory
     * @param {string} prompt - The user prompt
     * @param {string} model - The model to use
     * @returns {Promise<string>} The response from Ollama
     */
    async query(prompt, model) {
        // Add the new user message to the history
        this.chatHistory.push({ role: 'user', content: prompt });

        try {
            const response = await axios.post(`${this.baseUrl}/api/chat`, {
                model: model,
                messages: this.chatHistory, // Send the entire history
                stream: false // For simplicity, keep it non-streaming
            });

            const assistantResponse = response.data.message.content;

            // Add the assistant's response to the history
            this.chatHistory.push({ role: 'assistant', content: assistantResponse });

            return assistantResponse;
        } catch (error) {
            console.error('Error querying Ollama chat:', error);
            if (error.code === 'ECONNREFUSED') {
                return `Error: Could not connect to Ollama. Please ensure Ollama is running on ${this.baseUrl}.`;
            }
            return `Error: ${error.message}`;
        }
    }

    /**
     * Resets the chat history.
     */
    resetChatHistory() {
        this.chatHistory = [];
        vscode.window.showInformationMessage('Chat history has been reset.');
    }

    /**
     * Check if Ollama service is available
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const models = await this.getModels();
            return models && models.length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Export the chat history to a JSON file
     */
    async exportChatHistory() {
        const uri = await vscode.window.showSaveDialog({
            filters: { 'JSON': ['json'] },
            defaultUri: vscode.Uri.file(path.join(__dirname, 'chat-history.json'))
        });

        if (!uri) return;

        try {
            fs.writeFileSync(uri.fsPath, JSON.stringify(this.chatHistory, null, 2), 'utf8');
            vscode.window.showInformationMessage(`Chat history exported to ${uri.fsPath}`);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to export chat history: ${err.message}`);
        }
    }

    /**
     * Import chat history from a JSON file
     */
    async importChatHistory() {
        const uris = await vscode.window.showOpenDialog({
            filters: { 'JSON': ['json'] },
            canSelectMany: false
        });

        if (!uris || uris.length === 0) return;

        try {
            const data = fs.readFileSync(uris[0].fsPath, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                this.chatHistory = parsed;
                vscode.window.showInformationMessage('Chat history successfully imported.');
            } else {
                throw new Error('Invalid format');
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to import chat history: ${err.message}`);
        }
    }

    /**
     * Get the chat history
     */
    getChatHistory() {
        return this.chatHistory;
    }
}

module.exports = { OllamaService };
