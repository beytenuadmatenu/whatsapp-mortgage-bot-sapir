const fs = require('fs');
const path = require('path');
const geminiService = require('./geminiService');
const config = require('./config');

// Load System Prompt (Synchronous read for simplicity at startup)
let systemPrompt = "";
try {
    systemPrompt = fs.readFileSync(path.join(__dirname, 'MD', 'System_Prompt.md'), 'utf8');
} catch (err) {
    console.error("Warning: Could not read System_Prompt.md. Using default.", err);
    systemPrompt = "You are Ayelet, a mortgage agent.";
}

// Internal flow definition based on System_Prompt.md
const FLOW_STEPS = [
    { id: 0, field: 'greeting', question: 'שלום רב, כאן איילת מוואן משכנתאות. אני שמחה מאוד שפנית אלינו! לפני שנתקדם, מה שלומך היום?' },
    { id: 1, field: 'full_name', question: 'נעים מאוד! כדי שנוכל להתחיל בתהליך בצורה המקצועית ביותר, אשמח לדעת מה שמך המלא?' },
    { id: 2, field: 'city', question: 'תודה. ובאיזה יישוב את/ה מתגורר/ת כיום?' },
    { id: 3, field: 'amount_requested', question: 'הבנתי. מהו סכום המימון המבוקש שדרוש לך?' },
    { id: 4, field: 'purpose', question: 'ולאיזו מטרה ישמש הכסף? (למשל: שיפוץ, סגירת חובות, רכישת רכב וכו\')' },
    { id: 5, field: 'has_property', question: 'שאלה חשובה בתהליך – האם בבעלותך נכס נדל"ן כלשהו?' },
    { id: 6, field: 'property_owner', question: 'על שם מי רשום הנכס הנוכחי? (האם על שמך, על שם הורה, או מישהו אחר?)' },
    { id: 7, field: 'property_registry', question: 'היכן רשום הנכס? (טאבו, מינהל, או אולי עדיין לא רשום?)' },
    { id: 8, field: 'building_permit', question: 'האם קיים היתר בניה מסודר לנכס?' },
    { id: 9, field: 'bank_issues', question: 'לסיום החלק הטכני, האם היו בשלוש השנים האחרונות אתגרים מול הבנקים (כמו חזרות צ’קים, הגבלות או עיקולים)?' }
];

function createSession(phoneNumber) {
    return {
        phone_number: phoneNumber,
        step: 0,
        data: {},
        history: [],
        status: 'active',
        completed: false
    };
}

