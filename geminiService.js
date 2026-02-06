const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Generates a response from Gemini based on history and system instruction.
 */
/**
 * Helper function to retry an async operation on 429 errors.
 */
async function retryOperation(operation, maxRetries = 1, delayMs = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            const isRateLimit = error.status === 429 ||
                (error.message && error.message.includes('429')) ||
                (error.response && error.response.status === 429);

            if (isRateLimit) {
                console.log(`[Gemini] Rate limit hit. Retrying in ${delayMs / 1000}s... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                delayMs *= 2;
            } else {
                throw error;
            }
        }
    }
    console.error('[Gemini] Max retries reached for 429.');
    return null;
}

async function generateResponse(systemInstruction, history, message) {
    try {
        return await retryOperation(async () => {
            const chat = model.startChat({
                history: history,
                systemInstruction: {
                    role: "user",
                    parts: [{ text: systemInstruction }]
                },
            });

            const result = await chat.sendMessage(message);
            const response = await result.response;
            return response.text();
        });
    } catch (error) {
        console.error("Error generating response from Gemini:", error);
        return null;
    }
}

async function processTurn(systemInstruction, history, message, fieldName, fieldDescription, nextStepQuestion) {
    const turnPrompt = `
    User Message: "${message}"
    
    Task 1: Extract the value for "${fieldName}". Description: ${fieldDescription}.
    Task 2: Acknowledge the user's message and then ask exactly this question nicely: "${nextStepQuestion}".
    
    Return your response in the following JSON format:
    {
      "extracted_value": "extracted value or null",
      "agent_response": "your warm and professional response to the user"
    }
    `;

    try {
        return await retryOperation(async () => {
            const result = await model.generateContent({
                contents: [
                    { role: "user", parts: [{ text: systemInstruction }] },
                    ...history,
                    { role: "user", parts: [{ text: turnPrompt }] }
                ],
                generationConfig: { responseMimeType: "application/json" }
            });

            const response = await result.response;
            const textResponse = response.text();
            console.log(`[Gemini] Unified turn response: ${textResponse}`);
            return JSON.parse(textResponse);
        });
    } catch (error) {
        console.error("Error in processTurn:", error);
        return null;
    }
}

async function extractData(text, fieldName, fieldDescription) {
    try {
        const extractionPrompt = `
        Analyze the following text and extract the value for "${fieldName}".
        Description: ${fieldDescription}
        Return the result as a JSON object with a single key "${fieldName}".
        If the value is not found or unclear, set the value to null.
        
        Text: "${text}"
        `;

        return await retryOperation(async () => {
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            });

            const response = await result.response;
            const textResponse = response.text();
            console.log(`[Gemini] Raw extraction response for ${fieldName}: ${textResponse}`);
            const parsed = JSON.parse(textResponse);
            return parsed[fieldName];
        });
    } catch (error) {
        console.error(`Error extracting ${fieldName}:`, error);
        return null;
    }
}

module.exports = {
    generateResponse,
    extractData,
    processTurn
};

