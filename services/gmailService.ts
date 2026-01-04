import { initGoogleDrive, getIsSignedIn, signInToGoogle } from './googleDriveService';

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

    const requestBody: any = {
        'userId': 'me',
        'resource': {
            'raw': encodedMessage
        }
    };

    if (threadId) {
        requestBody.resource.threadId = threadId;
    }

    await gapi.client.gmail.users.messages.send(requestBody);
};

export const listGmailThreads = async (query: string = '', maxResults: number = 10) => {
    await ensureAuth();

    const response = await gapi.client.gmail.users.threads.list({
        'userId': 'me',
        'q': query,
        'maxResults': maxResults
    });

    return response.result.threads || [];
};

export const getGmailThread = async (threadId: string) => {
    await ensureAuth();

    const response = await gapi.client.gmail.users.threads.get({
        'userId': 'me',
        'id': threadId,
        'format': 'full' // Get full content to display headers/body
    });

    return response.result;
};

export const getGmailSignature = async (): Promise<string> => {
    await ensureAuth();
    try {
        const response = await gapi.client.gmail.users.settings.sendAs.list({
            'userId': 'me'
        });
        const aliases = response.result.sendAs || [];
        // Find primary or first alias with a signature
        const primary = aliases.find((a: any) => a.isPrimary) || aliases[0];
        return primary ? primary.signature : '';
    } catch (e) {
        console.error("Failed to fetch signature", e);
        return '';
    }
};
