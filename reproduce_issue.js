const problematicText = `מעולה! אז נקבע לך פגישה ליום ראשון בשעה 10:00 בבוקר. תודה רבה על כל המידע מיה, שמחתי לעזור! פרטיך נקלטו במערכת, ונציג שלנו יצור איתך קשר בהקדם.

json
{
  "full_name": "מיה",
  "phone": "Unknown",
  "summary_sentence": "לקוחה בשם מיה, גרה בקרית מוצקין. מבקשת מיליון וחצי ש״ח לרכישת דירה. יש נכס בבעלותה הרשום בטאבו. אין בעיות בנקים.",
  "meeting_time": "יום ראשון בשעה 10:00"
}`;

function currentLogic(text) {
    let finalResponse = text;
    // 1. Remove standard markdown json blocks
    finalResponse = finalResponse.replace(/```json[\s\S]*?```/g, "");

    // 2. Remove "json" label if it appears alone or before a brace
    finalResponse = finalResponse.replace(/\bjson\b/gi, "");

    // 3. AGGRESSIVE: Find the last occurrence of '{' and remove everything from there to the end
    const lastBraceIndex = finalResponse.lastIndexOf('}');
    const firstBraceIndex = finalResponse.indexOf('{');

    console.log(`First Brace: ${firstBraceIndex}, Last Brace: ${lastBraceIndex}`);

    if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
        finalResponse = finalResponse.substring(0, firstBraceIndex);
    }
    return finalResponse.trim();
}

function newRegexLogic(text) {
    // Regex looking for the JSON block at the end
    // Matches: [newlines] [optional json/```] [brace] [content] [brace] [optional ```] [end]
    return text.replace(/\n\s*(?:```json|json)?\s*\{[\s\S]*\}\s*(?:```)?$/i, "").trim();
}

console.log("--- Current Logic Output ---");
console.log("'" + currentLogic(problematicText) + "'");

console.log("\n--- New Regex Logic Output ---");
console.log("'" + newRegexLogic(problematicText) + "'");
