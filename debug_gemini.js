require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function debugGemini() {
    console.log("--- Debugging Gemini API ---");
    const key = process.env.GEMINI_API_KEY;
    console.log(`API Key present: ${!!key}`);

    if (!key) {
        console.error("❌ No API Key found in .env");
        return;
    }

    const genAI = new GoogleGenerativeAI(key);
    // Test with the requested model
    const modelName = "gemini-2.0-flash";
    console.log(`Attempting to connect to model: ${modelName}`);

    const model = genAI.getGenerativeModel({ model: modelName });

    try {
        console.log("Sending simple prompt...");
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        console.log("✅ Success! Response:", response.text());
    } catch (error) {
        console.error("❌ Error generating content:", error);
        if (error.response) {
            console.error("Error Response:", error.response);
        }

        // Fallback check: List models
        // Note: listModels is not directly available on the instance usually, 
        // but let's try a fallback model to see if it's the specific model name.
        console.log("\n--- Retrying with 'gemini-1.5-flash' ---");
        try {
            const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result2 = await fallbackModel.generateContent("Hello?");
            console.log("✅ Fallback Success with gemini-1.5-flash");
        } catch (e2) {
            console.error("❌ Fallback also failed:", e2.message);
        }
    }
}

debugGemini();
