require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function check25() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API KEY found!");
        return;
    }
    const genAI = new GoogleGenerativeAI(key);

    // Testing "gemini-2.5-flash"
    const modelName = "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Checking ${modelName}...`);
    try {
        const result = await model.generateContent("Hello?");
        console.log(`✅ ${modelName} WORKS! Response: ${result.response.text()}`);
    } catch (e) {
        console.error(`❌ ${modelName} FAILED: ${e.message.split('\n')[0]}`);
    }

    // Testing "gemini-2.0-flash" for comparison
    const modelName2 = "gemini-2.0-flash";
    const model2 = genAI.getGenerativeModel({ model: modelName2 });
    try {
        const result2 = await model2.generateContent("Hello?");
        console.log(`✅ ${modelName2} WORKS! Response: ${result2.response.text()}`);
    } catch (e) {
        console.error(`❌ ${modelName2} FAILED: ${e.message.split('\n')[0]}`);
    }
}

check25();
