require('dotenv').config();
const config = require('./config');
const https = require('https');

console.log("--- Config Check ---");
console.log("Instance ID:", config.ULTRAMSG_INSTANCE_ID ? "Exists" : "MISSING");
console.log("Token:", config.ULTRAMSG_TOKEN ? "Exists" : "MISSING");
console.log("Group ID:", config.HOT_LEADS_GROUP_ID);
console.log("API URL:", config.ULTRAMSG_API_URL);

console.log("\n--- Network Check ---");
const url = config.ULTRAMSG_API_URL;
console.log(`Pinging ${url}...`);

https.get(url, (res) => {
    console.log('statusCode:', res.statusCode);
    console.log('headers:', res.headers);
    console.log('✅ Network seems OK.');
}).on('error', (e) => {
    console.error('❌ Network Error:', e);
});
