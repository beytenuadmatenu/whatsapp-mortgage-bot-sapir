# 🏠 Sapir - WhatsApp Mortgage Agent (TikTak Mortgages)

**Sapir** (ספיר) is an AI-powered WhatsApp chatbot for **TikTak Mortgages** (טיקטק משכנתאות).  
She qualifies leads, schedules appointments, and notifies the sales team — all in **Hebrew**, 24/7.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Conversation** | Gemini 2.5 Flash (primary) + 2.0 Flash (fallback) with 10-retry persistence |
| 🇮🇱 **Hebrew Only** | Politely declines other languages |
| 🎯 **Lead Qualification** | Collects name, city, amount, purpose, property details naturally |
| 📅 **Appointment Scheduling** | Sapir sets the exact day & time — no "a rep will call to schedule" |
| 🔥 **Hot Lead Notifications** | Sends formatted lead summary to WhatsApp group instantly |
| 🔄 **Smart Updates** | If user reschedules, sends an *update* notification (not a duplicate) |
| 🧠 **Thought Filtering** | Strips Gemini 2.5's internal reasoning (THOUGHT:) from client messages |
| 🕐 **Time-Aware Greetings** | Injects real Israel time — says "ערב טוב" at night, not "בוקר טוב" |
| 🛡️ **Clean Chat** | JSON payloads are 100% hidden from the client |

---

## 🏗️ Architecture

```
User (WhatsApp) → UltraMsg Webhook → server.js → agentLogic.js → Gemini API
                                                       ↓
                                              Hidden JSON detected?
                                              ↓ YES              ↓ NO
                                    Send to Hot Leads Group    Reply to user
                                    + Reply to user (clean)
```

### Core Files

| File | Purpose |
|---|---|
| `server.js` | Express server, webhook handler, session management |
| `agentLogic.js` | Conversation logic, JSON extraction, group notifications, THOUGHT filtering |
| `geminiService.js` | Gemini API calls with 10-retry fallback chain (2.5 → 2.0) |
| `ultraMsgService.js` | WhatsApp message sending via UltraMsg API |
| `config.js` | Environment variable loader |
| `MD/System_Prompt.md` | Sapir's persona, rules, and hidden JSON output instructions |

---

## ⚙️ Configuration

Create a `.env` file with the following variables:

```env
GEMINI_API_KEY=your_gemini_api_key
ULTRAMSG_INSTANCE_ID=your_instance_id
ULTRAMSG_TOKEN=your_token
HOT_LEADS_GROUP_ID=120363424190726852@g.us
PORT=3002
```

---

## 🚀 How It Works

1. **User messages** the bot on WhatsApp.
2. **Sapir responds** naturally in Hebrew, collecting info one question at a time.
3. **Meeting scheduled** — Sapir sets a specific day & time with the user.
4. **Hidden JSON** — The AI outputs a structured payload after the friendly closing message.
5. **Server detects** the JSON, strips it from the user's view, and sends a formatted 🔥 notification to the **Hot Leads** WhatsApp group.
6. **User continues** — If the user messages again (e.g., to reschedule), the conversation resumes naturally and a 🔄 *update* notification is sent to the group.

---

## 🔥 Hot Leads Group Message Format

```
🔥 *ליד חם חדש (אש)!* 🔥

*שם*: ישראל ישראלי
*טלפון*: wa.me/972501234567
*פרטים*: לקוח ישראל, גר בחולון. מבקש 1.2M למטרת רכישה.
*מועד פגישה*: יום ראשון ב-10:00

*סוכן, נא לחזור אל הלקוח!* 🚀
```

---

## 🛠️ Local Development

```bash
npm install
node server.js
```

## ☁️ Deployment (Render)

1. Push to GitHub.
2. Deploy on [Render](https://render.com).
3. Set environment variables in the Render Dashboard.
4. Set UltraMsg Webhook URL: `https://your-app.onrender.com/webhook`

---

## ⚠️ Important Notes

- **Do NOT remove** the hidden JSON instruction from `System_Prompt.md` — it triggers the group notifications.
- **Reset command:** Users can type `אפס את השיחה` to start fresh.
- **Model fallback:** If Gemini 2.5 Flash is unavailable, the system retries 10 times (≈45s) before falling back to 2.0 Flash.
