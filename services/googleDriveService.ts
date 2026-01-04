
// We rely on the global 'gapi' and 'google' loaded via script tags
declare var gapi: any;
declare var google: any;

// ⚠️ PROJECT CREDENTIALS ⚠️
const CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = (import.meta as any).env.VITE_GOOGLE_API_KEY;

// Combined Scopes for Drive and Gmail
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.settings.basic';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Initialize GAPI Client (only to use it as a token container)
const initGapiClient = async () => {
    return new Promise<void>((resolve, reject) => {
        if (gapiInited) return resolve();
        gapi.load('client', () => {
            gapiInited = true;
            resolve();
        });
    });
};

// Initialize Google Identity Services (GIS) Token Client (for Auth)
const initGisClient = () => {
    return new Promise<void>((resolve, reject) => {
        try {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (tokenResponse: any) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        // Keep gapi.client up to date with the valid token
                        // This is crucial!
                        if (typeof gapi !== 'undefined') {
                            gapi.client.setToken(tokenResponse);
                        }
                    }
                },
            });
            gisInited = true;
            resolve();
        } catch (err) {
            console.error("GIS Init Error:", err);
            reject(err);
        }
    });
};

export const initGoogleDrive = async () => {
    try {
        // Wait for scripts to load if they haven't yet
        if (typeof gapi === 'undefined' || typeof google === 'undefined') {
            // A rudimentary wait loop if scripts render lazily
            await new Promise(r => setTimeout(r, 1000));
        }

        const promises = [];
        if (!gapiInited) promises.push(initGapiClient());
        if (!gisInited) promises.push(initGisClient());

        await Promise.all(promises);
        console.log("✅ Google API & GIS Initialized Successfully");
    } catch (error) {
        console.error("Initialization Failed", error);
        throw error;
    }
};

export const signInToGoogle = async () => {
    await initGoogleDrive();

    return new Promise((resolve, reject) => {
        try {
            // Override the callback for this specific request to capture when it's done
            tokenClient.callback = async (resp: any) => {
                if (resp.error !== undefined) {
                    reject(resp);
                }
                // Determine user email if possible (not directly provided by access token response)
                // We'll fetch it via detailed query if needed, but for now just resolving success

                if (typeof gapi !== 'undefined') {
                    gapi.client.setToken(resp);
                }
                resolve(resp);
            };

            // Trigger the Money Shot (Popup)
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (e) {
            reject(e);
        }
    });
};

// --- Check Auth Status ---
export const getIsSignedIn = async (): Promise<boolean> => {
    // Safety check: if gapi or gapi.client is not loaded, we aren't signed in.
    if (typeof gapi !== 'undefined' && gapi.client && typeof gapi.client.getToken === 'function') {
        const token = gapi.client.getToken();
        return token !== null && token.access_token !== undefined;
    }
    return false;
};

// Helper to ensure we are ready before making calls
const ensureClientReady = async () => {
    if (!gapiInited || !gisInited) await initGoogleDrive();
    if (!gapi.client.getToken()) {
        throw new Error("User not signed in. Please click Sign In.");
    }
}

// Global helper for fetch-based Google API calls to avoid brittle XD3 transport
const fetchGoogleApi = async (url: string, options: RequestInit = {}) => {
    await ensureClientReady();
    const token = gapi.client.getToken().access_token;
    
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
        let errorMsg = `API Error: ${response.status}`;
        try {
            const errJson = await response.json();
            errorMsg = errJson.error?.message || JSON.stringify(errJson);
        } catch (e) {}
        throw new Error(errorMsg);
    }
    
    return response.json();
};

export const getUserEmail = async (): Promise<string | null> => {
    try {
        if (await getIsSignedIn()) {
            const data = await fetchGoogleApi('https://gmail.googleapis.com/gmail/v1/users/me/profile');
            return data.emailAddress;
        }
    } catch (e) {
        console.warn("Could not fetch user email", e);
    }
    return null;
};

// --- Service Functions (Drive) ---

export const findFolder = async (folderName: string, parentId: string = 'root') => {
    try {
        const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`);
        const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id, name)&spaces=drive`;
        const data = await fetchGoogleApi(url);
        return data.files?.[0] || null;
    } catch (e) {
        console.error("Error finding folder:", e);
        throw e;
    }
};

export const createFolder = async (folderName: string, parentId: string = 'root') => {
    try {
        const url = 'https://www.googleapis.com/drive/v3/files?fields=id';
        const body = JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        });
        return await fetchGoogleApi(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
    } catch (e) {
        console.error("Error creating folder:", e);
        throw e;
    }
};

export const ensureFolderStructure = async (clientName: string, destinationName: string = "Uncategorized") => {
    let rootFolder = await findFolder("TripFlow Quotations");
    if (!rootFolder) {
        rootFolder = await createFolder("TripFlow Quotations");
    }

    const safeDestination = destinationName.trim() || "Uncategorized";

    // 1. Check/Create Destination Folder
    let destFolder = await findFolder(safeDestination, rootFolder.id);
    if (!destFolder) {
        destFolder = await createFolder(safeDestination, rootFolder.id);
    }

    // 2. Check/Create Client Folder INSIDE Destination Folder
    let clientFolder = await findFolder(clientName, destFolder.id);
    if (!clientFolder) {
        clientFolder = await createFolder(clientName, destFolder.id);
    }

    return clientFolder.id;
};

export const uploadFileToDrive = async (folderId: string, fileBlob: Blob, fileName: string) => {
    await ensureClientReady();
    const token = gapi.client.getToken().access_token;

    const metadata = {
        name: fileName,
        parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + token }),
        body: form,
    });

    if (!response.ok) {
        let errorMessage = `Upload failed: ${response.status}`;
        try {
            const errJson = await response.json();
            errorMessage = errJson.error?.message || JSON.stringify(errJson);
        } catch (e) {}
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        throw error;
    }

    return await response.json();
};

export const listFiles = async (folderId: string) => {
    try {
        const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
        const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id, name, webViewLink, iconLink, createdTime, mimeType)&orderBy=createdTime desc&pageSize=20`;
        const data = await fetchGoogleApi(url);
        return data.files || [];
    } catch (e) {
        console.error("Error listing files:", e);
        return [];
    }
};

export const createGoogleDocFromHtml = async (folderId: string, htmlContent: string, fileName: string) => {
    await ensureClientReady();
    const token = gapi.client.getToken().access_token;

    const metadata = {
        name: fileName,
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([htmlContent], { type: 'text/html' }));

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + token }),
        body: form,
    });

    if (!response.ok) {
        let errorMsg = `Google Doc Creation failed: ${response.status}`;
        try {
            const errJson = await response.json();
            errorMsg = errJson.error?.message || JSON.stringify(errJson);
        } catch (e) {}
        throw new Error(errorMsg);
    }

    return await response.json();
};

export const getSafeAuthInstance = async () => {
    await ensureClientReady();
    return {
        isSignedIn: { get: () => true },
        signIn: () => Promise.resolve(),
        currentUser: { get: () => ({ getBasicProfile: () => ({ getEmail: () => "user@example.com" }) }) }
    };
}