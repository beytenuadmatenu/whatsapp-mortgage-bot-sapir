require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testModels() {
    console.log("--- Testing Model Availability ---");
    const key = process.env.GEMINI_API_KEY;
    console.log(`API Key present: ${!!key}`);

    if (!key) {
        console.error("❌ No API Key found in .env");
        return;
    }

    const genAI = new GoogleGenerativeAI(key);

    const modelsToTest = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro"];

    for (const modelName of modelsToTest) {
        console.log(`\nTesting: ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello?");
            const response = await result.response;
            console.log(`✅ ${modelName}: Success! Response: "${response.text()}"`);
        } catch (error) {
            console.error(`❌ ${modelName}: Failed!`);
            console.error(`   Error Message: ${error.message}`);
            if (error.response) console.error(`   Status: ${error.response.status}`);
        }
    }
}

testModels();
