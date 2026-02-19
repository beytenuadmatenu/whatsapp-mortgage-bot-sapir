require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const https = require('https');

async function testSDK() {
    console.log("\n--- Testing SDK Connection ---");
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ No API Key found");
        return;
    }
    console.log(`API Key: ${key.substring(0, 5)}...${key.substring(key.length - 5)}`);

    const genAI = new GoogleGenerativeAI(key);
    const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

    for (const modelName of models) {
        console.log(`\nTesting Model: ${modelName}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Test");
            const response = await result.response;
            console.log(`✅ Success! Response: ${response.text()}`);
        } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   StatusText: ${error.response.statusText}`);
            }
        }
    }
}

async function testRawHTTP() {
    console.log("\n--- Testing Raw HTTP Connection ---");
    const key = process.env.GEMINI_API_KEY;
    const model = "gemini-1.5-flash";

    // Simple REST call to generate content
    const data = JSON.stringify({
        contents: [{ parts: [{ text: "Hello" }] }]
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${model}:generateContent?key=${key}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`);
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.write(data);
    req.end();
}

async function run() {
    await testSDK();
    testRawHTTP();
}

run();
