let currentManga = null
let currentChapter = null
let chaptersCache = {}

document.addEventListener('DOMContentLoaded', () => {
  initSidebar()
  initSidebarTouch()
  initButtons()
  loadFromLocalStorage()
  loadMangaList()
  checkForUpdates()
  const settings = loadSettings()
  applySettings(settings)
})

function initSidebar() {
  const sidebar = document.getElementById('sidebar')
  initFilters()
}

function initSidebarTouch() {
  // Pour le défilement vertical de la sidebar, aucun code supplémentaire n'est nécessaire.
  // La propriété CSS overflow-y avec -webkit-overflow-scrolling: touch permet le scroll naturel.
}

function initFilters() {
  const typeFilter = document.getElementById('type-filter')
  const statusFilter = document.getElementById('status-filter')
  if (typeFilter && statusFilter) {
    const savedFilters = loadFilters()
    typeFilter.value = savedFilters.type || 'all'
    statusFilter.value = savedFilters.status || 'all'
    typeFilter.addEventListener('change', () => {
      filterManga(typeFilter.value, statusFilter.value)
      saveFilters()
    })
    statusFilter.addEventListener('change', () => {
      filterManga(typeFilter.value, statusFilter.value)
      saveFilters()
    })
  }
}

function saveFilters() {
  const typeFilter = document.getElementById('type-filter')
  const statusFilter = document.getElementById('status-filter')
  if (typeFilter && statusFilter) {
    const filters = { type: typeFilter.value, status: statusFilter.value }
    localStorage.setItem('mangaFilters', JSON.stringify(filters))
  }
}

function loadFilters() {
  try {
    return JSON.parse(localStorage.getItem('mangaFilters') || '{}')
  } catch {
    return {}
  }
}

function filterManga(type, status) {
  const items = document.querySelectorAll('.manga-item')
  const query = document.getElementById('search-input').value.toLowerCase().trim()
  items.forEach(item => {
    const t = item.getAttribute('data-type')
    const s = item.getAttribute('data-status')
    const title = item.querySelector('.manga-title').textContent.toLowerCase()
    const typeMatch = type === 'all' || t === type
    const statusMatch = status === 'all' || s === status
    const searchMatch = !query || title.includes(query)
    item.style.display = (typeMatch && statusMatch && searchMatch) ? 'flex' : 'none'
  })
}

function searchManga(query) {
  const typeFilter = document.getElementById('type-filter')
  const statusFilter = document.getElementById('status-filter')
  if (typeFilter && statusFilter) {
    filterManga(typeFilter.value, statusFilter.value)
  }
}

function initButtons() {
  const historyBtn = document.getElementById('history-button')
  if (historyBtn) {
    historyBtn.addEventListener('click', e => {
      e.preventDefault()
      showHistoryPopup()
    })
  }
  const settingsBtn = document.getElementById('settings-button')
  if (settingsBtn) {
    settingsBtn.addEventListener('click', e => {
      e.preventDefault()
      showSettingsPopup()
    })
  }
  const closeSettings = document.getElementById('close-settings')
  if (closeSettings) {
    closeSettings.addEventListener('click', e => {
      e.preventDefault()
      hideSettingsPopup()
    })
  }
  const searchInput = document.getElementById('search-input')
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchManga(e.target.value)
    })
  }
  const prevBtn = document.getElementById('prev-chapter-button')
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentManga && currentChapter > 1) {
        loadChapter(currentManga, currentChapter - 1)
      }
    })
  }
  const nextBtn = document.getElementById('next-chapter-button')
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentManga) {
        loadChapter(currentManga, currentChapter + 1)
      }
    })
  }
  const toggleScansBtn = document.getElementById('toggle-scans-button')
  if (toggleScansBtn) {
    toggleScansBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar')
      sidebar.classList.toggle('active')
    })
  }
}

document.addEventListener('click', e => {
  const historyPopup = document.querySelector('.history-popup')
  const settingsPopup = document.querySelector('.settings-popup')
  const overlay = document.querySelector('.overlay')
  if (overlay && e.target === overlay) {
    if (historyPopup) hideHistoryPopup()
    if (settingsPopup) hideSettingsPopup()
  }
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideHistoryPopup()
    hideSettingsPopup()
  }
})

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.getElementById('sidebar')?.classList.remove('active')
    document.getElementById('sidebar-overlay')?.classList.remove('active')
  }
})

