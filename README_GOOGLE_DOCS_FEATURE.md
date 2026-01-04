# Experimental Google Docs Generation Feature

This project now supports **Direct Google Docs Generation** as an experimental feature. This allows you to generate a professional Quotation/Itinerary directly into your Google Drive instead of downloading a DOCX file.

## 🚀 How to Use the Feature
1. **Open a Lead** in the application.
2. Go to the **Preview & Edit** tab.
3. Look for the toggle switch labeled **"Exp. G-Docs"** near the "Download .docx" button.
4. **Enable the Toggle**. The button will change to **"Gen Google Doc"**.
5. Click **"Gen Google Doc"**.
   - You may be asked to sign in to your Google Account (via a popup) if it's your first time.
   - You must grant permission for the app to create files in your Drive.
6. Once the process is complete, a link saying **"Last Generated Doc ↗"** will appear. Click it to open your new Google Doc!

---

## 🛠️ Setup Guide for Developers (Google Cloud Config)

To make this feature work, you must configure a Google Cloud Project and get your API Credentials.

### Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** (top left) > **New Project**.
3. Name it (e.g., "Travel Quote Gen") and click **Create**.

### Step 2: Enable APIs
1. In your new project, go to **APIs & Services** > **Library**.
2. Search for **"Google Drive API"**.
3. Click it and click **Enable**.

### Step 3: Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (unless you are a Google Workspace user and want it internal). Click **Create**.
3. Fill in the **App Name** (e.g., "Quote Generator"), **User Support Email**, and **Developer Contact Email**.
4. Click **Save and Continue**.
5. **Scopes**: Click "Add or Remove Scopes". Select:
   - `.../auth/drive.file` (See, edit, create, and delete only the specific Google Drive files you use with this app)
   - `.../auth/gmail.send` (If you use the email feature)
   - `.../auth/gmail.readonly` (If you use the email feature)
   - Click **Update** and then **Save and Continue**.
6. **Test Users**: Click "Add Users" and enter the Gmail addresses that will use this app (e.g., your email). **Crucial for testing**.
7. Click **Save and Continue** > **Back to Dashboard**.

### Step 4: Create Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Application Type: **Web application**.
4. Name: "React App Client".
5. **Authorized JavaScript origins**:
   - Add `http://localhost:5173` (or whatever port you run locally).
   - Add your production URL if applicable.
6. **Authorized redirect URIs**:
   - Add `http://localhost:5173` (and production URL).
7. Click **Create**.
8. **Copy the Client ID** (e.g., `123456...apps.googleusercontent.com`).

9. Click **Create Credentials** > **API Key**.
10. **Copy the API Key** (starts with `AIza...`).
11. **Restrict the Key** (Highly Recommended):
    - Click on the created API Key name.
    - Under **API restrictions**, select **Restrict key**.
    - Select **Google Drive API** (and Gmail API if used).
    - Click **Save**.

### Step 5: Update Application Code
1. Open the file `services/googleDriveService.ts` in your code editor.
2. Locate the lines at the top:
   ```typescript
   const CLIENT_ID = 'YOUR_NEW_CLIENT_ID_HERE';
   const API_KEY = 'YOUR_NEW_API_KEY_HERE';
   ```
3. Replace the placeholder strings with the **Client ID** and **API Key** you just created.

---

## ⚠️ Troubleshooting & FAQ

**Q: The popup closes immediately or says "Popup closed by user".**
A: Ensure your browser is not blocking popups. Check the address bar for a blocked popup icon.

**Q: Error "idpiframe_initialization_failed".**
A: This usually happens if "Authorized JavaScript origins" in Google Cloud Console doesn't match your current URL (e.g., running on `localhost:3000` but configured `localhost:5173`). Double-check the port. Also, creating a new Client ID often helps if cookies are causing issues.

**Q: "Access blocked: This app’s request is invalid" (Error 400).**
A: Ensure your `CLIENT_ID` is correct and you are accessing the app from an Authorized Origin.

**Q: The generated document looks different from the preview.**
A: The feature uses an HTML-to-Doc conversion. While we try to match styles using CSS, Google Docs has some limitations on CSS support. The content should be correct, but complex layouts might simplify.

**Q: I don't see the document in my Drive.**
A: The feature creates a folder named **"TripFlow Quotations"** in your Root Drive, and a subfolder for the Client. Check there.

## 🧪 Testing Plan
1. **Initial Test**: Run the app locally. Create a dummy lead. Enable the toggle and click Generate.
2. **Verify Auth**: confirm the Google Sign-In popup appears and asks for `drive.file` permission.
3. **Verify Output**: Click the generated link. Ensure the Google Doc opens and contains the correct destination, itinerary, and financial table.
4. **Mobile Test**: Try generating from a mobile browser (if deployed) to ensure the popup flow works on mobile.
5. **Feedback Loop**: Provide a simple form or email link (`support@example.com`) for users to screenshots of any formatting issues.
