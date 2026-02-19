const axios = require('axios');
const config = require('./config');

const sendMessage = async (chatId, message) => {
    if (!chatId || !message) {
        console.error('sendMessage: chatId and message are required');
        return;
    }

    // UltraMsg expects simple numbers for 'to', or chatId with @c.us for groups/contacts
    // But usually for WhatsApp numbers, just the number is fine.
    // However, to be safe and consistent with our previous logic:
    const to = chatId.includes('@') ? chatId : chatId;

    const url = `${config.ULTRAMSG_API_URL}messages/chat`;

    try {
        const response = await axios.post(url, {
            token: config.ULTRAMSG_TOKEN,
            to: to,
            body: message
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`[UltraMsg] Message sent to ${to}:`, response.data);
        return response.data;
    } catch (error) {
        console.error('[UltraMsg] Error sending message:', error.response ? error.response.data : error.message);
        throw error;
    }
};

module.exports = {
    sendMessage
};