async function loadChapterFromHistory(slug, chapterNumber) {
  try {
    const manga = await getMangaBySlug(slug)
    if (manga) {
      await setupMangaReader(manga, chapterNumber)
      hideHistoryPopup()
    }
  } catch {}
}

async function showHistoryPopup() {
  const lastRead = JSON.parse(localStorage.getItem('lastReadChapters') || '{}')
  const mangas = await loadMangaList()
  let popup = document.querySelector('.history-popup')
  let overlay = document.querySelector('.overlay')
  if (!popup) {
    popup = document.createElement('div')
    popup.className = 'history-popup'
    document.body.appendChild(popup)
  }
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.className = 'overlay'
    document.body.appendChild(overlay)
    overlay.addEventListener('click', hideHistoryPopup)
  }
  let content = `
    <div class="history-popup-header">
      <h2>Historique de lecture</h2>
      <button class="close-popup" onclick="hideHistoryPopup()">×</button>
    </div>
    <div class="history-list">
  `
  const withHistory = mangas.filter(m => lastRead[m.slug])
  if (withHistory.length === 0) {
    content += '<div class="history-item">Aucun historique de lecture</div>'
  } else {
    withHistory.forEach(manga => {
      const ch = lastRead[manga.slug]
      content += `
        <div class="history-item" data-slug="${manga.slug}">
          <div class="history-manga-info">
            <div class="history-manga-title">${manga.title}</div>
            <div class="history-chapter">Chapitre ${ch}</div>
          </div>
          <div class="history-actions">
            <button onclick="loadChapterFromHistory('${manga.slug}', ${ch})">Lire</button>
            <button onclick="editChapter('${manga.slug}', ${ch})">Modifier</button>
            <button onclick="deleteHistory('${manga.slug}')">Supprimer</button>
          </div>
        </div>
      `
    })
  }
  content += '</div>'
  popup.innerHTML = content
  popup.classList.add('active')
  overlay.classList.add('active')
}

function hideHistoryPopup() {
  const popup = document.querySelector('.history-popup')
  const overlay = document.querySelector('.overlay')
  if (popup) {
    popup.classList.remove('active')
    setTimeout(() => popup.remove(), 300)
  }
  if (overlay) {
    overlay.classList.remove('active')
    setTimeout(() => overlay.remove(), 300)
  }
}

function showSettingsPopup() {
  const popup = document.querySelector('.settings-popup')
  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  document.body.appendChild(overlay)
  if (popup) {
    popup.classList.add('active')
    overlay.classList.add('active')
  }
}

function hideSettingsPopup() {
  const popup = document.querySelector('.settings-popup')
  const overlay = document.querySelector('.overlay')
  if (popup) popup.classList.remove('active')
  if (overlay) {
    overlay.classList.remove('active')
    overlay.remove()
  }
}

function loadFromLocalStorage() {
  try {
    JSON.parse(localStorage.getItem('readingHistory') || '[]')
    JSON.parse(localStorage.getItem('webSettings') || '{}')
  } catch {}
}

function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

async function loadMangaList() {
  try {
    const response = await fetch('manga-list.json')
    if (!response.ok) throw new Error()
    const data = await response.json()
    displayMangaList(data.mangas)
    return data.mangas
  } catch {
    displayError('Erreur lors du chargement des mangas')
    return []
  }
}

function displayMangaList(mangas) {
  const list = document.getElementById('manga-list')
  if (!list) return
  list.innerHTML = ''
  mangas.forEach(m => list.appendChild(createMangaElement(m)))
}

function createMangaElement(manga) {
  const item = document.createElement('div')
  item.className = 'manga-item'
  item.setAttribute('data-slug', manga.slug)
  item.setAttribute('data-type', manga.type)
  item.setAttribute('data-status', manga.status)
  const cover = document.createElement('img')
  cover.className = 'manga-cover'
  cover.src = manga.cover
  cover.alt = manga.title
  const title = document.createElement('div')
  title.className = 'manga-title'
  title.textContent = manga.title
  item.appendChild(cover)
  item.appendChild(title)
  item.addEventListener('click', () => selectManga(manga))
  return item
}

