# QR Code Reader Chrome Extension

A Chrome extension that lets you select any area on your screen to scan QR codes and extract URLs.

## Features

- Area selection like Google Lens
- QR code scanning with a bundled offline decoder
- URL extraction and validation
- Copy and open actions
- Success toast shown directly on the page
- Saved result available again when the popup opens

## Install and Use

This project is not public in the Chrome Web Store yet, so use the unpacked extension version first.

### Install the extension

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on Developer mode in the top-right corner.
3. Click Load unpacked.
4. Select the project folder: `qr-reader`.
5. Pin the extension icon to the toolbar if you want quick access.

### Use the extension

1. Open the web page that contains the QR code.
2. Click the QR Code Reader icon in the Chrome toolbar.
3. Click Start Scanning.
4. The popup closes so you can see the full page.
5. Drag to select the QR code area.
6. Wait for the success message to appear on the page.
7. Open the popup again to see the saved URL.
8. Click Copy URL if you want to copy it, or Open Link to open it in a new tab.

## How to Use

1. Click the extension icon in your Chrome toolbar.
2. Click Start Scanning in the popup.
3. The popup closes so you can see the full page.
4. Drag to select the QR code area.
5. If a valid QR code is found, the URL is saved and you can copy it.

## Screenshots

### Popup with saved URL

![Popup showing saved URL](screen_shorts/first%20ui.jpeg)

### QR selection on a webpage

![QR code selection on the webpage](screen_shorts/in%20the%20caption.png)

### Success message on the page

![Success toast shown on the webpage](screen_shorts/success%20msg.png)

## What It Detects

- HTTP and HTTPS URLs
- URLs starting with `www.`
- Domain names like `example.com`
- URLs with paths like `example.com/page`

## Files Included

- manifest.json
- background.js
- content.js
- popup.html
- popup.js
- icon16.png
- icon32.png
- icon48.png
- icon128.png
- vendor/jsQR.js

## Privacy

- Scanning happens locally in the browser
- No data is sent to a server
- No cookies, tracking, or analytics

## License

Free to use and modify for personal use.
