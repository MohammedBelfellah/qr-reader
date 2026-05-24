// Service worker for the extension
// This keeps the extension running in the background

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('QR Code Reader extension installed!');
    } else if (details.reason === 'update') {
        console.log('QR Code Reader extension updated!');
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureVisibleTab') {
        chrome.tabs.captureVisibleTab(undefined, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            if (!dataUrl) {
                sendResponse({ error: 'Could not capture the visible tab' });
                return;
            }

            sendResponse({ success: true, dataUrl });
        });

        return true;
    }

    if (request.action === 'qrFound') {
        chrome.storage.local.set({
            lastScanResult: {
                action: 'qrFound',
                url: request.url,
                timestamp: Date.now()
            }
        });
        return;
    }

    if (request.action === 'qrNotFound' || request.action === 'selectionCancelled') {
        chrome.storage.local.set({
            lastScanResult: {
                action: request.action,
                message: request.message || null,
                timestamp: Date.now()
            }
        });
        return;
    }

    if (request.action === 'getLastScanResult') {
        chrome.storage.local.get('lastScanResult', (result) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            sendResponse({ success: true, data: result.lastScanResult || null });
        });

        return true;
    }

    return;
});