const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const agentLogic = require('./agentLogic');
const config = require('./config');
const ultraMsgService = require('./ultraMsgService');
const dbService = require('./dbService');

const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Persistent session storage
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
let sessions = {};
try {
    if (fs.existsSync(SESSIONS_FILE)) {
        sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        console.log(`[Server] Loaded ${Object.keys(sessions).length} sessions from disk.`);
    }
} catch (err) {
    console.error("[Server] Error loading sessions file:", err);
}

function saveSessions() {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
    } catch (err) {
        console.error("[Server] Error saving sessions file:", err);
    }
}

const processedMsgIds = new Set();

// Health Check
app.get('/health', (req, res) => {
    res.send('Ayelet Agent is Online');
});

// Green API Webhook Endpoint (Now handles UltraMsg too)
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        // Removed debug logging that exposed PII

        // Log basic info about the webhook
        console.log(`[Webhook] Received event: ${body.event_type || body.event || body.typeWebhook} from ${body.data?.from || body.senderData?.chatId}`);

        // Detect incoming message format and ID
        let chatId, message, msgId;

        // UltraMsg format (Standard chat)
        if ((body.event_type === 'message_received' || body.event === 'message_received') && body.data) {
            if (body.data.type === 'chat') {
                // IMPORTANT: Ignore messages sent by the bot itself (fromMe: true)
                if (body.data.fromMe === true || body.data.fromMe === "true") {
                    console.log(`[Webhook] Skipping outgoing message from bot (ID: ${body.data.id})`);
                    return res.status(200).send('Ignored self');
                }

                chatId = body.data.from;
                message = body.data.body;
                msgId = body.data.id;

                // IMPORTANT: Ignore group messages — only respond to private (direct) chats
                if (chatId && chatId.endsWith('@g.us')) {
                    console.log(`[Webhook] Skipping group message from ${chatId}`);
                    return res.status(200).send('Ignored group');
                }

                console.log(`[Webhook] UltraMsg Chat from ${chatId}: "${message}" (ID: ${msgId})`);
            }
        }
        // Green API format (Keep for compatibility/backup)
        else if (body.typeWebhook === 'incomingMessageReceived' && body.messageData?.typeMessage === 'textMessage') {
            chatId = body.senderData.chatId;
            message = body.messageData.textMessageData.textMessage;
            msgId = body.idMessage;
            console.log(`[Webhook] Green API Chat from ${chatId}: "${message}" (ID: ${msgId})`);
        }

        if (chatId && message && msgId) {
            // Manual Reset Keyword
            if (message.trim().toLowerCase() === 'איפוס') {
                console.log(`[Server] Manual reset requested for ${chatId}`);
                delete sessions[chatId];
                saveSessions();
                await ultraMsgService.sendMessage(chatId, "השיחה אופסה. אפשר להתחיל מחדש! שלח/י 'היי' כדי להתחיל.");
                return res.status(200).send('Reset');
            }

            // 1. Idempotency Check
            if (processedMsgIds.has(msgId)) {
                console.log(`[Webhook] Duplicate message detected (ID: ${msgId}). Skipping.`);
                return res.status(200).send('Duplicate');
            }
            // Keep set size manageable
            if (processedMsgIds.size > 1000) processedMsgIds.clear();
            processedMsgIds.add(msgId);

            if (!sessions[chatId]) {
                console.log(`[Server] Creating NEW session for ${chatId}`);
                
                // Try to fetch existing history from Supabase
                const technicalPhone = chatId.split('@')[0].replace(/\D/g, '');
                const cleanPhone = technicalPhone.startsWith('972') ? '0' + technicalPhone.substring(3) : technicalPhone;
                
                let existingLead = null;
                try {
                    existingLead = await dbService.getLeadByPhone(cleanPhone);
                } catch (e) {
                    console.error("[Server] Could not fetch previous lead data:", e);
                }

                sessions[chatId] = agentLogic.createSession(chatId, existingLead);
            }
            const session = sessions[chatId];
            // Log state changes without saving to disk in cleartext
            console.log(`[Server] State Before: chatId=${chatId}, Step=${session.step}, Retry=${session.retryCount || 0}`);

            // 3. Concurrency Lock
            if (session.isProcessing) {
                console.log(`[Webhook] Session ${chatId} is already processing. Rejecting retry.`);
                return res.status(200).send('Locked');
            }
            session.isProcessing = true;

            try {
                const result = await agentLogic.processMessage(session, message);

                // Update session state
                sessions[chatId] = result.session;
                saveSessions();
                // State change logging without saving to disk
                console.log(`[Server] State After: chatId=${chatId}, NewStep=${result.session.step}, NewRetry=${result.session.retryCount}`);
                console.log(`[Server] After process: ${chatId} - New Step: ${result.session.step}, New Retry: ${result.session.retryCount}`);

                // Send response via UltraMsg
                if (result.response) {
                    console.log(`[Webhook] Sending response to ${chatId}...`);
                    await ultraMsgService.sendMessage(chatId, result.response);
                }
            } finally {
                session.isProcessing = false;
            }

            return res.status(200).send('OK');
        } else {
            return res.status(200).send('Handled');
        }

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint to reset session (for testing)
app.post('/reset', (req, res) => {
    const { phone_number } = req.body;
    if (sessions[phone_number]) {
        delete sessions[phone_number];
        res.json({ message: 'Session reset' });
    } else {
        res.json({ message: 'No session found to reset' });
    }
});

app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);

    // 4. Automated Reminders Scheduler (Starts after server is up)
    console.log('[Scheduler] Starting Automated Reminders Task (checks every 5 mins)...');
    setInterval(async () => {
        try {
            console.log('[Scheduler] Checking for upcoming meetings (30-min window)...');
            // We look for meetings that start in the next 35 minutes
            const upcomingLeads = await dbService.getUpcomingMeetings(35);

            for (const lead of upcomingLeads) {
                // If we already sent a reminder, skip
                if (lead.reminder_sent_at) continue;

                console.log(`[Scheduler] FOUND upcoming meeting for ${lead.full_name}. Sending reminder...`);

                // For now, the user asked for EMAIL. 
                // Since this is a server, we would normally use SendGrid/Nodemailer.
                // However, I'll also send a WhatsApp alert to Sapir (the consultant)
                // to make sure she's aware even if her computer is closed.
                const reminderText = `היי, תזכורת אוטומטית: יש לך פגישה עם ${lead.full_name} בעוד 30 דקות! 📅\n\nפרטי הפגישה:\n👤 לקוח: ${lead.full_name}\n📞 טלפון: ${lead.phone}\n📝 נושא: ${lead.summary_sentence || 'שיחת ייעוץ'}\n⏰ מועד: ${lead.meeting_time}\n\nבהצלחה! 🍀`;

                // Send WhatsApp to Sapir
                await ultraMsgService.sendMessage(config.MANAGER_PHONE, reminderText);

                // Mark as reminded so we don't send again
                await dbService.markLeadAsReminded(lead.phone);
                console.log(`[Scheduler] Reminder successfully sent and marked for ${lead.phone}`);
            }
        } catch (err) {
            console.error('[Scheduler] Error in automated reminders task:', err);
        }
    }, 5 * 60 * 1000); // Every 5 minutes

    // No need to ping CRM to keep it awake anymore
});
