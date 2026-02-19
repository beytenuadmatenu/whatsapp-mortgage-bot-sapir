function simulateGroupMessage(jsonInput) {
    const leadSummary = JSON.parse(jsonInput);
    const session = {
        phone_number: '972524718700@c.us',
        data: {}
    };

    // --- Simulating `agentLogic.js` formatting logic ---
    const fullNameKey = Object.keys(leadSummary).find(k => k.includes('name') || k.includes('שם'));
    const fullName = fullNameKey ? leadSummary[fullNameKey] : 'לקוח';

    const timeKey = Object.keys(leadSummary).find(k => k.includes('time') || k.includes('moed') || k.includes('זמן') || k.includes('שעה') || k.includes('meeting'));
    const meetingTime = timeKey ? leadSummary[timeKey] : 'לא צוין';

    const summaryKey = Object.keys(leadSummary).find(k => k.includes('summary') || k.includes('sentence') || k.includes('פרטים'));
    let details = summaryKey ? leadSummary[summaryKey] : '';

    const groupMessage = `🔥 ליד חם חדש (אש)! 🔥\n\nשם: ${fullName}\nטלפון: wa.me/${session.phone_number.split('@')[0]}\nפרטים: ${details}\nמועד חזרה רצוי: ${meetingTime}\n\nסוכן, נא חזור אל הלקוח! 🚀`;

    console.log("----- RESULT (This is what is sent to Group) -----");
    console.log(groupMessage);
}

// User's example JSON input from prompt
const exampleJson = JSON.stringify({
    "full_name": "אלכס",
    "phone": "972524718700",
    "summary_sentence": "לקוח אלכס, גר בקריית ים. מבקש 500,000 ש\"ח למטרת איחוד הלוואות וכסף למשפחה. נכס: אין. בעיות בנקים: ממש לא.",
    "meeting_time": "תדברו איתי אני זמין"
});

simulateGroupMessage(exampleJson);
