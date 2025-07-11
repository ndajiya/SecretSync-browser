import {
  getWalletDerivedAESKey,
  encryptDataAES,
  getDelegatedDecryptionToken
} from './utils/crypto.js';

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
    // Hide all screens
    initialScreen.classList.remove('active');
    processingScreen.classList.remove('active');
    exportScreen.classList.remove('active');
    errorScreen.classList.remove('active');
    
    // Show requested screen
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
        
        // Small delay before callback for smoother transition
        setTimeout(callback, 200);
      } else {
        progressBar.style.width = `${progress}%`;
      }
    }, interval);
  }
  
  // Format bytes to human-readable size
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  // Start history export process
  startExportButton.addEventListener('click', function() {
    showScreen(processingScreen);
    
    // Send a message to the background script to process history
    chrome.runtime.sendMessage({ action: 'processHistory' }, function(response) {
      simulateProgress(() => {
        if (response && response.success) {
          processedHistoryData = response.data;
          // After processing history, proceed to encrypt it
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
    // Retrieve the latest history data from IndexedDB
    getFromIndexedDB('historyData', 'latestExport')
      .then(historyData => {
        if (!historyData) {
          throw new Error('No history data found. Please try exporting again.');
        }
        
        // Add a unique identifier to the data for verification during upload
        historyData.exportId = 'bd_export_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        
        // Send message to background script to encrypt the data
        chrome.runtime.sendMessage({ 
          action: 'encryptData', 
          data: historyData
        }, function(response) {
          if (response && response.success) {
            encryptedHistoryData = response.encryptedData;
            
            // Update export info
            const jsonData = JSON.stringify(historyData);
            const encryptedDataSize = JSON.stringify(encryptedHistoryData).length;
            
            domainCount.textContent = historyData.domains.length;
            fileSize.textContent = formatBytes(encryptedDataSize);
            exportDate.textContent = new Date().toLocaleDateString();
            
            // Add encryption method info
            if (document.getElementById('encryption-method')) {
              document.getElementById('encryption-method').textContent = 
                encryptedHistoryData.encryptionMethod || 'RSA-OAEP + AES-GCM (Asymmetric)';
            }
            
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
    
    // Prepare data for download
    const downloadData = {
      format: 'browser_export',
      version: '2.0',
      timestamp: Date.now(),
      encryptionMethod: encryptedHistoryData.encryptionMethod || 'hybrid-rsa-aes',
      data: encryptedHistoryData
    };
    
    // Log for debugging
    console.log('Preparing download with data structure:', downloadData);
    console.log('Encryption data properties:', Object.keys(downloadData.data).join(', '));
    
    // Convert to JSON string
    const jsonString = JSON.stringify(downloadData);
    
    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `browser_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });
  
  // Retry button handler
  retryButton.addEventListener('click', function() {
    showScreen(initialScreen);
  });
  
  // Get data from IndexedDB
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
