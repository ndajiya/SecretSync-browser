import {
  getWalletDerivedAESKey,
  encryptDataAES,
  getDelegatedDecryptionToken
} from './utils/crypto.js';

console.log("Start Export button clicked");
document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const initialScreen = document.getElementById('initial-screen');
  const processingScreen = document.getElementById('processing-screen');
  const exportScreen = document.getElementById('export-screen');
  const errorScreen = document.getElementById('error-screen');
  
  const startExportButton = document.getElementById('start-export');
  const downloadExportButton = document.getElementById('download-export');
  const retryButton = document.getElementById('retry-button');
  
  const progressBar = document.getElementById('progress-bar');
  const errorMessage = document.getElementById('error-message');
  
  const domainCount = document.getElementById('domain-count');
  const fileSize = document.getElementById('file-size');
  const exportDate = document.getElementById('export-date');

  // Store processed history data
  let processedHistoryData = null;
  let encryptedHistoryData = null;

  // Show a specific screen
  function showScreen(screen) {
    initialScreen.classList.remove('active');
    processingScreen.classList.remove('active');
    exportScreen.classList.remove('active');
    errorScreen.classList.remove('active');
    screen.classList.add('active');
  }

  // Simulate progress animation
  function simulateProgress(callback, duration = 2000) {
    let progress = 0;
    const interval = 20;
    const step = 100 / (duration / interval);
    progressBar.style.width = '0%';

    const progressInterval = setInterval(() => {
      progress += step;
      if (progress >= 100) {
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        setTimeout(callback, 200);
      } else {
        progressBar.style.width = `${progress}%`;
      }
    }, interval);
  }
console.log("Export function reached", { data });

  // Format bytes to human-readable size
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // 🟡 Delegated & Wallet-derived Encryption Upload
  async function uploadToServer(historyData) {
    try {
      const aesKey = await getWalletDerivedAESKey();
      const { encrypted, iv } = await encryptDataAES(historyData, aesKey);
      const [userAddress] = await ethereum.request({ method: 'eth_requestAccounts' });

      const payload = {
        user_address: userAddress,
        iv,
        payload: encrypted,
        extension_version: '2.0.0',
        timestamp: new Date().toISOString()
      };

      const serverAccessCheckbox = document.getElementById('enable-server-access');
      if (serverAccessCheckbox && serverAccessCheckbox.checked) {
        const token = await getDelegatedDecryptionToken();
        payload.decryption_token = token;
      }

      const res = await fetch('https://your-api.com/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Upload failed.');
      console.log("Encrypted history uploaded successfully.");
    } catch (err) {
      console.error("Upload error:", err);
    }
  }

  // Start export
  startExportButton.addEventListener('click', function() {
    showScreen(processingScreen);
    chrome.runtime.sendMessage({ action: 'processHistory' }, function(response) {
      simulateProgress(() => {
        if (response && response.success) {
          processedHistoryData = response.data;
          processEncryption();
        } else {
          errorMessage.textContent = response?.error || 'Unknown error occurred.';
          showScreen(errorScreen);
        }
      });
    });
  });

  // Process encryption
  function processEncryption() {
    getFromIndexedDB('historyData', 'latestExport')
      .then(historyData => {
        if (!historyData) {
          throw new Error('No history data found. Please try exporting again.');
        }

        historyData.exportId = 'bd_export_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);

        chrome.runtime.sendMessage({ 
          action: 'encryptData', 
          data: historyData
        }, async function(response) {
          if (response && response.success) {
            encryptedHistoryData = response.encryptedData;

            const jsonData = JSON.stringify(historyData);
            const encryptedDataSize = JSON.stringify(encryptedHistoryData).length;

            domainCount.textContent = historyData.domains.length;
            fileSize.textContent = formatBytes(encryptedDataSize);
            exportDate.textContent = new Date().toLocaleDateString();

            if (document.getElementById('encryption-method')) {
              document.getElementById('encryption-method').textContent = 
                encryptedHistoryData.encryptionMethod || 'RSA-OAEP + AES-GCM (Asymmetric)';
            }

            // 🔐 Upload to server using wallet-derived AES
            await uploadToServer(historyData);

            showScreen(exportScreen);
          } else {
            errorMessage.textContent = response?.error || 'Failed to encrypt data.';
            showScreen(errorScreen);
          }
        });
      })
      .catch(error => {
        console.error('Encryption error:', error);
        errorMessage.textContent = error.message || 'Failed to encrypt data.';
        showScreen(errorScreen);
      });
  }

  // Download encrypted history
  downloadExportButton.addEventListener('click', function() {
    if (!encryptedHistoryData) {
      errorMessage.textContent = 'No encrypted data available.';
      showScreen(errorScreen);
      return;
    }

    const downloadData = {
      format: 'browser_export',
      version: '2.0',
      timestamp: Date.now(),
      encryptionMethod: encryptedHistoryData.encryptionMethod || 'hybrid-rsa-aes',
      data: encryptedHistoryData
    };

    const jsonString = JSON.stringify(downloadData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `browser_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });

  // Retry
  retryButton.addEventListener('click', function() {
    showScreen(initialScreen);
  });

  // IndexedDB helper
  async function getFromIndexedDB(storeName, key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('browserHistoryExport', 1);

      request.onerror = event => {
        reject(`IndexedDB error: ${event.target.errorCode}`);
      };

      request.onsuccess = event => {
        const db = event.target.result;
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const getRequest = store.get(key);

        getRequest.onsuccess = () => {
          resolve(getRequest.result);
        };

        getRequest.onerror = event => {
          reject(`Error retrieving data from IndexedDB: ${event.target.errorCode}`);
        };
      };
    });
  }
});
