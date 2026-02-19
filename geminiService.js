const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function generateChatResponse(systemInstruction, history, message, options = {}) {
    try {
        const chat = model.startChat({
            history: history,
            systemInstruction: {
                role: "user",
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
                temperature: options.temperature || 0.7,
                topP: options.top_p || 0.9,
            }
        });

        console.log(`[Gemini] Sending message to model: "${message.substring(0, 50)}..."`);
        const result = await chat.sendMessage(message);
        console.log(`[Gemini] Received response object`);
        const response = await result.response;
        const text = response.text();
        console.log(`[Gemini] Response text length: ${text.length}`);
        return text;
    } catch (error) {
        console.error("Error generating response from Gemini:", error);
        return null;
    }
}

/**
 * Tries to extract a JSON object from a string.
 * It looks for a JSON block ```json ... ``` or just the object { ... }
 */
function extractJson(text, fieldName) {
    try {
        let jsonStr = text;
        const match = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
            jsonStr = match[1];
        } else {
            // Fallback: Try to find the first { and last }
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = text.substring(firstBrace, lastBrace + 1);
            }
        }

        const parsed = JSON.parse(jsonStr);
        return fieldName ? parsed[fieldName] : parsed;
    } catch (e) {
        return null;
    }
}

module.exports = {
    generateChatResponse,
    extractJson
};
