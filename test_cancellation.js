/**
 * E2E Test Suite - Cancellation + Objection Handling
 * 
 * Tests:
 * 1.  New lead (confirmed) → 🔥 notification
 * 2.  Same time again → no duplicate
 * 3.  Meeting time updated → 🔄 notification
 * 4.  First cancel request → objection handling (NO cancellation JSON)
 * 5.  Second cancel request → actual cancellation → ❌ notification + session reset
 * 6.  After cancellation, new meeting → 🔥 new lead again
 * 7.  Casual message → no notification
 * 8.  JSON extraction: confirmed status
 * 9.  JSON extraction: cancelled status
 * 10. JSON without status → defaults to confirmed
 * 11. Response cleanup: no JSON artifacts shown to client
 * 12. Session reset command works correctly
 */

const path = require('path');
const geminiService = require('./geminiService');
const config = require('./config');

// ─── Mock Setup ─────────────────────────────────────────────
let sentMessages = [];
let mockAiResponse = '';

// Mock ultraMsgService
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent) {
    if (request === './ultraMsgService') return request;
    return originalResolveFilename.apply(this, arguments);
};
require.cache['./ultraMsgService'] = {
    id: './ultraMsgService', filename: './ultraMsgService', loaded: true,
    exports: {
        sendMessage: (to, body) => {
            sentMessages.push({ to, body });
            console.log(`    [MOCK UltraMSG] Message sent to group`);
        }
    }
};

// Mock geminiService
geminiService.generateChatResponse = async () => mockAiResponse;
config.HOT_LEADS_GROUP_ID = 'test-group@g.us';

// ─── Test Helpers ───────────────────────────────────────────
const agentLogic = require('./agentLogic');
let passed = 0, failed = 0;

function assert(condition, testName) {
    if (condition) { console.log(`  ✅ PASS: ${testName}`); passed++; }
    else { console.log(`  ❌ FAIL: ${testName}`); failed++; }
}

function resetMocks() { sentMessages = []; }

