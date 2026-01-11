import { initGoogleDrive, getIsSignedIn, signInToGoogle, fetchGoogleApi } from './googleDriveService';

// We rely on the global 'gapi' loaded via script tag in index.html for stability
declare var gapi: any;

const ensureAuth = async () => {
    await initGoogleDrive();
    if (!await getIsSignedIn()) {
        await signInToGoogle();
    }
};

export const sendGmail = async (to: string, subject: string, htmlBody: string, threadId?: string) => {
    await ensureAuth();

    // Construct MIME message
    const utf8Subject = `=?utf-8?B?${btoa(subject)}?=`;
    const messageParts = [
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        "Content-Type: text/html; charset=utf-8",
        "MIME-Version: 1.0",
        "",
        htmlBody
    ];
    const message = messageParts.join("\n");

    // Base64URL encode
    const encodedMessage = btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await fetchGoogleApi('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            'threadId': threadId,
            'raw': encodedMessage
        })
    });
};

export const listGmailThreads = async (query: string = '', maxResults: number = 10) => {
    await ensureAuth();

    const queryParams = new URLSearchParams({
        q: query,
        maxResults: maxResults.toString()
    });
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?${queryParams.toString()}`;
    const response = await fetchGoogleApi(url);

    return response.threads || [];
};

export const getGmailThread = async (threadId: string) => {
    await ensureAuth();

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`;
    return await fetchGoogleApi(url);
};

export const getGmailSignature = async (): Promise<string> => {
    await ensureAuth();
    try {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs`;
        const response = await fetchGoogleApi(url);
        const aliases = response.sendAs || [];
        // Find primary or first alias with a signature
        const primary = aliases.find((a: any) => a.isPrimary) || aliases[0];
        return primary ? primary.signature : '';
    } catch (e) {
        console.error("Failed to fetch signature", e);
        return '';
    }
};
