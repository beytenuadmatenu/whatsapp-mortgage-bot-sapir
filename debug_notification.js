require('dotenv').config();
const config = require('./config');
const ultraMsgService = require('./ultraMsgService');

async function testGroup() {
    console.log("--- Debugging Group Notification ---");
    console.log("Group ID from Config:", config.HOT_LEADS_GROUP_ID);

    if (!config.HOT_LEADS_GROUP_ID) {
        console.error("❌ ERROR: HOT_LEADS_GROUP_ID is missing in config/env!");
        return;
    }

    const testMsg = "🔥 *Test Notification from Sapir Bot* 🔥\n\nChecking if group messages work.";

    try {
        console.log("Attempting to send message...");
        const response = await ultraMsgService.sendMessage(config.HOT_LEADS_GROUP_ID, testMsg);
        console.log("✅ Send Result:", response);
    } catch (e) {
        console.error("❌ Send Failed:", e.message);
        if (e.response) {
            console.error("API Response Data:", e.response.data);
        }
    }
}

testGroup();
