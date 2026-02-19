require('dotenv').config();
const agentLogic = require('./agentLogic');

async function testAdvancedPersona() {
    console.log("--- Starting Ayelet Advanced Persona Verification ---");
    console.log("Goal: Verify she handles side-questions ('Human feel') while keeping the flow.");

    const uniqueId = '972509999999'; // Unique session
    const session = agentLogic.createSession(uniqueId);

    // Scenario: User is chatty and asks a question mid-flow
    const conversation = [
        "היי, אני צריך משכנתא דחוף",
        "קוראים לי דני שובבני",
        "תגידי, את בוט או בן אדם?", // Trap question
        "אני גר בפתח תקווה",
        "צריך 2 מיליון שקל",
        "זה לשיפוץ",
        "כן יש לי נכס",
        "רשום על שמי",
        "בטאבו",
        "יש היתר",
        "אין בעיות בבנק",
        "יום שלישי בבוקר מתאים לי"
    ];

    for (const input of conversation) {
        console.log(`\nUser: "${input}"`);
        try {
            const result = await agentLogic.processMessage(session, input);
            console.log(`Ayelet: "${result.response}"`);

            if (session.completed) {
                console.log("\n✅ Session Completed Successfully!");
                console.log("Final JSON Data:");
                console.log(JSON.stringify(session.final_data, null, 2));
                break;
            }
        } catch (error) {
            console.error("❌ Error:", error.message);
            break;
        }
    }
}

testAdvancedPersona();
