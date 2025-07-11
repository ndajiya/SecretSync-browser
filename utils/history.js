// utils/history.js

export async function getHistory() {
  return new Promise((resolve, reject) => {
    try {
      chrome.history.search(
        { text: '', startTime: 0, maxResults: 1000 },
        function (results) {
          resolve(results);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}
