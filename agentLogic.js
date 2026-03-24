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

function createSession(phoneNumber, existingLead = null) {
    const session = {
        phone_number: phoneNumber,
        step: 0,
        data: {},
        history: [], // Standard array of {role, content}
        status: 'active',
        completed: false,
        leadSent: false,        // שומר האם הליד כבר נשלח פעם אחת
        lastMeetingTime: null   // שומר את זמן הפגישה האחרון שנשלח לקבוצה
    };

    if (existingLead && (existingLead.summary_sentence || existingLead.meeting_time)) {
        console.log(`[Agent] Restoring context for ${phoneNumber} from DB.`);
        session.leadSent = true; 
        session.lastMeetingTime = existingLead.meeting_time;
        session.data = {
            full_name: existingLead.full_name,
            summary_sentence: existingLead.summary_sentence
        };
        // Ensure the bot doesn't think it's a completely cold lead
        session.completed = existingLead.status !== 'CANCELLED';

        const contextMsg = `הודעת מערכת חשובה: זיהינו שהלקוח הזה דיבר איתך בעבר או שכבר קבע פגישה.
אלו הנתונים שנשמרו מהשיחה הקודמת:
שם הלקוח: ${existingLead.full_name || 'לא ידוע'}
סטטוס רשום במערכת: ${existingLead.status === 'MEETING_SCHEDULED' ? 'נקבעה פגישה' : existingLead.status}
סיכום שעשית בשיחה הקודמת: ${existingLead.summary_sentence || 'אין'}
מועד פגישה אחרון שנקבע: ${existingLead.meeting_time || 'לא נקבע'}

עלייך להמשיך את השיחה מהנקודה הזו. אם הלקוח סתם רושם משהו, תתייחסי לזה שאת זוכרת אותו. אם הוא מבקש לשנות מועד פגישה - הרגישי חופשי לעשות זאת על בסיס ההיסטוריה הזו.`;
        
        session.history.push({ role: 'user', content: contextMsg });
        session.history.push({ role: 'assistant', content: "הבנתי! קיבלתי את נתוני הלקוח ואמשיך את השיחה איתו מאותה נקודה, בידיעה גמורה של מה שסוכם ונקבע." });
    }

    return session;
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
    const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const timeString = now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const fullDateString = `יום ${hebrewDays[now.getDay()]}, ${dateString}`;
    const dynamicSystemPrompt = systemPrompt
        .replace(/__CURRENT_TIME__/g, timeString)
        .replace(/__CURRENT_DATE__/g, fullDateString);
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

    // --- 1. ניקוי מחשבות (Reasoning) של Gemini ---
    // The AI might output "THOUGHT", "ANALYSIS", etc. in English followed by Hebrew.
    // We strip everything until the first Hebrew character if it's likely internal monologue.
    let finalResponse = aiResponseText;

    // 1.1 Remove lines starting with common internal monologue markers
    finalResponse = finalResponse.replace(/^(THOUGHT|THINKING|REASONING|ANALYSIS|PLAN|INTERNAL|NOTES|SYSTEM):?[\s\S]*?(?=[\u0590-\u05FF])/gi, '');
    
    // 1.2 Remove any standalone lines that are purely English internal monologue
    finalResponse = finalResponse.replace(/^(THOUGHT|THINKING|REASONING|ANALYSIS|PLAN|INTERNAL|NOTES|SYSTEM):?.*$/gim, '');

    // 1.3 Aggressive preamble stripping: If the message starts with English for more than 15 chars, 
    // and Hebrew follows, and it's not a technical string or JSON, strip it.
    const firstHebrewIdx = finalResponse.search(/[\u0590-\u05FF]/);
    if (firstHebrewIdx > 15) {
        const preamble = finalResponse.substring(0, firstHebrewIdx);
        // Don't strip if it looks like JSON or contains technical markers
        if (!preamble.includes('{') && !preamble.includes('|||') && !preamble.includes('```')) {
            console.log(`[Agent] Stripping suspected English internal preamble (${firstHebrewIdx} chars)`);
            finalResponse = finalResponse.substring(firstHebrewIdx);
        }
    }

    finalResponse = finalResponse.trim();

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