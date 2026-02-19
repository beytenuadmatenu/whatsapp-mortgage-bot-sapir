require('dotenv').config();
const config = require('./config');
const ultraMsgService = require('./ultraMsgService');

async function debugGroup() {
    console.log("--- Debugging Group ID Configuration ---");
    console.log("Configured Group ID:", config.HOT_LEADS_GROUP_ID);

    const targetGroup = "120363424190726852@g.us";
    console.log("User Requested Group ID:", targetGroup);

    if (config.HOT_LEADS_GROUP_ID !== targetGroup) {
        console.warn("⚠️ WARNING: Configured ID does not match the User's requested ID!");
    } else {
        console.log("✅ Config matches User Request.");
    }

    console.log("\n--- Attempting to Send Test Message to Target Group ---");
    const testMessage = "🔥 בדיקת חיבור לקבוצה (Test) 🔥\nאם אתם רואים את זה - הבוט מחובר לקבוצה!";

    try {
        const res = await ultraMsgService.sendMessage(targetGroup, testMessage);
        console.log("✅ Send Result:", JSON.stringify(res, null, 2));
    } catch (error) {
        console.error("❌ Send Failed:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
}

debugGroup();
