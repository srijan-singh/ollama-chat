// src/services/ollamaService.js - Handles all Ollama API interactions
const axios = require('axios');
const { exec } = require('child_process');
const vscode = require('vscode');

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
}

module.exports = { OllamaService };
