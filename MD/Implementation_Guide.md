# הנחיות להטמעה ב-Anti Gravity

1. **System Prompt:** העתק את תוכן `System_Prompt.md`.
2. **Memory:** וודא שזיהוי השיחה (Conversation ID) מבוסס על מספר הטלפון של השולח כדי לשמור על רצף השאלות.
3. **Variables:** הגדר משתנה חיצוני בשם `phone_number` שיועבר מה-Webhook של וואטסאפ לסוכן.
4. **Trigger JSON:** הנחה את הסוכן להפיק את ה-JSON רק כאשר השאלה האחרונה (שאלה 9) קיבלה מענה.
5. **Post-Process:** ב-Make, השתמש ב-JSON Parser כדי לפרק את תשובת הבוט ולהעביר אותה למודולים של Google Sheets ו-WhatsApp Group.