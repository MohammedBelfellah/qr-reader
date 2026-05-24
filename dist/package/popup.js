let currentUrl = null;

document.addEventListener('DOMContentLoaded', () => {
    hydrateLastScanResult();
});

document.getElementById('startBtn').addEventListener('click', () => {
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
            startBtn.disabled = false;
            showStatus(chrome.runtime.lastError.message, 'error');
            return;
        }

        if (!tabs || !tabs[0] || !tabs[0].id) {
            startBtn.disabled = false;
            showStatus('No active tab found', 'error');
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, { action: 'startSelection' }, (response) => {
            startBtn.disabled = false;

            if (chrome.runtime.lastError) {
                showStatus(chrome.runtime.lastError.message, 'error');
                return;
            }

            if (response && response.success) {
                showStatus('QR code scanning started...', 'scanning');
                setTimeout(() => {
                    hideStatus();
                }, 2000);
            } else if (response && response.error) {
                showStatus(response.error, 'error');
            } else {
                showStatus('Could not start selection', 'error');
            }
        });
    });
});

document.getElementById('copyBtn').addEventListener('click', () => {
    copyCurrentUrl();
});

document.getElementById('openBtn').addEventListener('click', () => {
    if (currentUrl) {
        try {
            // Ensure URL has a protocol
            let urlToOpen = currentUrl;
            if (!urlToOpen.match(/^https?:\/\//)) {
                urlToOpen = 'https://' + urlToOpen;
            }
            chrome.tabs.create({ url: urlToOpen });
        } catch (e) {
            showStatus('Invalid URL format', 'error');
        }
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'qrFound') {
        currentUrl = request.url;
        document.getElementById('urlResult').textContent = request.url;
        document.getElementById('resultContainer').classList.add('show');
        copyCurrentUrl(true);
        setTimeout(() => {
            hideStatus();
        }, 2000);
    } else if (request.action === 'qrNotFound') {
        showStatus('No QR code detected in selected area', 'error');
    } else if (request.action === 'selectionCancelled') {
        showStatus('Selection cancelled', 'error');
    }
});

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status show ' + type;
}

function hideStatus() {
    const status = document.getElementById('status');
    status.classList.remove('show');
}

function copyCurrentUrl(autoCopy = false) {
    if (!currentUrl) {
        return;
    }

    navigator.clipboard.writeText(currentUrl).then(() => {
        const copyBtn = document.getElementById('copyBtn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        showStatus(autoCopy ? 'QR code detected and copied to clipboard' : 'Copied to clipboard', 'success');
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    }).catch(() => {
        showStatus('QR code detected! Copy button is available if needed', 'success');
    });
}

function hydrateLastScanResult() {
    chrome.runtime.sendMessage({ action: 'getLastScanResult' }, (response) => {
        if (chrome.runtime.lastError || !response || response.error || !response.success) {
            return;
        }

        const last = response.data;
        if (!last) {
            return;
        }

        if (last.action === 'qrFound' && last.url) {
            currentUrl = last.url;
            document.getElementById('urlResult').textContent = last.url;
            document.getElementById('resultContainer').classList.add('show');
            showStatus('Last QR result is ready to copy', 'success');
            return;
        }

        if (last.action === 'qrNotFound') {
            showStatus(last.message || 'No QR code detected in selected area', 'error');
            return;
        }

        if (last.action === 'selectionCancelled') {
            showStatus('Selection cancelled', 'error');
        }
    });
}