const fs = require('fs');
const path = require('path');
const geminiService = require('./geminiService');
const dbService = require('./dbService');
const config = require('./config');

// Load System Prompt
let systemPrompt = "";
try {
    systemPrompt = fs.readFileSync(path.join(__dirname, 'MD', 'System_Prompt.md'), 'utf8');
} catch (err) {
    console.error("Warning: Could not read System_Prompt.md. Using default.", err);
    systemPrompt = "You are Sapir, a mortgage agent at Admatenu Beitenu Mortgages.";
}

// Load Company Knowledge
let companyKnowledge = "";
try {
    companyKnowledge = fs.readFileSync(path.join(__dirname, 'MD', 'Company_Knowledge.md'), 'utf8');
    console.log("[Agent] Company knowledge loaded successfully.");
} catch (err) {
    console.error("Warning: Could not read Company_Knowledge.md.", err);
}

// Combine system prompt with company knowledge
if (companyKnowledge) {
    systemPrompt += "\n\n---\n\n" + companyKnowledge;
}

function createSession(phoneNumber) {
    return {
        phone_number: phoneNumber,
        step: 0,
        data: {},
        history: [], // Standard array of {role, content}
        status: 'active',
        completed: false,
        leadSent: false,        // שומר האם הליד כבר נשלח פעם אחת
        lastMeetingTime: null   // שומר את זמן הפגישה האחרון שנשלח לקבוצה
    };
}

