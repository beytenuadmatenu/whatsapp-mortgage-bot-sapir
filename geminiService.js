const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
async function generateChatResponse(systemInstruction, history, message, options = {}) {
    const retryDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Attempt Primary Model (Gemini 2.0 Flash) with Retries
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            return await runChat(model, systemInstruction, history, message, options);
        } catch (error) {
            console.error(`Gemini 2.0 Flash failed (Attempt ${attempt}/3):`, error.message);
            if (attempt < 3) await retryDelay(2000); // Wait 2 seconds before retry
        }
    }

    // Fallback Attempt (Gemini 1.5 Flash 002) with Retries
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`Attempting fallback to Gemini 1.5 Flash (002) - Attempt ${attempt}/3...`);
            const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });
            return await runChat(fallbackModel, systemInstruction, history, message, options);
        } catch (fallbackError) {
            console.error(`Gemini 1.5 Flash failed (Attempt ${attempt}/3):`, fallbackError.message);
            if (attempt < 3) await retryDelay(2000); // Wait 2 seconds before retry
        }
    }

    // Final failure - Silent/Polite Return
    // User requested "Wait a few seconds... maybe it's momentary".
    // We already waited. If it still fails, return a polite Hebrew message.
    return "סליחה, יש לי עומס רגעי במערכת. אני מנסה להתחבר מחדש. תוכל לכתוב לי הודעה נוספת עוד דקה?";
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
    return response.text();
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
