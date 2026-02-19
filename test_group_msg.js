require('dotenv').config();
const config = require('./config');
const ultraMsgService = require('./ultraMsgService');

async function testGroupMessage() {
    console.log("--- Testing Group Notification ---");
    const groupId = config.HOT_LEADS_GROUP_ID || '120363424190726852@g.us';
    console.log(`Target Group ID: '${groupId}'`);

    if (!groupId) {
        console.error("❌ HOT_LEADS_GROUP_ID is missing!");
        return;
    }

    try {
        console.log("Sending test message with JSON header...");
        const response = await ultraMsgService.sendMessage(groupId, "🔥 בדיקה: הודעת ניסיון לצוות (Test Message JSON) 🔥");
        console.log("✅ Message sent successfully!");
        console.log("Response:", response);
    } catch (error) {
        console.error("❌ Failed to send message:", error.message);
        if (error.response) {
            console.error("API Response Data:", error.response.data);
            console.error("API Response Status:", error.response.status);
        }
    }
}

testGroupMessage();