async function processMessage(session, userMessage) {
    if (userMessage.trim() === 'אפס את השיחה') {
        session.history = [];
        session.step = 0;
        session.data = {};
        session.status = 'active';
        session.completed = false;
        session.leadSent = false;
        session.lastMeetingTime = null;

        session.history.push({ role: 'user', content: 'התחל שיחה חדשה' });

        const resetMsg = "השיחה אופסה. אפשר להתחיל מחדש. היי, אני ספיר, איך אפשר לעזור?";
        session.history.push({ role: 'assistant', content: resetMsg });
        return { session, response: resetMsg };
    }

    session.history.push({ role: 'user', content: userMessage });

    // Call Gemini
    const geminiHistory = mapHistoryToGemini(session.history.slice(0, -1));

    const now = new Date();
    const timeString = now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const dynamicSystemPrompt = systemPrompt.replace('__CURRENT_TIME__', dateString + ', ' + timeString);
    console.log(`[Agent] Sending to Gemini... History length: ${session.history.length}`);
    const aiResponseText = await geminiService.generateChatResponse(
        dynamicSystemPrompt,
        geminiHistory,
        userMessage,
        { temperature: 0.7, top_p: 0.9 }
    );

    if (!aiResponseText) {
        const errorResponse = "⚠️ System Error: Unable to connect to Gemini API.";
        session.history.push({ role: 'assistant', content: errorResponse });
        return { session, response: errorResponse };
    }

    // --- 1. ניקוי מחשבות (Reasoning) של Gemini 2.5 Flash ---
    // The AI outputs "THOUGHT" or "THOUGHT:" (with or without colon) followed by English reasoning,
    // then the Hebrew response. We strip everything from THOUGHT to the first Hebrew character.
    let finalResponse = aiResponseText
        .replace(/(THOUGHT|THINKING|REASONING):?[\s\S]*?(?=[\u0590-\u05FF])/gi, '')
        .replace(/^(THOUGHT|THINKING|REASONING):?.*$/gim, '')
        .trim();

    // בדיקת JSON
    const leadSummary = geminiService.extractJson(aiResponseText);

    if (leadSummary) {
        console.log(`[Agent] valid JSON found!`);

        // חילוץ מועד הפגישה מה-JSON
        const timeKey = Object.keys(leadSummary).find(k => k.includes('time') || k.includes('moed') || k.includes('זמן') || k.includes('שעה') || k.includes('meeting'));
        const meetingTime = timeKey ? leadSummary[timeKey] : 'לא צוין';

        // בדיקת סטטוס (חדש/עדכון/ביטול)
        const statusKey = Object.keys(leadSummary).find(k => k.includes('status'));
        const status = statusKey ? leadSummary[statusKey] : 'confirmed';
        const isCancelled = status === 'cancelled';

        // בדיקה: האם לשלוח הודעה לקבוצה? (רק אם ליד חדש או שהמועד באמת השתנה או ביטול)
        const isNewLead = !session.leadSent;
        // Normalize both strings for comparison (remove extra spaces, punctuation)
        const normalize = (s) => (s || '').replace(/[\s.,!?:]+/g, ' ').trim().toLowerCase();
        const isTimeChanged = session.leadSent && normalize(session.lastMeetingTime) !== normalize(meetingTime);

        console.log(`[Agent] Lead check: isNew=${isNewLead}, timeChanged=${isTimeChanged}, cancelled=${isCancelled}, old="${session.lastMeetingTime}", new="${meetingTime}"`);

        if (isNewLead || isTimeChanged || isCancelled) {
            // --- הכנת הנתונים (מחוץ לבלוק של הקבוצה כדי שיהיה זמין לכולם) ---
            const fullNameKey = Object.keys(leadSummary).find(k => k.includes('name') || k.includes('שם'));
            const fullName = fullNameKey ? leadSummary[fullNameKey] : (session.data.full_name || 'לקוח');

            const summaryKey = Object.keys(leadSummary).find(k => k.includes('summary') || k.includes('sentence') || k.includes('פרטים'));
            let details = summaryKey ? leadSummary[summaryKey] : '';
            if (!details) {
                const city = session.data.city || leadSummary['city'] || leadSummary['City of Residence'] || 'לא ידוע';
                const amount = session.data.amount || leadSummary['amount'] || leadSummary['Amount Requested'] || 'לא ידוע';
                const purpose = session.data.purpose || leadSummary['purpose'] || leadSummary['Purpose of Loan'] || 'לא ידוע';
                details = `לקוח ${fullName}, גר ב${city}. מבקש ${amount} למטרת ${purpose}.`;
            }

            const technicalPhone = session.phone_number.split('@')[0].replace(/\D/g, '');
            const cleanPhone = technicalPhone.startsWith('972') ? '0' + technicalPhone.substring(3) : technicalPhone;

            if (config.HOT_LEADS_GROUP_ID) {
                // פורמט טלפון ולינק לוואטסאפ
                const technicalClean = technicalPhone;
                const formattedPhone = technicalClean.startsWith('0') ? `972${technicalClean.substring(1)}` : technicalClean;
                const waLink = `wa.me/${formattedPhone}`;

                // בחירת כותרת (חדש / עדכון / ביטול)
                let emojiHeader, footerMessage;
                if (isCancelled) {
                    emojiHeader = "❌ *ביטול פגישה* ❌";
                    footerMessage = "*סוכן, הפגישה בוטלה!* ⚠️";
                } else if (isNewLead) {
                    emojiHeader = "🔥 *ליד חם חדש (אש)!* 🔥";
                    footerMessage = "*סוכן, נא לחזור אל הלקוח!* 🚀";
                } else {
                    emojiHeader = "🔄 *עדכון מועד פגישה* 🔄";
                    footerMessage = "*סוכן, נא לעדכן ביומן!* 📅";
                }

                const groupMessage = `${emojiHeader}

*שם*: ${fullName}
*טלפון*: ${waLink}
*פרטים*: ${details}
*מועד פגישה*: ${isCancelled ? 'בוטל' : meetingTime}

${footerMessage}`;

                try {
                    const ultraMsgService = require('./ultraMsgService');
                    ultraMsgService.sendMessage(config.HOT_LEADS_GROUP_ID, groupMessage);

                    // עדכון מצב הסשן
                    if (isCancelled) {
                        session.leadSent = false;
                        session.lastMeetingTime = null;
                    } else {
                        session.leadSent = true;
                        session.lastMeetingTime = meetingTime;
                    }

                } catch (e) {
                    console.error("[Agent] Group notification failed:", e);
                }
            }

            // --- שמירת הליד במסד הנתונים (תמיד, גם אם אין קבוצה) ---
            try {
                console.log(`[Agent] Calling upsertLead for ${cleanPhone}...`);
                const success = await dbService.upsertLead({
                    phone: cleanPhone,
                    full_name: fullName,
                    summary_sentence: details,
                    meeting_time: isCancelled ? 'בוטל' : meetingTime,
                    status: isCancelled ? 'cancelled' : 'confirmed'
                });
                console.log(`[Agent] upsertLead result: ${success ? 'Success' : 'Failed'}`);
            } catch (dbError) {
                console.error("[Agent] Database update failed:", dbError);
            }
        }

        // עדכון סטטוס סיום
        session.completed = true;
        session.status = 'finished';
        session.final_data = leadSummary;

        // --- 2. ניקוי הפלט עבור הלקוח (הסרת ה-JSON והשאריות) ---
        finalResponse = finalResponse.replace(/```json[\s\S]*?```/g, "");
        finalResponse = finalResponse.replace(/\bjson\b/gi, "");
        finalResponse = finalResponse.replace(/\|\|\|json_start\|\|\|/g, "");

        const firstBraceIndex = finalResponse.indexOf('{');
        if (firstBraceIndex !== -1) {
            finalResponse = finalResponse.substring(0, firstBraceIndex);
        }

        finalResponse = finalResponse.trim();
        if (finalResponse.length < 2) {
            finalResponse = "תודה רבה! הפרטים התקבלו.";
        }
    }

    session.history.push({ role: 'assistant', content: finalResponse });
    return { session, response: finalResponse };
}

function mapHistoryToGemini(history) {
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