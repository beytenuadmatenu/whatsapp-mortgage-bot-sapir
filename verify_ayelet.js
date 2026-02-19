require('dotenv').config();
const agentLogic = require('./agentLogic');

async function testPersona() {
    console.log("--- Starting Ayelet Persona Verification ---");

    // Create a new session
    const uniqueId = '972500000000';
    const session = agentLogic.createSession(uniqueId);

    // Step 1: User says "Hi"
    const input1 = "היי, אני רוצה משכנתא";
    console.log(`\nUser: "${input1}"`);
    console.log("... Ayelet is typing ...");

    try {
        const result1 = await agentLogic.processMessage(session, input1);
        console.log(`\nAyelet: "${result1.response}"`);

        // Verification checks
        if (result1.response.includes("איילת") && result1.response.includes("וואן משכנתאות")) {
            console.log("✅ Check 1 Passed: Agent identified as Ayelet.");
        } else {
            console.log("⚠️ Check 1 Warning: Agent did not explicitly say 'Ayelet'. (Expected in first message)");
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

testPersona();