async function processMessage(session, userMessage) {
    session.history.push({ role: 'user', content: userMessage });

    // Check for completion AFTER adding to history but BEFORE processing
    if (session.completed || session.step >= FLOW_STEPS.length) {
        if (userMessage.includes('תודה') || userMessage.includes('ביי')) {
            responseText = "בשמחה! נציג יחזור אליך בהקדם. יום נהדר!";
        } else {
            responseText = "הפרטים שלך כבר הועברו לנציג. אם תרצה/י להתחיל מחדש, שלח/י 'איפוס'.";
        }
        session.history.push({ role: 'assistant', content: responseText });
        return { session, response: responseText };
    }

    // Initialize retryCount if it doesn't exist
    if (session.retryCount === undefined) session.retryCount = 0;

    let currentStep = FLOW_STEPS[session.step];
    let nextStep = FLOW_STEPS[session.step + 1];
    const nextQuestionText = nextStep ? nextStep.question : "תודה רבה! העברתי את הפרטים לנציג והוא יחזור אליך בהקדם.";

    // Combined AI Turn: Extract current field + Generate next response
    let aiResult = null;

    if (session.step === 0) {
        // Step 0: Initial Greeting acknowledgment - NO AI NEEDED
        console.log(`[Agent] Step 0: Skipping AI for greeting. Advancing to Name.`);
        aiResult = { extracted_value: 'acknowledged', agent_response: FLOW_STEPS[1].question };
    } else if (currentStep && currentStep.field) {
        // Unified extraction and generation
        console.log(`[Agent] Step ${session.step}: Processing AI turn for ${currentStep.field}.`);
        aiResult = await geminiService.processTurn(
            systemPrompt,
            mapHistoryToGemini(session.history.slice(0, -1)),
            userMessage,
            currentStep.field,
            `The user's answer to: "${currentStep.question}"`,
            nextQuestionText
        );
    }

    let responseText = "";
    let advanced = false;

    if (aiResult) {
        const extractValue = aiResult.extracted_value;
        responseText = aiResult.agent_response;

        if (session.step === 0) {
            advanced = true;
        } else if (extractValue !== null && extractValue !== undefined) {
            const cleanVal = String(extractValue).toLowerCase().trim();
            const isInvalid = cleanVal === "" || cleanVal === "null" || cleanVal === "none" || cleanVal === "unknown";

            if (!isInvalid) {
                session.data[currentStep.field] = extractValue;
                advanced = true;
            }
        }
    } else {
        responseText = currentStep ? currentStep.question : "סליחה, לא הבנתי. תוכל/י לחזור על זה?";
    }

    // Truly resilient fallback: check for advancement even if AI failed
    if (!advanced && currentStep) {
        session.retryCount++;
        console.log(`[Agent] Advancement failed for ${currentStep.field}. Retry count: ${session.retryCount}`);

        // FORCED ADVANCEMENT LOGIC
        const maxRetriesForStep = (currentStep.field === 'full_name') ? 1 : 2;

        if (session.retryCount >= maxRetriesForStep || aiResult === null) {
            console.log(`[Agent] Failover triggered for ${currentStep.field} (AI is ${aiResult ? 'confused' : 'choked'}). Forcing advancement.`);
            session.data[currentStep.field] = userMessage;
            advanced = true;

            if (nextStep) {
                // Avoid double "Toda" if the next question already starts with a greeting/thanks
                const qText = nextStep.question;
                if (qText.startsWith('הבנתי') || qText.startsWith('תודה') || qText.startsWith('מעולה')) {
                    responseText = qText;
                } else {
                    responseText = `הבנתי, תודה. ${qText}`;
                }
            } else {
                responseText = "תודה רבה. העברתי את הפרטים לנציג.";
            }
        }
    }

    if (advanced) {
        console.log(`[Agent] SUCCESS: Advancing from ${session.step} (${currentStep?.field}) to ${session.step + 1}`);
        session.step++;
        session.retryCount = 0; // Reset for next step
    }

    // Wrap up
    if (session.step >= FLOW_STEPS.length) {
        session.completed = true;
        session.status = 'finished';
        const score = calculateLeadScore(session.data);
        session.final_data = { ...session.data, lead_score: score, customer_summary: formatSummary(session.data) };

        if (score === 'HOT' && config.HOT_LEADS_GROUP_ID) {
            const groupMessage = `🔥 *ליד חם חדש (אש)!* 🔥\n*שם:* ${session.data.full_name}\n*טלפון:* wa.me/${session.phone_number.split('@')[0]}\n*פרטים:* ${session.final_data.customer_summary}\n\nנציג, נא לחזור אל הלקוח/ה בדחיפות! 🚀`;
            const ultraMsgService = require('./ultraMsgService');
            ultraMsgService.sendMessage(config.HOT_LEADS_GROUP_ID, groupMessage).catch(e => console.error("[Agent] Group notification failed:", e));
        }
    }

    session.history.push({ role: 'assistant', content: responseText });
    return { session, response: responseText };
}

function mapHistoryToGemini(history) {
    // History is [{ role: 'user'|'assistant', content: string }]
    // Gemini expects [{ role: 'user'|'model', parts: [{ text: string }] }]
    return history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));
}

function isYes(text) {
    if (!text) return false;
    const clean = text.toLowerCase().trim();
    // common Hebrew 'yes' synonyms
    return /כן|אמת|ברור|חיובי|יאפ|בוודאי|נכון/.test(clean);
}

function calculateLeadScore(data) {
    const hasProperty = isYes(data.has_property);
    const isTabu = (data.property_registry || '').includes('טאבו');
    const isMinhal = (data.property_registry || '').includes('מינהל');
    const hasPermit = isYes(data.building_permit);
    const bankIssues = data.bank_issues || '';
    const noBankIssues = bankIssues.includes('לא') || bankIssues.includes('אין');

    if (!hasProperty) return 'COLD';
    if (bankIssues.includes('עיקול') || bankIssues.includes('הגבלה')) return 'COLD';

    if (hasProperty && isTabu && hasPermit && noBankIssues) return 'HOT';

    return 'WARM';
}

function formatSummary(data) {
    return `לקוח ${data.full_name}, גר ב${data.city}. מבקש ${data.amount_requested} למטרת ${data.purpose}. נכס: ${data.has_property} (${data.property_registry}). בעיות בנקים: ${data.bank_issues}`;
}

module.exports = {
    createSession,
    processMessage
};
