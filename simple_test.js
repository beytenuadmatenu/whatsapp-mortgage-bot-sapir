require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    console.log("Starting test...");
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("ERROR: No API Key found!");
        return;
    }
    console.log(`API Key loaded (length: ${key.length})`);

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout after 10s")), 10000)
    );

    console.log("Sending request to Gemini...");
    try {
        const resultPromise = model.generateContent("Hello?");
        const result = await Promise.race([resultPromise, timeout]);

        console.log("Response received!");
        const response = await result.response;
        console.log("Text:", response.text());
    } catch (error) {
        console.error("Test Failed:", error.message);
    }
}

test();
