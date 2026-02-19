require('dotenv').config();
const config = require('./config');
const ultraMsgService = require('./ultraMsgService');

async function debugGroupSend() {
    console.log("--- Debugging UltraMsg Group Delivery ---");
    const groupId = config.HOT_LEADS_GROUP_ID;

    if (!groupId) {
        console.error("❌ Config HOT_LEADS_GROUP_ID is missing.");
        return;
    }
    console.log(`Target: ${groupId}`);

    // Simulate the exact message format user wants
    const testMessage = `🔥 ליד חם חדש (אש)! 🔥\n\nשם: בדיקה טכנית\nטלפון: wa.me/972500000000\nפרטים: בדיקת מערכת שליחת הודעות.\nמועד חזרה רצוי: מיידי\n\nסוכן, נא חזור אל הלקוח! 🚀`;

    try {
        console.log("Sending...");
        const res = await ultraMsgService.sendMessage(groupId, testMessage);
        console.log("✅ Result:", JSON.stringify(res, null, 2));
    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
}

debugGroupSend();
