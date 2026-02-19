# WhatsApp Mortgage Agent - Sapir (TikTak Mortgages)

**Sapir** is an AI-powered WhatsApp agent for TikTak Mortgages (טיקטק משכנתאות), designed to qualify leads and schedule appointments in **Hebrew**.

## Features
- 🗣️ **Natural Conversation:** Uses Google Gemini 2.0 Flash for human-like dialogue.
- 🇮🇱 **Strict Hebrew Policy:** Politely declines other languages.
- 🎯 **Lead Qualification:** Collects name, amount, purpose, and property details naturally.
- 📅 **Appointment Scheduling:** Suggests specific time slots.
- 🔥 **Hot Lead Notifications:** Sends formatted summary to a "Hot Leads" WhatsApp group.
- 🛡️ **Clean Chat:** Hides technical data (JSON) from the client completely.

## Configuration
This bot requires the following Environment Variables in `.env` or Render Dashboard.

## How It Works
1. **User Chats:** The user messages the bot.
2. **AI Responds:** "Sapir" replies naturally to collect info.
3. **Completion:** When a meeting is set, the AI outputs a hidden JSON payload.
4. **Action:** The server detects the JSON, strips it from the user's chat, and forwards a formatted message to the **Hot Leads Group**.

## Deployment
1. **Push to GitHub.**
2. **Deploy on Render.**
3. **Set Webhook:** Add `https://your-app.onrender.com/webhook` to UltraMsg settings.

## Local Development
To run locally:
```bash
npm install
node server.js
```
