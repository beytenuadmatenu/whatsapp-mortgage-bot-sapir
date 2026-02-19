require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function verify() {
    console.log("--- Verifying Gemini Models ---");
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API KEY found!");
        return;
    }
    const genAI = new GoogleGenerativeAI(key);

    const models = ["gemini-2.0-flash-exp", "gemini-1.5-flash-002"];

    for (const m of models) {
        console.log(`Testing ${m}...`);
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hello");
            console.log(`✅ ${m} WORKS! Response: ${result.response.text().substring(0, 20)}...`);
        } catch (e) {
            console.error(`❌ ${m} FAILED: ${e.message.split('\n')[0]}`);
        }
    }
}

verify();
