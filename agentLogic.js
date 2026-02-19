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
    session.history.push({ role: 'user', content: userMessage });

    // Helper to detect if conversation is finished
    if (session.completed) {
        // If user continues talking after completion, we can either ignore or just give a generic "Thanks"
        const responseText = "הפרטים כבר נקלטו בהצלחה. נציג ייצור איתך קשר בהקדם!";
        session.history.push({ role: 'assistant', content: responseText });
        return { session, response: responseText };
    }

    // Call Gemini
    const geminiHistory = mapHistoryToGemini(session.history.slice(0, -1)); // History excluding current msg

    console.log(`[Agent] Sending to Gemini... History length: ${session.history.length}`);
    const aiResponseText = await geminiService.generateChatResponse(
        systemPrompt,
        geminiHistory,
        userMessage, // Current message
        { temperature: 0.7, top_p: 0.9 }
    );

    if (!aiResponseText) {
        // Fallback if AI fails completely
        const errorResponse = "סליחה, יש לי רגע של בלבול. תוכל לכתוב לי שוב?";
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
        finalResponse = aiResponseText.replace(/```json[\s\S]*?```/g, "").replace(/\{[\s\S]*"LEAD_SUMMARY"[\s\S]*\}/g, "").trim();

        if (finalResponse.length < 5) {
            // If AI just gave JSON, we need a polite closing.
            finalResponse = "תודה רבה על כל הפרטים! רשמתי הכל ואנחנו ניצור איתך קשר בהקדם הלאה. יום מקסים!";
        }

        // Calculate Lead Score based on Summary Data
        const score = calculateLeadScore(leadSummary);

        // ALWAYS send to Group if ID is configured (User Request)
        if (config.HOT_LEADS_GROUP_ID) {
            const customerSummary = Object.entries(leadSummary).map(([k, v]) => `${k}: ${v}`).join('\n');

            // Try to find specific fields for the formatted message, favoring Hebrew keys from prompt
            const fullNameKey = Object.keys(leadSummary).find(k => k.includes('Full Name') || k.includes('שם מלא'));
            const fullName = fullNameKey ? leadSummary[fullNameKey] : (session.data.full_name || 'לקוח');

            // Dynamic Header
            const title = score === 'HOT' ? "🔥 *ליד חם (אש)!* 🔥" : "🔔 *ליד חדש מהבוט* 🔔";

            const groupMessage = `${title}\n*שם:* ${fullName}\n*טלפון:* wa.me/${session.phone_number.split('@')[0]}\n*דירוג:* ${score}\n\n*פרטים:* \n${customerSummary}\n\nנציג, נא לחזור אל הלקוח/ה! 🚀`;

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
    return history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));
}

function isYes(text) {
    if (!text) return false;
    const clean = String(text).toLowerCase().trim();
    return /yes|כן|אמת|ברור|חיובי|יאפ|בוודאי|נכון/.test(clean);
}

function calculateLeadScore(data) {
    const getVal = (keys) => {
        for (const k of keys) {
            if (data[k]) return data[k];
            // Also check for keys that *contain* the string (fuzzy match)
            const foundKey = Object.keys(data).find(dk => keys.some(search => dk.includes(search)));
            if (foundKey) return data[foundKey];
        }
        return '';
    };

    const hasPropertyVal = getVal(['Property Ownership', 'האם בעל נכס', 'has_property']);
    const hasProperty = isYes(hasPropertyVal);

    const registry = String(getVal(['Property Registry', 'היכן רשום הנכס', 'property_registry']));
    const isTabu = registry.includes('Tabu') || registry.includes('טאבו');
    const isMinhal = registry.includes('Minhal') || registry.includes('מינהל');

    const buildingPermitVal = getVal(['Building Permit', 'האם קיים היתר בניה', 'building_permit']);
    const buildingPermit = isYes(buildingPermitVal);

    const bankIssues = String(getVal(['Bank Issues', 'בעיות בבנקים', 'bank_issues']));
    const noBankIssues = !isYes(bankIssues) && (bankIssues.includes('No') || bankIssues.includes('לא') || bankIssues.includes('אין') || bankIssues === 'None' || bankIssues === 'null');

    // Logic: Has Property AND (Tabu OR Minhal) AND Permit AND No Issues -> HOT
    if (hasProperty && (isTabu || isMinhal) && buildingPermit && noBankIssues) {
        return 'HOT';
    }
    return 'WARM';
}

module.exports = {
    createSession,
    processMessage
};
