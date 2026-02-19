require('dotenv').config();
const config = require('./config');
const ultraMsgService = require('./ultraMsgService');

const GROUP_ID = "120363424190726852@g.us";

async function test() {
    console.log(`Testing send to group: ${GROUP_ID}`);
    try {
        const res = await ultraMsgService.sendMessage(GROUP_ID, "🔥 בדיקה: האם ההודעה הזו מגיעה לקבוצה? 🔥");
        console.log("Success:", res);
    } catch (e) {
        console.error("Failed:", e.message);
        if (e.response) console.error("Data:", e.response.data);
    }
}

test();