function needsUpdate(slug) {
  if (!chaptersCache[slug]) return true
  const lastUpdate = new Date(chaptersCache[slug].lastUpdate)
  const now = new Date()
  return ((now - lastUpdate) / 36e5) >= 24
}

async function updateMangaChapters(manga) {
  try {
    const maxChapters = 200
    const chapters = []
    for (let i = 1; i <= maxChapters; i++) {
      chapters.push({
        number: i,
        url: manga.chapterUrlPattern.replace('{chapter}', i)
      })
    }
    chapters.sort((a, b) => b.number - a.number)
    chaptersCache[manga.slug] = {
      chapters,
      lastUpdate: new Date().toISOString()
    }
    localStorage.setItem('chaptersCache', JSON.stringify(chaptersCache))
    return chapters
  } catch {
    return []
  }
}

async function getMangaBySlug(slug) {
  try {
    const response = await fetch('manga-list.json')
    if (!response.ok) throw new Error()
    const data = await response.json()
    return data.mangas.find(m => m.slug === slug)
  } catch {
    return null
  }
}

async function selectManga(manga) {
  await setupMangaReader(manga)
}

async function setupMangaReader(manga, forcedChapter = null) {
  try {
    let chapters = []
    if (!chaptersCache[manga.slug] || needsUpdate(manga.slug)) {
      chapters = await updateMangaChapters(manga)
    } else {
      chapters = chaptersCache[manga.slug].chapters
    }
    const lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}')
    const lastRead = forcedChapter || lastReadChapters[manga.slug] || 1
    displayMangaReader(manga)
    loadChapter(manga, lastRead)
  } catch {}
}

function displayMangaReader(manga) {
  const reader = document.getElementById('manga-reader')
  if (!reader) return
  reader.innerHTML = `<div id="chapter-content"></div>`
}

function updateChapterIndicator(chapterNumber) {
  const indicator = document.getElementById('chapter-indicator')
  if (indicator) {
    indicator.textContent = 'Chapitre ' + chapterNumber
  }
}

function loadChapter(manga, chapterNumber) {
  currentManga = manga
  currentChapter = chapterNumber
  const chapterContent = document.getElementById('chapter-content')
  if (chapterContent) {
    chapterContent.innerHTML = `<div class="loading">Chargement du chapitre ${chapterNumber}...</div>`
  }
  const chapterUrl = manga.chapterUrlPattern.replace('{chapter}', chapterNumber)
  fetch(`/proxy/chapter?url=${encodeURIComponent(chapterUrl)}`)
    .then(response => {
      if (!response.ok) throw new Error()
      return response.json()
    })
    .then(data => {
      if (!data.images || data.images.length === 0) throw new Error()
      displayChapterImages(data.images)
      updateChapterIndicator(chapterNumber)
      const lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}')
      lastReadChapters[manga.slug] = chapterNumber
      localStorage.setItem('lastReadChapters', JSON.stringify(lastReadChapters))
    })
    .catch(() => {
      if (chapterContent) {
        chapterContent.innerHTML = `<div class="error"><h3>Erreur lors du chargement du chapitre</h3></div>`
      }
    })
}

function displayChapterImages(images) {
  const chapterContent = document.getElementById('chapter-content')
  if (!chapterContent) return
  chapterContent.innerHTML = ''
  images.sort((a, b) => a.pageNumber - b.pageNumber).forEach((imgData, idx) => {
    const pageDiv = document.createElement('div')
    pageDiv.className = 'page-container'
    const img = document.createElement('img')
    img.className = 'chapter-image'
    img.src = imgData.url
    img.alt = 'Page ' + imgData.pageNumber
    img.loading = idx < 3 ? 'eager' : 'lazy'
    pageDiv.appendChild(img)
    chapterContent.appendChild(pageDiv)
  })
}

