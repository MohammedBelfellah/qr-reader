let isSelecting = false;
let overlayCanvas = null;
let overlayCleanup = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSelection') {
        if (isSelecting) {
            sendResponse({ error: 'Selection already in progress' });
            return;
        }

        isSelecting = true;
        startAreaSelection();
        sendResponse({ success: true });
    }
});

function startAreaSelection() {
    const canvas = document.createElement('canvas');
    canvas.id = 'qr-selection-overlay';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2147483647;
        cursor: crosshair;
        pointer-events: auto;
        display: block;
    `;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    function cancelSelection() {
        chrome.runtime.sendMessage({ action: 'selectionCancelled' });
        cleanup();
    }

    // Draw semi-transparent overlay
    function redrawOverlay() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Semi-transparent dark background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Clear selected area
        if (isDrawing || (endX && endY)) {
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);

            ctx.clearRect(x, y, width, height);

            // Draw border for selection
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);

            // Draw corner markers
            const cornerSize = 12;
            ctx.fillStyle = '#00d4ff';
            // Top-left
            ctx.fillRect(x, y, cornerSize, 3);
            ctx.fillRect(x, y, 3, cornerSize);
            // Top-right
            ctx.fillRect(x + width - cornerSize, y, cornerSize, 3);
            ctx.fillRect(x + width - 3, y, 3, cornerSize);
            // Bottom-left
            ctx.fillRect(x, y + height - 3, cornerSize, 3);
            ctx.fillRect(x, y + height - cornerSize, 3, cornerSize);
            // Bottom-right
            ctx.fillRect(x + width - cornerSize, y + height - 3, cornerSize, 3);
            ctx.fillRect(x + width - 3, y + height - cornerSize, 3, cornerSize);
        }

        // Draw instructions
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Click and drag to select QR code area', canvas.width / 2, 30);
        ctx.fillText('Press ESC to cancel', canvas.width / 2, 55);
    }

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        startX = e.clientX;
        startY = e.clientY;
        endX = startX;
        endY = startY;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDrawing) {
            endX = e.clientX;
            endY = e.clientY;
            redrawOverlay();
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isDrawing) {
            isDrawing = false;
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);

            if (width > 20 && height > 20) {
                scanSelectedArea(startX, startY, endX, endY);
            } else {
                chrome.runtime.sendMessage({
                    action: 'qrNotFound',
                    message: 'Selection too small'
                });
                cleanup();
            }
        }
    });

    document.body.appendChild(canvas);
    redrawOverlay();

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            cancelSelection();
        }
    }

    window.addEventListener('keydown', onKeyDown, true);

    function cleanup() {
        window.removeEventListener('keydown', onKeyDown, true);
        canvas.remove();
        isSelecting = false;
        overlayCanvas = null;
        overlayCleanup = null;
    }

    overlayCanvas = canvas;
    overlayCleanup = cleanup;
}

async function scanSelectedArea(x1, y1, x2, y2) {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                resolve(result);
            });
        });

        if (!response || response.error || !response.dataUrl) {
            throw new Error((response && response.error) || 'Could not capture the visible tab');
        }

        const image = await loadImage(response.dataUrl);
        const scaleX = image.naturalWidth / window.innerWidth;
        const scaleY = image.naturalHeight / window.innerHeight;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = Math.max(1, Math.round(width * scaleX));
        cropCanvas.height = Math.max(1, Math.round(height * scaleY));

        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(
            image,
            Math.round(x * scaleX),
            Math.round(y * scaleY),
            cropCanvas.width,
            cropCanvas.height,
            0,
            0,
            cropCanvas.width,
            cropCanvas.height
        );

        const decodedValue = await decodeQrFromCanvas(cropCanvas, cropCtx);

        cleanupOverlay();

        if (decodedValue) {
            const url = decodedValue;
            if (isValidUrl(url)) {
                showPageToast('Success: URL saved. You can copy it now.');
                chrome.runtime.sendMessage({
                    action: 'qrFound',
                    url: url
                });
            } else {
                chrome.runtime.sendMessage({
                    action: 'qrNotFound',
                    message: 'QR code found, but it does not look like a URL'
                });
            }
        } else {
            chrome.runtime.sendMessage({
                action: 'qrNotFound',
                message: 'No QR code detected in the selected area'
            });
        }
    } catch (err) {
        console.error('Capture error:', err);
        cleanupOverlay();
        chrome.runtime.sendMessage({
            action: 'qrNotFound',
            message: err && err.message ? err.message : 'Error capturing screen area'
        });
    }
}

function cleanupOverlay() {
    if (overlayCleanup) {
        overlayCleanup();
        return;
    }

    const overlay = document.getElementById('qr-selection-overlay');
    if (overlay) {
        overlay.remove();
    }
    isSelecting = false;
    overlayCanvas = null;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not load captured image'));
        image.src = src;
    });
}

function isValidUrl(string) {
    // Check if it looks like a URL
    const urlPatterns = [
        /^https?:\/\//,           // http(s):// protocol
        /^www\./,                  // www. prefix
        /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/, // domain.tld
        /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\// // domain.tld/path
    ];

    return urlPatterns.some(pattern => pattern.test(string));
}

async function decodeQrFromCanvas(canvas, ctx) {
    if ('BarcodeDetector' in window) {
        try {
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            const codes = await detector.detect(canvas);
            if (codes && codes.length > 0 && codes[0].rawValue) {
                return codes[0].rawValue;
            }
        } catch (err) {
            console.warn('BarcodeDetector failed, falling back to jsQR', err);
        }
    }

    if (typeof window.jsQR === 'function') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
            return code.data;
        }
        return null;
    }

    throw new Error('QR scanner is unavailable. Reload the extension and try again.');
}

function showPageToast(message) {
    const existing = document.getElementById('qr-reader-toast');
    if (existing) {
        existing.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'qr-reader-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        background: #2ed573;
        color: #0f1d12;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-family: Arial, sans-serif;
        font-weight: 700;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2500);
}