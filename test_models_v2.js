require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testModel(modelName) {
    const key = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Testing ${modelName}...`);
    try {
        const result = await model.generateContent("Hello");
        console.log(`✅ ${modelName} SUCCESS:`, result.response.text());
        return true;
    } catch (error) {
        console.log(`❌ ${modelName} FAILED:`, error.message.split('\n')[0]);
        return false;
    }
}

async function runTests() {
    console.log("--- Testing Gemini Models ---");
    // Try likely candidates for Gemini 2.0 Flash
    await testModel("gemini-2.0-flash");
    await testModel("gemini-2.0-flash-exp");
    await testModel("gemini-2.0-flash-001");

    // Try likely candidates for Gemini 1.5 Flash
    await testModel("gemini-1.5-flash");
    await testModel("gemini-1.5-flash-001");
    await testModel("gemini-1.5-flash-latest");
    await testModel("gemini-1.5-flash-8b");
}

runTests();
