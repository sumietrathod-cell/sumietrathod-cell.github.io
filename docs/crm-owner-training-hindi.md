# AAROHAN AI WORLD — CRM Owner Training (Hindi)

> **Owner practice guide.** CRM screen buttons are in English. Use only demo/dummy records while learning. Do not upload employer data, customer information without permission, passwords, OTPs or API keys.

## 1. CRM क्या है?
CRM (Customer Relationship Management) = कंपनी में enquiry आने से लेकर sale और follow-up तक हर ग्राहक की जानकारी व्यवस्थित रखना। एक lead = ऐसा व्यक्ति/बिज़नेस जो हमारी service में दिलचस्पी दिखा सकता है।

**Live owner link:** https://aarohanaiworld.com/campaign-manager.html

## 2. अपना Admin Login
1. लिंक खोलें और **Sign in** चुनें।
2. Campaign Manager के अपने account email और password से login करें (Supabase Dashboard password अलग हो सकता है)।
3. **Admin dashboard** लिखे तो सही account है। **Partner dashboard** लिखे तो सीमित partner permissions हैं।
4. password भूल जाएँ तो **Set or reset password** चुनें। पासवर्ड/OTP किसी को न दें।
5. काम खत्म होने पर **Sign out** करें, खासकर shared laptop पर।

## 3. Dummy Lead का अभ्यास (5 मिनट)
यह अभी **सिर्फ़ उदाहरण** है: production में fake record Save **न करें** जब तक अलग training environment या cleanup प्रक्रिया तैयार न हो। **Manage leads → Add lead** में आगे चलकर यह काल्पनिक डेटा अभ्यास के लिए उपयोग करें:
- Name: Demo Business Owner
- Business: Demo Property Services
- Country: India
- Email: demo-owner@example.com
- Phone: खाली छोड़ें (यह केवल training है)
- Source: Training
- Status: New
अलग training/test environment मिलने पर ही **Save lead** दबाएँ; फिर **Leads** या **Search leads** से खोजने का अभ्यास करें।

## 4. Follow-up समझें
Lead खोलें → **Status** को Contacted/Qualified/Proposal sent जैसी सही स्थिति में बदलें → **Follow-up date** चुनें → **Save progress**। यह date **dashboard reminder** है; **automatic WhatsApp/email नहीं भेजती**। जो call/email वास्तव में किया हो, उसे **Contact history** में दर्ज करें।

## 5. Dashboard और Sales
**Follow-ups and sales → Refresh report** से due/overdue reminders, lead pipeline और दर्ज sales देखें। Sale record करने से पहले उस sale और invoice/reference की पुष्टि करें। Demo में वास्तविक sale न जोड़ें।

## 6. CSV Import और Export
- **Manage leads → Import CSV:** पहली row में Name column आवश्यक; optional Business, Country, Email, Phone, Source, Status. एक बार में अधिकतम 500 rows।
- **Export leads (CSV):** Admin-only feature **अभी development PR #25 में है, live main site पर नहीं**। Release होने के बाद अपने lead records Excel में export कर सकेंगे। Exported files private रखें।

## 7. Channel Inbox
Website Chatbot या Aarohi follow-up की enquiries को **Channel inbox** में देखा जा सकता है। आप **Mark reviewed** और **Save as lead** कर सकते हैं। WhatsApp से automatic inbound message तब तक अपेक्षित न रखें जब तक official Meta webhook verified न हो।

## 8. Campaigns, Appointments और Partners
**Start manual campaign** से internal manual work organize करें। किसी lead को campaign में **Enrol lead** करने पर CRM follow-up reminder बन सकता है, लेकिन बाहर message अपने आप नहीं जाता। **Book appointment** में India time का ध्यान रखें।
Partner account सिर्फ assigned leads देख सके; Admin सभी leads देखता है। Partner को Admin password न दें।

## 9. अभी Live नहीं — ग्राहक से वादा न करें
- Automatic outbound WhatsApp/email follow-up और delivery receipts
- हर customer के लिए अलग सुरक्षित tenant/onboarding flow
- Production backups/restore और end-to-end client pilot
- Exotel inbound phone calling
- New CSV export release, जब तक PR #25 merge और mobile test न हो

## 10. Owner practice exercise
- [ ] अपनी Admin screen पहचानना
- [ ] एक dummy lead जोड़ना
- [ ] lead search करना
- [ ] status और follow-up date बदलना
- [ ] due follow-ups dashboard में देखना
- [ ] contact history में एक dummy meeting note जोड़ना
- [ ] CSV import preview देखना (बिना अनावश्यक real data import किए)
- [ ] Admin logout करना

**Training completed** तभी मानें जब आप ऊपर के चरण खुद चला पाएँ। Practice के बाद काल्पनिक test lead हटाने/cleanup की अनुमति और सही प्रक्रिया देखें; उसे वास्तविक sales report में न रखें।

## 11. Customer demo का आसान 30-second explanation
"हमारा AAROHAN CRM सभी enquiries एक जगह दिखाता है। इसमें lead status, follow-up date, meeting history और sales dashboard मिलता है। WhatsApp और automatic follow-up integration को हम आपके business approval और final testing के बाद ही चालू करते हैं।"

**Engineering release checklist:** https://github.com/sumietrathod-cell/sumietrathod-cell.github.io/issues/24
