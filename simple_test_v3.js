require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { console.error("No Key"); return; }

    console.log("Key found. Testing Gemini 1.5 Flash...");
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        const result = await model.generateContent("Hi");
        console.log("Success:", result.response.text());
    } catch (e) {
        console.error("Failed:", e.message);
    }
}
test();