function editChapter(slug, currentChapter) {
  const item = document.querySelector(`.history-item[data-slug="${slug}"]`)
  if (!item) return
  const chEl = item.querySelector('.history-chapter')
  const input = document.createElement('input')
  input.type = 'number'
  input.className = 'history-chapter-input'
  input.value = currentChapter
  input.min = 1
  chEl.innerHTML = ''
  chEl.appendChild(input)
  input.focus()
  input.addEventListener('blur', () => {
    const newCh = parseInt(input.value)
    if (newCh && newCh !== currentChapter) {
      updateChapter(slug, newCh)
    } else {
      chEl.textContent = 'Chapitre ' + currentChapter
    }
  })
  input.addEventListener('keypress', e => {
    if (e.key === 'Enter') input.blur()
  })
}

function updateChapter(slug, newCh) {
  const lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}')
  lastReadChapters[slug] = newCh
  localStorage.setItem('lastReadChapters', JSON.stringify(lastReadChapters))
  const item = document.querySelector(`.history-item[data-slug="${slug}"]`)
  if (!item) return
  const chEl = item.querySelector('.history-chapter')
  chEl.textContent = 'Chapitre ' + newCh
}

function deleteHistory(slug) {
  showConfirmDialog('Supprimer l’historique', 'Êtes-vous sûr de vouloir supprimer cet historique ?', () => {
    const lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}')
    delete lastReadChapters[slug]
    localStorage.setItem('lastReadChapters', JSON.stringify(lastReadChapters))
    const item = document.querySelector(`.history-item[data-slug="${slug}"]`)
    if (item) item.remove()
  })
}

function showConfirmDialog(title, message, callback) {
  const dialog = document.createElement('div')
  dialog.className = 'confirm-dialog'
  dialog.innerHTML = `
    <h3>${title}</h3>
    <p>${message}</p>
    <div class="confirm-buttons">
      <button class="cancel-button">Annuler</button>
      <button class="confirm-button">Confirmer</button>
    </div>
  `
  document.body.appendChild(dialog)
  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  overlay.style.zIndex = '1001'
  document.body.appendChild(overlay)
  setTimeout(() => {
    dialog.classList.add('active')
    overlay.classList.add('active')
  }, 10)
  const cancelBtn = dialog.querySelector('.cancel-button')
  const confirmBtn = dialog.querySelector('.confirm-button')
  const closeDialog = () => {
    dialog.classList.remove('active')
    overlay.classList.remove('active')
    setTimeout(() => {
      dialog.remove()
      overlay.remove()
    }, 300)
  }
  cancelBtn.onclick = closeDialog
  confirmBtn.onclick = () => {
    callback()
    closeDialog()
  }
}

function displayError(message) {
  const list = document.getElementById('manga-list')
  if (list) {
    list.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        <p>${message}</p>
      </div>
    `
  }
}

async function checkForUpdates() {
  try {
    const response = await fetch('/api/version')
    if (!response.ok) throw new Error()
    const data = await response.json()
    const currentVersion = document.getElementById('currentVersion').textContent
    const latestVersion = data.version
    if (latestVersion !== currentVersion) {
      showUpdateAvailable(latestVersion)
    }
  } catch {}
}

function showUpdateAvailable(version) {
  const settingsContent = document.querySelector('.settings-content')
  if (!settingsContent) return
  const sec = document.createElement('div')
  sec.className = 'settings-section'
  sec.innerHTML = `
    <h3>Mise à jour disponible</h3>
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-name">Version ${version}</div>
        <div class="setting-description">Une nouvelle version est disponible</div>
      </div>
      <button class="update-btn" onclick="updateApp()">
        <i class="fas fa-download"></i> Mettre à jour
      </button>
    </div>
  `
  settingsContent.insertBefore(sec, settingsContent.firstChild)
}

async function updateApp() {
  const updateBtn = document.querySelector('.update-btn')
  if (!updateBtn) return
  updateBtn.classList.add('downloading')
  updateBtn.disabled = true
  try {
    const response = await fetch('/api/update', { method: 'POST' })
    if (!response.ok) throw new Error()
    const data = await response.json()
    if (data.success) {
      window.location.reload()
    } else {
      throw new Error()
    }
  } catch {
    updateBtn.classList.remove('downloading')
    updateBtn.disabled = false
    displayError('Erreur lors de la mise à jour')
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem('webSettings', JSON.stringify(settings))
  } catch {}
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('webSettings') || '{}')
  } catch {
    return {}
  }
}

function applySettings(settings) {
  if (settings.theme) {
    document.body.setAttribute('data-theme', settings.theme)
  }
}
