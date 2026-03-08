/**
 * Content script - bridges MoneyTech page and extension background worker.
 * Injected into MoneyTech pages (vercel.app and localhost).
 */

// Listen for messages from the page
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (!event.data || event.data.type !== 'MONEYTECH_NB_REQUEST') return

  const { id, action, data } = event.data

  // Forward to background service worker
  chrome.runtime.sendMessage({ action, data }, (response) => {
    // Send response back to the page
    window.postMessage(
      {
        type: 'MONEYTECH_NB_RESPONSE',
        id,
        ...response,
      },
      '*'
    )
  })
})

// Notify page that the extension is available
window.postMessage({ type: 'MONEYTECH_NB_READY' }, '*')

// Re-notify periodically (in case page loads after content script)
let readyCount = 0
const readyInterval = setInterval(() => {
  window.postMessage({ type: 'MONEYTECH_NB_READY' }, '*')
  readyCount++
  if (readyCount >= 10) clearInterval(readyInterval)
}, 1000)
