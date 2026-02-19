const agentLogic = require('./agentLogic');

async function runTest() {
    const chatId = '972501234567'; // Mock ID
    const session = agentLogic.createSession(chatId);

    console.log('--- Starting Test Conversation ---');

    const userInputs = [
        "היי, אני רוצה משכנתא",
        "קוראים לי ישראל ישראלי",
        "אני מת\"א",
        "צריך מיליון שקל",
        "לרכישת דירה ראשונה",
        "יש לי הון עצמי של 400 אלף",
        "הנכס עולה 1.4 מיליון",
        "אני מרוויח 20 אלף נטו",
        "אין לי הלוואות אחרות",
        "רוצה לסגור כמה שיותר מהר",
        "תודה רבה"
    ];

    for (const input of userInputs) {
        console.log(`\nUser: ${input}`);
        try {
            const result = await agentLogic.processMessage(session, input);
            console.log(`Agent: ${result.response}`);

            if (session.completed) {
                console.log('\n--- Session Completed ---');
                console.log('Final Data:', JSON.stringify(session.final_data, null, 2));
                break;
            }
        } catch (error) {
            console.error('Error during test:', error);
            break;
        }
    }
}

runTest();
