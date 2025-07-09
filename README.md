# Browser Dating History Export Extension

This Chrome extension allows users to export their browser history in an encrypted format for use with the Browser Dating website.

## Features

- Processes browser history locally on your device
- Formats your history data in a secure, standardized format
- Includes both domain names and full URLs for better matching
- Exclusively uses asymmetric encryption for maximum security
- Simple intuitive interface
- No automatic uploads - you control when and how your data is shared

## How It Works

1. The extension analyzes your browser history to identify frequently visited domains and URLs
2. It formats the data in a standardized secure format
3. The data is encrypted using asymmetric cryptography (RSA-OAEP & AES-GCM)
4. The encrypted data is saved as a JSON file
5. You upload the file on the Browser Dating website
6. Browser Dating decrypts the data using a private key (only available on the server)
7. Browser Dating processes the domains and URLs to find potential matches

## Privacy & Security

- All processing happens locally on your device
- Both domain names and full URLs are stored (with visit frequency)
- Each domain entry includes up to 10 individual page visits
- Asymmetric encryption (RSA-OAEP) ensures only the Browser Dating server can decrypt your data
- The extension only contains a public key for encryption
- The private key for decryption is securely stored on the server
- No data is uploaded to any server until you explicitly choose to upload it

## Important Version Information

This extension uses version 2.0 of the Browser Dating export format with asymmetric encryption. Earlier versions using symmetric encryption are no longer supported.

## Installation

1. Download the extension files
2. Go to chrome://extensions in your Chrome browser
3. Enable "Developer mode" at the top right
4. Click "Load unpacked" and select the extension folder
5. The extension is now installed and available in your browser toolbar

## Usage

1. Click the extension icon in your browser toolbar
2. Click "Start Export Process"
3. When processing is complete, download the history file
4. Upload the file on the Browser Dating website

## Technical Details

This extension uses a hybrid encryption approach:
1. Your browser history is encrypted with a random AES-256 key (symmetric encryption)
2. The AES key is encrypted with RSA-OAEP using the Browser Dating public key
3. Only the Browser Dating server with the private key can decrypt the AES key
4. Once decrypted, the AES key is used to decrypt your history data

## Support

For help or questions about this extension, please contact us at just@freuddit.com
