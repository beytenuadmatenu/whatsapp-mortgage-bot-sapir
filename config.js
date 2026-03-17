require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ULTRAMSG_INSTANCE_ID: process.env.ULTRAMSG_INSTANCE_ID,
    ULTRAMSG_TOKEN: process.env.ULTRAMSG_TOKEN,
    ULTRAMSG_API_URL: `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/`,
    HOT_LEADS_GROUP_ID: process.env.HOT_LEADS_GROUP_ID,
    MANAGER_PHONE: process.env.MANAGER_PHONE || "972545554588@c.us",
    MANAGER_EMAIL: process.env.MANAGER_EMAIL || "admateinu.beitenu@gmail.com",
    CRM_URL: process.env.CRM_URL || "https://crm-dashboard-paio.onrender.com/",
};
