const fs = require('fs');
const path = require('path');
const geminiService = require('./geminiService');
const config = require('./config');

// Load System Prompt
let systemPrompt = "";
try {
    systemPrompt = fs.readFileSync(path.join(__dirname, 'MD', 'System_Prompt.md'), 'utf8');
} catch (err) {
    console.error("Warning: Could not read System_Prompt.md. Using default.", err);
    systemPrompt = "You are Ayelet, a mortgage agent.";
}

function createSession(phoneNumber) {
    return {
        phone_number: phoneNumber,
        step: 0,
        data: {},
        history: [], // Standard array of {role, content}
        status: 'active',
        completed: false
    };
}

async function processMessage(session, userMessage) {
    if (userMessage.trim() === 'אפס את השיחה') {
        session.history = [];
        session.step = 0;
        session.data = {};
        session.status = 'active';
        session.completed = false;

        // Add a "System Start" message from the user to anchor the history.
        // This prevents the bot's greeting from being stripped by the SDK filter (which requires starting with 'user').
        session.history.push({ role: 'user', content: 'התחל שיחה חדשה' });

        const resetMsg = "השיחה אופסה. אפשר להתחיל מחדש. היי, אני ספיר, איך אפשר לעזור?";
        session.history.push({ role: 'assistant', content: resetMsg });
        return { session, response: resetMsg };
    }

    session.history.push({ role: 'user', content: userMessage });

    // Helper to detect if conversation is finished
    if (session.completed) {
        // If user continues talking after completion, we can either ignore or just give a generic "Thanks"
        // In a perfect world, we'd ask Gemini again, but for safety in this loop, a static ack is okay.
        // OR we could let Gemini handle post-completion chat too, but that might re-trigger leads.
        const responseText = "הפרטים כבר נקלטו בהצלחה. נציג ייצור איתך קשר בהקדם!";
        session.history.push({ role: 'assistant', content: responseText });
        return { session, response: responseText };
    }

    // Call Gemini
    const geminiHistory = mapHistoryToGemini(session.history.slice(0, -1)); // History excluding current msg

    // Inject Current Time/Date for accurate greetings
    const now = new Date();
    const timeString = now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const dynamicSystemPrompt = `${systemPrompt}\n\n**Current Date/Time in Israel:** ${dateString}, ${timeString}`;

    console.log(`[Agent] Sending to Gemini... History length: ${session.history.length}`);
    const aiResponseText = await geminiService.generateChatResponse(
        dynamicSystemPrompt,
        geminiHistory,
        userMessage, // Current message
        { temperature: 0.7, top_p: 0.9 }
    );

    if (!aiResponseText) {
        // Fallback if AI fails completely - EXPLICIT ERROR FOR DEBUGGING
        const errorResponse = "⚠️ System Error: Unable to connect to Gemini API. Please check server logs for details (API Key or Model Issue).";
        session.history.push({ role: 'assistant', content: errorResponse });
        return { session, response: errorResponse };
    }

    // Check for "LEAD_SUMMARY" JSON
    const leadSummary = geminiService.extractJson(aiResponseText, 'LEAD_SUMMARY');

    let finalResponse = aiResponseText;

    if (leadSummary) {
        console.log(`[Agent] LEAD_SUMMARY found! Completing session.`);
        session.completed = true;
        session.status = 'finished';
        session.final_data = leadSummary;

        // Remove JSON block from response to get the pleasant closing message
        // The System Prompt provides text BEFORE the JSON. We need to strip everything from the first JSON-like structure.

        // Strategy: 
        // 1. Remove standard markdown json blocks
        finalResponse = aiResponseText.replace(/```json[\s\S]*?```/g, "");

        // 2. Remove "json" label if it appears alone or before a brace
        finalResponse = finalResponse.replace(/\bjson\b/gi, "");

        // 3. AGGRESSIVE: Remove everything from the first '{' to the end.
        // We assume the model outputs text first, then the JSON block.
        const firstBraceIndex = finalResponse.indexOf('{');
        if (firstBraceIndex !== -1) {
            finalResponse = finalResponse.substring(0, firstBraceIndex);
        }

        // 4. Cleanup trailing whitespace
        finalResponse = finalResponse.trim();

        // Fallback only if absolutely empty, but we trust Gemini 2 Flash with the new prompt.
        if (finalResponse.length < 2) {
            finalResponse = "תודה רבה! הפרטים התקבלו.";
        }

        // ALWAYS send to Group if ID is configured
        if (config.HOT_LEADS_GROUP_ID) {
            // Data Extraction logic to match users specific format request

            // Name
            const fullNameKey = Object.keys(leadSummary).find(k => k.includes('name') || k.includes('שם'));
            const fullName = fullNameKey ? leadSummary[fullNameKey] : (session.data.full_name || 'לקוח');

            // Meeting Time
            const timeKey = Object.keys(leadSummary).find(k => k.includes('time') || k.includes('moed') || k.includes('זמן') || k.includes('שעה') || k.includes('meeting'));
            const meetingTime = timeKey ? leadSummary[timeKey] : 'לא צוין';

            // Summary Details Sentence
            const summaryKey = Object.keys(leadSummary).find(k => k.includes('summary') || k.includes('sentence') || k.includes('פרטים'));
            let details = summaryKey ? leadSummary[summaryKey] : '';

            if (!details) {
                const city = session.data.city || leadSummary['city'] || leadSummary['City of Residence'] || 'לא ידוע';
                const amount = session.data.amount || leadSummary['amount'] || leadSummary['Amount Requested'] || 'לא ידוע';
                const purpose = session.data.purpose || leadSummary['purpose'] || leadSummary['Purpose of Loan'] || 'לא ידוע';
                details = `לקוח ${fullName}, גר ב${city}. מבקש ${amount} למטרת ${purpose}.`;
            }

            // Phone cleaning and formatting logic from user snippet
            const cleanPhone = session.phone_number.split('@')[0].replace(/\D/g, '');
            const formattedPhone = cleanPhone.startsWith('0') ? `972${cleanPhone.substring(1)}` : cleanPhone;
            const waLink = `wa.me/${formattedPhone}`;

            // Details logic (using summary_sentence from Gemini as 'details')
            const groupMessage = `🔥 *ליד חם חדש (אש)!* 🔥

*שם*: ${fullName}
*טלפון*: ${waLink}
*פרטים*: ${details}
*מועד חזרה רצוי*: ${meetingTime || 'בהקדם'}

*סוכן, נא חזור אל הלקוח!* 🚀`;

            try {
                const ultraMsgService = require('./ultraMsgService');
                ultraMsgService.sendMessage(config.HOT_LEADS_GROUP_ID, groupMessage);
            } catch (e) {
                console.error("[Agent] Group notification failed:", e);
            }
        }
    }

    session.history.push({ role: 'assistant', content: finalResponse });
    return { session, response: finalResponse };
}

function mapHistoryToGemini(history) {
    // Filter out leading model messages to comply with Gemini SDK requirements
    // The conversation history MUST start with a user message.
    let cleanHistory = [...history];
    while (cleanHistory.length > 0 && cleanHistory[0].role === 'assistant') {
        cleanHistory.shift();
    }

    return cleanHistory.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));
}

module.exports = {
    createSession,
    processMessage
};
