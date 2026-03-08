const STORAGE_KEY = 'moneytech_connected'

const statusEl = document.getElementById('status')
const connectBtn = document.getElementById('connectBtn')
const disconnectBtn = document.getElementById('disconnectBtn')
const hintEl = document.getElementById('hint')
const siteUrlInput = document.getElementById('siteUrl')
const debugEl = document.getElementById('debug')

// Load saved URL
chrome.storage.local.get(['siteUrl', STORAGE_KEY], (data) => {
  if (data.siteUrl) siteUrlInput.value = data.siteUrl
  checkStatus(data[STORAGE_KEY])
})

function getCookiesByUrl(url) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ url }, (cookies) => {
      resolve(cookies || [])
    })
  })
}

async function getAllGoogleCookies() {
  const cookieMap = new Map()
  const debugLines = []

  // Get ALL cookies that would be sent to notebooklm.google.com
  const urls = [
    'https://notebooklm.google.com',
    'https://accounts.google.com',
    'https://www.google.com',
    'https://myaccount.google.com',
  ]

  for (const url of urls) {
    try {
      const cookies = await getCookiesByUrl(url)
      debugLines.push(`${url}: ${cookies.length}개`)
      for (const c of cookies) {
        // Use name as key - prefer notebooklm.google.com cookies
        if (!cookieMap.has(c.name)) {
          cookieMap.set(c.name, c)
        }
      }
    } catch (e) {
      debugLines.push(`${url}: 에러 - ${e.message}`)
    }
  }

  // Also brute-force search all browser cookies for google domain
  try {
    const all = await new Promise((resolve) => {
      chrome.cookies.getAll({}, (cookies) => resolve(cookies || []))
    })
    const googleCookies = all.filter((c) => c.domain.includes('google'))
    debugLines.push(`전체 검색: google 관련 ${googleCookies.length}개`)
    for (const c of googleCookies) {
      if (!cookieMap.has(c.name)) {
        cookieMap.set(c.name, c)
      }
    }
  } catch (e) {
    debugLines.push(`전체 검색: 에러 - ${e.message}`)
  }

  const allCookies = Array.from(cookieMap.values())
  const cookieStr = allCookies.map((c) => `${c.name}=${c.value}`).join('; ')

  // Show key cookies in debug
  const keyNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID', 'NID', 'OSID']
  const foundKeys = keyNames.filter((n) => cookieMap.has(n))
  debugLines.push(`\n주요 쿠키: ${foundKeys.join(', ') || '없음'}`)
  debugLines.push(`총 쿠키: ${allCookies.length}개`)

  if (debugEl) {
    debugEl.textContent = debugLines.join('\n')
  }

  return { count: allCookies.length, cookieStr, foundKeys }
}

async function checkStatus(wasConnected) {
  const { count, cookieStr, foundKeys } = await getAllGoogleCookies()

  if (count === 0) {
    statusEl.className = 'status error'
    statusEl.textContent = 'Google 쿠키를 찾을 수 없습니다'
    connectBtn.disabled = true
    hintEl.innerHTML =
      '<a href="#" id="openNB" style="color:#00e8b8">notebooklm.google.com</a>에 로그인 후 이 팝업을 다시 여세요.'
    document.getElementById('openNB')?.addEventListener('click', (e) => {
      e.preventDefault()
      chrome.tabs.create({ url: 'https://notebooklm.google.com' })
    })
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
    statusEl.textContent = `Google 쿠키 ${count}개 발견 (주요: ${foundKeys.length}개)`
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

  const { cookieStr } = await getAllGoogleCookies()

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
      chrome.storage.local.set({ [STORAGE_KEY]: true, nbCookies: cookieStr })

      // Inject cookies into MoneyTech tabs
      const tabs = await chrome.tabs.query({ url: `${siteUrl}/*` })
      for (const tab of tabs) {
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            func: (cookies) => {
              localStorage.setItem('moneytech_nb_cookies', cookies)
              window.dispatchEvent(new Event('nb-cookies-updated'))
            },
            args: [cookieStr],
          })
          .catch(() => {})
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
      hintEl.innerHTML =
        '① <a href="#" id="openNB3" style="color:#00e8b8">notebooklm.google.com</a>에 접속하여 로그인 확인<br>' +
        '② 이 팝업을 닫았다 다시 열어서 시도'
      document.getElementById('openNB3')?.addEventListener('click', (e) => {
        e.preventDefault()
        chrome.tabs.create({ url: 'https://notebooklm.google.com' })
      })
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
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => {
            localStorage.removeItem('moneytech_nb_cookies')
            window.location.reload()
          },
        })
        .catch(() => {})
    }
  })

  statusEl.className = 'status info'
  statusEl.textContent = '연결 해제됨'
  connectBtn.textContent = '연결하기'
  disconnectBtn.style.display = 'none'
  hintEl.textContent = ''
})

// Debug toggle
document.getElementById('debugBtn')?.addEventListener('click', () => {
  if (debugEl) {
    debugEl.style.display = debugEl.style.display === 'none' ? 'block' : 'none'
  }
})
