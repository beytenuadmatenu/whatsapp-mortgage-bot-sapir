# מפרט טכני לאוטומציה (Make.com Integration)

## פלט נתונים סופי (JSON)
בסיום השיחה, הסוכן יפיק את האובייקט הבא כחלק מה-Output שלו:

{
  "full_name": "string",
  "phone_number": "string", // יילקח מהמערכת
  "city": "string",
  "amount_requested": "number",
  "purpose": "string",
  "is_property_owner": "boolean",
  "registered_under": "string",
  "registration_location": "string",
  "building_permit": "string",
  "bank_issues": "boolean",
  "lead_score": "Hot/Warm/Cold",
  "customer_summary": "string"
}

## מבנה טבלת Google Sheets
| עמודה | כותרת | סוג נתון |
| :--- | :--- | :--- |
| A | Timestamp | Date/Time |
| B | Full Name | Text |
| C | Phone Number | Phone |
| D | City | Text |
| E | Amount Requested | Currency |
| F | Purpose | Text |
| G | Property Owner | Yes/No |
| H | Registered Under | Text |
| I | Registration Location | Text |
| J | Building Permit | Text |
| K | Bank Issues | Yes/No |
| L | Lead Class | Category |
| M | Summary | Long Text |