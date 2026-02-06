# WhatsApp Mortgage Agent - Ayelet

AI-powered WhatsApp chatbot for mortgage customer service using Google Gemini and UltraMsg.

## Features
- ✅ Hebrew conversational AI (Gemini 2.0 Flash)
- ✅ Lead qualification & scoring (HOT/WARM/COLD)
- ✅ UltraMsg WhatsApp integration
- ✅ Automated data collection

## Environment Variables
Set these in your deployment platform:
```
PORT=3002
GEMINI_API_KEY=your_gemini_api_key_here
ULTRAMSG_INSTANCE_ID=instance160741
ULTRAMSG_TOKEN=your_ultramsg_token_here
HOT_LEADS_GROUP_ID=your_whatsapp_group_id@g.us
```

## Deployment (Render.com)
1. Connect this GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy!
4. Copy the Render URL and add `/webhook` to UltraMsg webhook settings

## Local Development
```bash
npm install
npm start
```

## Tech Stack
- Node.js + Express
- Google Gemini AI
- UltraMsg (WhatsApp API)
