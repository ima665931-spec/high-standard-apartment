# High Standard Apartment — Updated Site Setup

## Files to push to GitHub
- `index.html` — homepage (trust fixes + listings)
- `booking.html` — **3-step booking** (Details → QR → UTR)
- `Code.gs` — Google Apps Script (email to you + Confirm / Not Confirm buttons)

## 1. Deploy Apps Script (IMPORTANT)

1. Login to Google with **ima665931@gmail.com**
2. Open https://script.google.com → **New project**
3. Delete default code, paste entire `Code.gs`
4. (Optional but recommended) Create a Google Sheet, then in script:
   - **Extensions is not needed** — just bind sheet:
   - File → Project settings → under "Google Cloud Platform" skip
   - Or: open the Sheet → Extensions → Apps Script and paste there (easier)
5. In Code.gs top:
   - `OWNER_EMAIL` already set to ima665931@gmail.com
   - Change `TOKEN_SECRET` to any random string
6. **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy the **Web App URL**

## 2. Paste URL in both HTML files

In `booking.html` and `index.html` find:

```js
const PANEL_URL = "https://script.google.com/macros/s/...";
```

Replace with your **new** Web App URL.

## 3. Listings (you manage via Sheet)

In the same Google Sheet, create a tab named **Listings** with headers:

| id | area | bhk | title | size | furnish | rent | deposit | img |
|----|------|-----|-------|------|---------|------|---------|-----|

- `img` = public photo URL (not Google Drive private link)
- After deploy, homepage loads listings from this sheet
- Fallback 16 flats still show if sheet empty

## 4. How booking email works

1. User fills Step 1 (details, **email required**)
2. Step 2 shows UPI QR
3. Step 3 enters UTR → Submit
4. You get email at **ima665931@gmail.com** with full details + UTR
5. Email has two buttons:
   - **Visit Confirmed** → user gets: "Your visit is confirmed. Our Agent will reach you soon."
   - **Visit Not Confirmed** → user gets: "Your visiting fee was due."
6. Status saved in **Bookings** sheet

## Security note

**Do NOT put Gmail App Password in website code.**  
Anyone can view HTML source and steal it.  
Apps Script uses `GmailApp` while logged in as you — no password needed in code.

If you already shared the app password publicly, **revoke it** now:  
Google Account → Security → App passwords → delete the one you shared.

## Phone / WhatsApp

In `index.html` contact section, replace dummy numbers:

```
+91 99999 99999
```

with your real number.