// ─── Tests ──────────────────────────────────────────────────
async function runTests() {
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  Cancellation + Objection Handling - E2E Test Suite');
    console.log('══════════════════════════════════════════════════════════\n');

    const session = agentLogic.createSession('972501234567@c.us');

    // ─── Test 1: New Lead ───
    console.log('📋 Test 1: New lead with confirmed meeting');
    resetMocks();
    mockAiResponse = `מעולה! היועץ יתקשר אליך ביום ראשון 02.03.2026 בשעה 10:00.

|||json_start|||
\`\`\`json
{
  "full_name": "אחמד חסן",
  "phone": "0501234567",
  "summary_sentence": "לקוח אחמד חסן, גר בנצרת. מבקש 500,000 ש״ח למטרת בנייה.",
  "meeting_time": "יום ראשון 02.03.2026 בשעה 10:00",
  "status": "confirmed"
}
\`\`\``;

    let result = await agentLogic.processMessage(session, 'אני רוצה לקבוע פגישה');
    assert(sentMessages.length === 1, 'Group notification sent');
    assert(sentMessages[0].body.includes('🔥'), 'New lead emoji (🔥)');
    assert(sentMessages[0].body.includes('אחמד חסן'), 'Contains client name');
    assert(sentMessages[0].body.includes('יום ראשון 02.03.2026 בשעה 10:00'), 'Contains meeting time');
    assert(sentMessages[0].body.includes('נא לחזור אל הלקוח'), 'New lead footer');
    assert(session.leadSent === true, 'leadSent = true');
    assert(session.lastMeetingTime === 'יום ראשון 02.03.2026 בשעה 10:00', 'Meeting time stored');
    assert(!result.response.includes('full_name'), 'JSON not shown to client');
    assert(!result.response.includes('json_start'), 'Token not shown to client');

    // ─── Test 2: Same time → no duplicate ───
    console.log('\n📋 Test 2: Same meeting time → no duplicate');
    resetMocks();
    mockAiResponse = `בטח, הפגישה קבועה ליום ראשון 02.03.2026 בשעה 10:00.

|||json_start|||
\`\`\`json
{
  "full_name": "אחמד חסן", "phone": "0501234567",
  "summary_sentence": "לקוח אחמד חסן.",
  "meeting_time": "יום ראשון 02.03.2026 בשעה 10:00",
  "status": "confirmed"
}
\`\`\``;

    await agentLogic.processMessage(session, 'תזכירי לי מתי הפגישה');
    assert(sentMessages.length === 0, 'No duplicate notification');

    // ─── Test 3: Time updated ───
    console.log('\n📋 Test 3: Meeting time updated');
    resetMocks();
    mockAiResponse = `עדכנתי! היועץ יתקשר ביום שלישי 04.03.2026 בשעה 14:00.

|||json_start|||
\`\`\`json
{
  "full_name": "אחמד חסן", "phone": "0501234567",
  "summary_sentence": "לקוח אחמד חסן.",
  "meeting_time": "יום שלישי 04.03.2026 בשעה 14:00",
  "status": "confirmed"
}
\`\`\``;

    await agentLogic.processMessage(session, 'אפשר להעביר ליום שלישי?');
    assert(sentMessages.length === 1, 'Update notification sent');
    assert(sentMessages[0].body.includes('🔄'), 'Update emoji (🔄)');
    assert(sentMessages[0].body.includes('נא לעדכן ביומן'), 'Update footer');
    assert(session.lastMeetingTime === 'יום שלישי 04.03.2026 בשעה 14:00', 'Time updated in session');

    // ─── Test 4: First cancel request → objection handling (NO JSON) ───
    console.log('\n📋 Test 4: First cancel request → objection handling (NO cancellation)');
    resetMocks();
    // The AI should respond with objection handling, NO JSON
    mockAiResponse = `אני מבינה, לפעמים צריך לחשוב על זה. אבל תדע, אנחנו לא סתם חברת הלוואות — אנחנו בית פיננסי שמלווה את המשפחה. אם יש לכם נכס — יש לכם כוח. אנחנו יודעים להפוך את הכוח הזה לפתרון. אולי נוח לך מועד אחר? אין שום לחץ.`;

    result = await agentLogic.processMessage(session, 'אני רוצה לבטל את הפגישה');
    assert(sentMessages.length === 0, 'NO cancellation notification on first request');
    assert(session.leadSent === true, 'leadSent still true (not cancelled yet)');
    assert(session.lastMeetingTime === 'יום שלישי 04.03.2026 בשעה 14:00', 'Meeting time NOT reset');
    assert(result.response.includes('בית פיננסי') || result.response.includes('נכס') || result.response.includes('מבינה'), 'Response contains objection handling content');
    assert(!result.response.includes('cancelled'), 'No cancellation status in response');

    // ─── Test 5: Second cancel request → actual cancellation ───
    console.log('\n📋 Test 5: Client insists → actual cancellation');
    resetMocks();
    mockAiResponse = `בסדר גמור, אני מכבדת את ההחלטה. מאחלת לך הצלחה רבה! אנחנו תמיד כאן בשבילך.

|||json_start|||
\`\`\`json
{
  "full_name": "אחמד חסן",
  "phone": "0501234567",
  "summary_sentence": "לקוח אחמד חסן, ביקש לבטל פגישה.",
  "meeting_time": "יום שלישי 04.03.2026 בשעה 14:00",
  "status": "cancelled"
}
\`\`\``;

    result = await agentLogic.processMessage(session, 'לא תודה, אני רוצה לבטל');
    assert(sentMessages.length === 1, 'Cancellation notification sent');
    assert(sentMessages[0].body.includes('❌'), 'Cancellation emoji (❌)');
    assert(sentMessages[0].body.includes('ביטול פגישה'), 'Cancellation header');
    assert(sentMessages[0].body.includes('בוטל'), 'Meeting time shows "בוטל"');
    assert(sentMessages[0].body.includes('הפגישה בוטלה'), 'Cancellation footer');
    assert(session.leadSent === false, 'leadSent reset to false');
    assert(session.lastMeetingTime === null, 'Meeting time reset to null');
    assert(!result.response.includes('cancelled'), 'Status not shown to client');
    assert(result.response.includes('מכבדת') || result.response.includes('הצלחה') || result.response.includes('תמיד'), 'Graceful farewell message');

    // ─── Test 6: After cancellation → new lead ───
    console.log('\n📋 Test 6: New meeting after cancellation → new lead');
    resetMocks();
    mockAiResponse = `מעולה! היועץ יתקשר ביום חמישי 06.03.2026 בשעה 11:00.

|||json_start|||
\`\`\`json
{
  "full_name": "אחמד חסן", "phone": "0501234567",
  "summary_sentence": "לקוח אחמד חסן, חזר לקבוע פגישה.",
  "meeting_time": "יום חמישי 06.03.2026 בשעה 11:00",
  "status": "confirmed"
}
\`\`\``;

    await agentLogic.processMessage(session, 'חשבתי על זה, בואו נקבע ליום חמישי');
    assert(sentMessages.length === 1, 'Notification sent after cancellation');
    assert(sentMessages[0].body.includes('🔥'), 'Treated as NEW lead (🔥)');
    assert(sentMessages[0].body.includes('נא לחזור אל הלקוח'), 'New lead footer');
    assert(session.leadSent === true, 'leadSent = true again');

    // ─── Test 7: Casual message → no notification ───
    console.log('\n📋 Test 7: Casual message → no notification');
    resetMocks();
    mockAiResponse = 'בשמחה! שיהיה לך יום נפלא! 😊';

    result = await agentLogic.processMessage(session, 'תודה רבה');
    assert(sentMessages.length === 0, 'No notification for casual message');
    assert(result.response.includes('יום נפלא'), 'Casual response passed through');

    // ─── Test 8: JSON extraction - confirmed ───
    console.log('\n📋 Test 8: JSON extraction - confirmed');
    const confirmedJson = geminiService.extractJson('text\n```json\n{"full_name":"Test","status":"confirmed","meeting_time":"יום ראשון 01.01.2026 בשעה 09:00"}\n```');
    assert(confirmedJson !== null, 'JSON extracted');
    assert(confirmedJson.status === 'confirmed', 'Status = confirmed');

    // ─── Test 9: JSON extraction - cancelled ───
    console.log('\n📋 Test 9: JSON extraction - cancelled');
    const cancelledJson = geminiService.extractJson('text\n|||json_start|||\n```json\n{"full_name":"Test","status":"cancelled","meeting_time":"N/A"}\n```');
    assert(cancelledJson !== null, 'Cancelled JSON extracted');
    assert(cancelledJson.status === 'cancelled', 'Status = cancelled');

    // ─── Test 10: No status field → defaults confirmed ───
    console.log('\n📋 Test 10: No status field → defaults to confirmed');
    resetMocks();
    const session2 = agentLogic.createSession('972509999999@c.us');
    mockAiResponse = `מעולה!

|||json_start|||
\`\`\`json
{"full_name":"סלים","phone":"0509999999","summary_sentence":"לקוח סלים.","meeting_time":"יום ראשון 10.03.2026 בשעה 09:00"}
\`\`\``;

    await agentLogic.processMessage(session2, 'בוקר טוב');
    assert(sentMessages.length === 1, 'Notification sent');
    assert(sentMessages[0].body.includes('🔥'), 'Default = new lead');
    assert(!sentMessages[0].body.includes('בוטל'), 'Not cancelled');

    // ─── Test 11: Response cleanup ───
    console.log('\n📋 Test 11: Response cleanup (no JSON artifacts to client)');
    resetMocks();
    const session3 = agentLogic.createSession('972508888888@c.us');
    mockAiResponse = `היועץ יצור איתך קשר!

|||json_start|||
\`\`\`json
{"full_name":"מוחמד","phone":"0508888888","summary_sentence":"לקוח.","meeting_time":"יום שני 11.03.2026 בשעה 12:00","status":"confirmed"}
\`\`\``;

    result = await agentLogic.processMessage(session3, 'פגישה');
    assert(!result.response.includes('```'), 'No code blocks');
    assert(!result.response.includes('json_start'), 'No token');
    assert(!result.response.includes('full_name'), 'No JSON keys');
    assert(!result.response.includes('{'), 'No curly braces');
    assert(result.response.length > 2, 'Meaningful content');

    // ─── Test 12: Session reset ───
    console.log('\n📋 Test 12: Session reset command');
    resetMocks();
    mockAiResponse = '';  // Not used for reset
    result = await agentLogic.processMessage(session, 'אפס את השיחה');
    assert(session.leadSent === false, 'leadSent reset');
    assert(session.lastMeetingTime === null, 'Meeting time reset');
    assert(session.completed === false, 'Completed reset');
    assert(session.history.length === 2, 'History has 2 entries (user+assistant)');
    assert(result.response.includes('אופסה'), 'Reset confirmation message');

    // ─── Summary ───
    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log('══════════════════════════════════════════════════════════');

    if (failed > 0) {
        console.log('\n⚠️  SOME TESTS FAILED! Review above.');
        process.exit(1);
    } else {
        console.log('\n🎉 ALL TESTS PASSED!');
        process.exit(0);
    }
}

runTests().catch(err => { console.error('Test error:', err); process.exit(1); });
