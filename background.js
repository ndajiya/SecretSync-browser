// Background script for Browser History Export

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Browser Dating History Export extension installed');
  
  // Initialize IndexedDB for storing history data
  initializeIndexedDB();
});

// Initialize IndexedDB
function initializeIndexedDB() {
  const request = indexedDB.open('browserHistoryExport', 1);
  
  request.onupgradeneeded = function(event) {
    const db = event.target.result;
    
    // Create object store if it doesn't exist
    if (!db.objectStoreNames.contains('historyData')) {
      db.createObjectStore('historyData');
    }
  };
  
  request.onerror = function(event) {
    console.error('IndexedDB error:', event.target.errorCode);
  };
  
  request.onsuccess = function(event) {
    console.log('IndexedDB initialized successfully');
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processHistory') {
    fetchAndProcessHistory()
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Error processing history:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates that we want to send a response asynchronously
  }
  
  // Handle encryption requests
  if (request.action === 'encryptData') {
    if (!request.data) {
      sendResponse({ success: false, error: 'Missing data for encryption' });
      return true;
    }
    
    encryptData(request.data)
      .then(encryptedData => {
        sendResponse({ success: true, encryptedData: encryptedData });
      })
      .catch(error => {
        console.error('Encryption error:', error);
        sendResponse({ success: false, error: error.message || 'Failed to encrypt data' });
      });
    return true; // Indicates that we want to send a response asynchronously
  }
});

// Fetch and process browser history
async function fetchAndProcessHistory() {
  try {
    // Fetch history from browser
    const historyItems = await chrome.history.search({
      text: '',           // Empty string means "all history"
      startTime: 0,       // Beginning of time
      maxResults: 5000    // Get a significant amount of history
    });
    
    // Process history items
    const processedHistory = await processHistoryItems(historyItems);
    
    // Store in IndexedDB
    await storeInIndexedDB('historyData', 'latestExport', processedHistory);
    
    return {
      timestamp: new Date().toISOString(),
      recordCount: processedHistory.domains.length
    };
  } catch (error) {
    console.error('Error fetching history:', error);
    throw error;
  }
}

// Process history items to extract and organize domain data
async function processHistoryItems(historyItems) {
  const domainMap = new Map();
  
  // Process each history item
  for (const item of historyItems) {
    try {
      // Skip items without URLs
      if (!item.url) continue;
      
      // Extract domain from URL (to use as the key for grouping)
      const domain = extractDomain(item.url);
      
      // Skip empty domains or IPs
      if (!domain || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) continue;
      
      // Record or update domain info
      if (domainMap.has(domain)) {
        const domainInfo = domainMap.get(domain);
        domainInfo.frequency += 1;
        
        // Update last visit if this visit is more recent
        const visitTime = new Date(item.lastVisitTime).getTime();
        if (visitTime > domainInfo.lastVisit) {
          domainInfo.lastVisit = visitTime;
          // Store the full URL of the most recent visit
          domainInfo.fullUrl = item.url;
        }
        
        // Add this URL to the visits array if we're not storing too many already
        if (domainInfo.visits && domainInfo.visits.length < 10) {
          domainInfo.visits.push({
            url: item.url,
            visitTime: new Date(item.lastVisitTime).getTime(),
            title: item.title || ''
          });
        }
      } else {
        domainMap.set(domain, {
          domain: domain,
          frequency: 1,
          lastVisit: new Date(item.lastVisitTime).getTime(),
          fullUrl: item.url, // Store full URL
          visits: [{
            url: item.url, 
            visitTime: new Date(item.lastVisitTime).getTime(),
            title: item.title || ''
          }]
        });
      }
    } catch (error) {
      console.error(`Error processing history item ${item.url}:`, error);
      // Continue with next item
    }
  }
  
  // Convert map to array of domain objects
  const domains = Array.from(domainMap.values())
    .sort((a, b) => b.frequency - a.frequency); // Sort by frequency, most visited first
  
  return {
    domains: domains,
    exportTimestamp: Date.now(),
    version: '1.0'
  };
}

// Extract domain from URL
function extractDomain(url) {
  try {
    // Use URL API to parse URL
    const urlObj = new URL(url);
    
    // Get hostname and remove 'www.' if present
    let domain = urlObj.hostname;
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    return domain;
  } catch (error) {
    console.error('Error extracting domain:', error);
    return null;
  }
}

// Store data in IndexedDB
async function storeInIndexedDB(storeName, key, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('browserHistoryExport', 1);
    
    request.onerror = event => {
      reject(`IndexedDB error: ${event.target.errorCode}`);
    };
    
    request.onsuccess = event => {
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const storeRequest = store.put(data, key);
      
      storeRequest.onsuccess = () => {
        resolve(data);
      };
      
      storeRequest.onerror = event => {
        reject(`Error storing data in IndexedDB: ${event.target.errorCode}`);
      };
    };
  });
}

// Encrypt the history data with RSA-OAEP (asymmetric encryption)
async function encryptData(data) {
  try {
    // Convert data to JSON string
    const jsonData = JSON.stringify(data);
    
    // Encode as UTF-8
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonData);
    
    // The public key in PEM format
    const publicKeyPEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsQJWcE2SPLBEyh8LJx/6
5r6c0rihy8N4uYvElDdCfSQhg3dNc43bdXdzevRiK0KwOG8jX2T2cJ/OlGgaJwUG
d4Rss2/UO2dbytsfAVXds9VxAem8Xns79XfuoEtbdeYIYmfCa11DrnuC5fQu0fIU
pcDJrDE+Dq3NW7InsMQBsSYUVqACOKtNxf/E9YFHiK7+8GIAQ/pIU3LyOYPcpZfR
tFY46OsD0Aa+IEJ3sW1SQKd6HMJSmUY1MFjKg+Po4RWik1MRYsXNK7eeVXlb+d5E
uOBwxXEdgnc0ifSOlgnSCq/v5YhOadbKX0PpCFmLay5I+v2LlHWP8gfLP8Gl33Kd
9wIDAQAB
-----END PUBLIC KEY-----`;
    
    // Remove header, footer, and newlines to get the base64 encoded key
    const publicKeyBase64 = publicKeyPEM
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '');
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(publicKeyBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Import the public key
    const publicKey = await crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    );
    
    // RSA-OAEP has a size limit, so we'll use a hybrid approach:
    // 1. Generate a random AES key
    // 2. Encrypt data with the AES key
    // 3. Encrypt the AES key with the RSA public key
    
    // Generate a random AES key
    const aesKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt']
    );
    
    // Generate random IV for AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data with AES-GCM
    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      dataBuffer
    );
    
    // Export the AES key
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    
    // Encrypt the AES key with RSA-OAEP
    const encryptedAesKey = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      publicKey,
      rawAesKey
    );
    
    // Combine everything for the result
    const result = {
      version: '2.0',
      encryptionMethod: 'hybrid-rsa-aes',
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
      encryptedKey: Array.from(new Uint8Array(encryptedAesKey))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''),
      encryptedData: Array.from(new Uint8Array(encryptedContent))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    };
    
    return result;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt history data: ' + error.message);
  }
} 