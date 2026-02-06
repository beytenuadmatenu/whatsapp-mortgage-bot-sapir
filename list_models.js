const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config');

async function listModels() {
    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    // There isn't a direct listModels method on the genAI instance in basic usage, 
    // but we can try to find a valid model by trial or check if the error gives hints.
    // Actually, the SDK *does* probably have a way or we can just try a few.

    // However, for the purpose of this environment, I'll just try to hit the API directly using axios to list models 
    // if the SDK doesn't expose it easily in the version installed.
    // But wait, the error message literally said: "Call ListModels to see the list of available models".

    // Using raw REST call to list models
    const axios = require('axios');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API_KEY}`;

    try {
        const response = await axios.get(url);
        console.log("Available Models:");
        response.data.models.forEach(m => {
            console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
        });
    } catch (error) {
        console.error("Error listing models:", error.response ? error.response.data : error.message);
    }
}

listModels();
