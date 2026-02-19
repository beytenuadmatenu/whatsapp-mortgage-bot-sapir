const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

async function generateChatResponse(systemInstruction, history, message, options = {}) {
    const retryDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Attempt Primary Model (Gemini 2.5 Flash) with AGGRESSIVE Retries (10x)
    // User requested v2.5. We will try for ~45 seconds (10 attempts * 4.5s) before giving up.

    for (let attempt = 1; attempt <= 10; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            return await runChat(model, systemInstruction, history, message, options);
        } catch (error) {
            console.error(`Gemini 2.5 Flash failed (Attempt ${attempt}/10):`, error.message);
            if (attempt < 10) await retryDelay(4500); // Wait 4.5 seconds before retry
        }
    }

    // Fallback Attempt (Gemini 2.0 Flash) - Last Resort
    try {
        console.log("Attempting fallback to Gemini 2.0 Flash...");
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        return await runChat(fallbackModel, systemInstruction, history, message, options);
    } catch (fallbackError) {
        console.error("Gemini 2.0 Flash failed too:", fallbackError.message);
        // If even this fails after ~50 seconds of trying, the user is likely offline or Google is down globally.
        return "שגיאת תקשורת חמורה. נא לנסות שוב מאוחר יותר.";
    }
}

async function runChat(model, systemInstruction, history, message, options) {
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

    console.log(`[Gemini] Sending message...`);
    const result = await chat.sendMessage(message);
    const response = await result.response;

    // Gemini 2.5 Flash has a "thinking" feature that outputs internal reasoning
    // as separate parts with { thought: true }. We must filter those out.
    try {
        const parts = response.candidates[0].content.parts;
        const textParts = parts.filter(p => !p.thought);
        const text = textParts.map(p => p.text).join('');
        console.log(`[Gemini] Filtered ${parts.length - textParts.length} thought parts from response.`);
        return text;
    } catch (e) {
        // Fallback to .text() if response structure is unexpected
        console.warn(`[Gemini] Could not filter thought parts, using raw text:`, e.message);
        return response.text();
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
