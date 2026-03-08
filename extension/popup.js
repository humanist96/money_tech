const REQUIRED_COOKIES = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID']
const STORAGE_KEY = 'moneytech_connected'

const statusEl = document.getElementById('status')
const connectBtn = document.getElementById('connectBtn')
const disconnectBtn = document.getElementById('disconnectBtn')
const hintEl = document.getElementById('hint')
const siteUrlInput = document.getElementById('siteUrl')

// Load saved URL
chrome.storage.local.get(['siteUrl', STORAGE_KEY], (data) => {
  if (data.siteUrl) siteUrlInput.value = data.siteUrl
  checkStatus(data[STORAGE_KEY])
})

async function getGoogleCookies() {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: '.google.com' }, (cookies) => {
      const needed = cookies.filter((c) => REQUIRED_COOKIES.includes(c.name))
      const cookieStr = needed.map((c) => `${c.name}=${c.value}`).join('; ')
      resolve({ cookies: needed, cookieStr })
    })
  })
}

async function checkStatus(wasConnected) {
  const { cookies, cookieStr } = await getGoogleCookies()
  const found = REQUIRED_COOKIES.filter((name) =>
    cookies.some((c) => c.name === name)
  )
  const missing = REQUIRED_COOKIES.filter((name) => !found.includes(name))

  if (missing.length > 0) {
    statusEl.className = 'status error'
    statusEl.textContent = `Google 로그인 필요 (쿠키 ${found.length}/${REQUIRED_COOKIES.length})`
    connectBtn.disabled = true
    hintEl.textContent = 'Chrome에서 notebooklm.google.com에 먼저 로그인하세요.'
    return
  }

  if (wasConnected) {
    statusEl.className = 'status success'
    statusEl.textContent = '연결됨 - MoneyTech와 연동 중'
    connectBtn.textContent = '쿠키 업데이트'
    connectBtn.disabled = false
    disconnectBtn.style.display = 'block'
    hintEl.textContent = '쿠키가 만료되면 "쿠키 업데이트"를 클릭하세요.'
  } else {
    statusEl.className = 'status info'
    statusEl.textContent = `Google 쿠키 확인됨 (${found.length}개)`
    connectBtn.disabled = false
    connectBtn.textContent = '연결하기'
    hintEl.textContent = '클릭하면 Google 쿠키를 MoneyTech에 전송합니다.'
  }
}

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true
  connectBtn.textContent = '연결 중...'

  const siteUrl = siteUrlInput.value.replace(/\/$/, '')
  chrome.storage.local.set({ siteUrl })

  const { cookieStr } = await getGoogleCookies()

  if (!cookieStr) {
    statusEl.className = 'status error'
    statusEl.textContent = 'Google 쿠키를 찾을 수 없습니다'
    connectBtn.disabled = false
    connectBtn.textContent = '연결하기'
    return
  }

  // Verify cookies with MoneyTech API
  try {
    const res = await fetch(`${siteUrl}/api/notebook/auth/status`, {
      headers: { 'x-nb-cookies': cookieStr },
    })
    const data = await res.json()

    if (data.authenticated) {
      // Send cookies to the site via message passing
      // Store cookie string for the site to read
      chrome.storage.local.set({ [STORAGE_KEY]: true, nbCookies: cookieStr })

      // Also try to set it on the site's localStorage via content script injection
      const tabs = await chrome.tabs.query({ url: `${siteUrl}/*` })
      for (const tab of tabs) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (cookies) => {
            localStorage.setItem('moneytech_nb_cookies', cookies)
            window.dispatchEvent(new Event('nb-cookies-updated'))
          },
          args: [cookieStr],
        }).catch(() => {})
      }

      statusEl.className = 'status success'
      statusEl.textContent = '연결 완료! MoneyTech에서 NotebookLM을 사용할 수 있습니다.'
      connectBtn.textContent = '쿠키 업데이트'
      connectBtn.disabled = false
      disconnectBtn.style.display = 'block'
      hintEl.textContent = 'MoneyTech의 리서치 탭을 새로고침하세요.'
    } else {
      statusEl.className = 'status error'
      statusEl.textContent = `인증 실패: ${data.error || 'Unknown error'}`
      connectBtn.disabled = false
      connectBtn.textContent = '다시 시도'
      hintEl.textContent = 'notebooklm.google.com에 로그인한 뒤 다시 시도하세요.'
    }
  } catch (e) {
    statusEl.className = 'status error'
    statusEl.textContent = `연결 실패: ${e.message}`
    connectBtn.disabled = false
    connectBtn.textContent = '다시 시도'
    hintEl.textContent = `MoneyTech URL(${siteUrl})이 올바른지 확인하세요.`
  }
})

disconnectBtn.addEventListener('click', () => {
  chrome.storage.local.remove([STORAGE_KEY, 'nbCookies'])

  const siteUrl = siteUrlInput.value.replace(/\/$/, '')
  chrome.tabs.query({ url: `${siteUrl}/*` }, (tabs) => {
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          localStorage.removeItem('moneytech_nb_cookies')
          window.location.reload()
        },
      }).catch(() => {})
    }
  })

  statusEl.className = 'status info'
  statusEl.textContent = '연결 해제됨'
  connectBtn.textContent = '연결하기'
  disconnectBtn.style.display = 'none'
  hintEl.textContent = ''
})
