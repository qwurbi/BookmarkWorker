class BookmarkApp {
    constructor() {
        this.currentTab = 'bookmarks';
        this.user = null;
        this.recentBookmarks = [];
        this.folders = [];
        this.newBookmark = {
            title: '',
            url: '',
            folder: ''
        };

        this.init();
    }

    async init() {
        await this.loadUser();
        await this.loadRecentBookmarks();
        await this.loadFolders();
        this.render();
        this.bindEvents();
    }

    async loadUser() {
        const result = await chrome.storage.local.get('user');
        this.user = result.user || null;
    }

    async loadRecentBookmarks() {
        try {
            const bookmarks = await chrome.bookmarks.getRecent(7);
            this.recentBookmarks = bookmarks.filter(b => b.url);
        } catch (error) {
            console.error('Ошибка загрузки закладок:', error);
        }
    }

    async loadFolders() {
        try {
            const bookmarkTree = await chrome.bookmarks.getTree();
            this.folders = this.extractFolders(bookmarkTree);
        } catch (error) {
            console.error('Ошибка загрузки папок:', error);
        }
    }

    extractFolders(bookmarkTree) {
        const folders = [];

        const processNode = (node) => {
            if (node.children && node.id !== '0') {
                folders.push({
                    id: node.id,
                    name: node.title || 'Без названия'
                });

                node.children.forEach(child => {
                    if (child.children) {
                        processNode(child);
                    }
                });
            }
        };

        bookmarkTree.forEach(root => processNode(root));
        return folders;
    }

    async saveBookmark() {
        if (!this.newBookmark.title.trim() || !this.newBookmark.url.trim()) {
            alert('Пожалуйста, заполните название и URL');
            return;
        }

        try {
            let url = this.newBookmark.url;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            const bookmark = await chrome.bookmarks.create({
                title: this.newBookmark.title.trim(),
                url: url
            });

            if (this.newBookmark.folder) {
                await chrome.bookmarks.move(bookmark.id, {
                    parentId: this.newBookmark.folder
                });
            }

            this.newBookmark = {
                title: '',
                url: '',
                folder: ''
            };

            await this.loadRecentBookmarks();
            this.render();

            alert('Закладка успешно добавлена!');

        } catch (error) {
            console.error('Ошибка создания закладки:', error);
            alert('Ошибка при создании закладки: ' + error.message);
        }
    }

    async deleteBookmark(bookmarkId) {
        if (confirm('Вы уверены, что хотите удалить эту закладку?')) {
            try {
                await chrome.bookmarks.remove(bookmarkId);
                await this.loadRecentBookmarks();
                this.render();
            } catch (error) {
                console.error('Ошибка удаления закладки:', error);
                alert('Ошибка при удалении закладки');
            }
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        this.render();
    }

    openBookmarksPage() {
        chrome.tabs.create({ url: 'src/views/app/app.html' });
    }

    openUrl(url) {
        chrome.tabs.create({ url: url });
    }

    getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    bindEvents() {
        const app = document.getElementById('app');

        app.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-btn')) {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            }

            if (e.target.id === 'openBookmarksBtn') {
                this.openBookmarksPage();
            }

            if (e.target.id === 'saveBookmarkBtn') {
                this.saveBookmark();
            }

            if (e.target.classList.contains('bookmark-link')) {
                e.preventDefault();
                this.openUrl(e.target.dataset.url);
            }

            if (e.target.classList.contains('delete-bookmark')) {
                e.preventDefault();
                e.stopPropagation();
                const bookmarkId = e.target.dataset.id;
                this.deleteBookmark(bookmarkId);
            }
        });

        app.addEventListener('input', (e) => {
            if (e.target.id === 'bookmarkTitle') {
                this.newBookmark.title = e.target.value;
            }
            if (e.target.id === 'bookmarkUrl') {
                this.newBookmark.url = e.target.value;
            }
            if (e.target.id === 'bookmarkFolder') {
                this.newBookmark.folder = e.target.value;
            }
        });
    }

    render() {
        const app = document.getElementById('app');
        app.innerHTML = this.getTemplate();
    }

    getTemplate() {
        return `

      <!-- Навигация -->
      <nav class="nav">
        <button class="nav-btn ${this.currentTab === 'bookmarks' ? 'active' : ''}" 
                data-tab="bookmarks">
          Закладки
        </button>
        <button class="nav-btn ${this.currentTab === 'add-bookmark' ? 'active' : ''}" 
                data-tab="add-bookmark">
          Добавить закладку
        </button>
      </nav>

      <!-- Контент -->
      <div class="content">
        ${this.currentTab === 'bookmarks' ? this.getBookmarksTemplate() : this.getAddBookmarkTemplate()}
      </div>
    `;
    }

    getBookmarksTemplate() {
        return `
      <div>
        <button id="openBookmarksBtn" class="btn-primary">
          Bookmark Graph
        </button>
        
        <div class="section">
          <h3>Недавние закладки</h3>
          ${this.recentBookmarks.length ? this.getBookmarksListTemplate() : '<p class="empty">Нет закладок</p>'}
        </div>
      </div>
    `;
    }

    getBookmarksListTemplate() {
        const bookmarksHtml = this.recentBookmarks.map(bookmark => {
            const bookmarkTitle = this.escapeHtml(bookmark.title);
            const escapedTitle = bookmarkTitle.substring(0, 27) + '...';
            const escapedUrl = this.escapeHtml(bookmark.url);
            const escapedDomain = this.escapeHtml(this.getDomain(bookmark.url));

            return `
        <li class="list-item bookmark-item">
          <a href="#" class="link bookmark-link" data-url="${escapedUrl}">
            <img src="https://www.google.com/s2/favicons?domain=${escapedDomain}" 
                 class="favicon" alt="">
            <span class="truncate">${escapedTitle}</span>
          </a>
        </li>
      `;
        }).join('');

        return `<ul class="list">${bookmarksHtml}</ul>`;
    }

    getAddBookmarkTemplate() {
        const escapedTitle = this.escapeHtml(this.newBookmark.title);
        const escapedUrl = this.escapeHtml(this.newBookmark.url);

        const foldersOptions = this.folders.map(folder =>
            `<option value="${folder.id}" ${this.newBookmark.folder === folder.id ? 'selected' : ''}>
                ${this.escapeHtml(folder.name)}
            </option>`
        ).join('');

        return `
      <div class="section">
        <h3>Добавить новую закладку</h3>
        <form id="bookmarkForm" class="bookmark-form">
          <div class="form-group">
            <label for="bookmarkTitle">Название:</label>
            <input type="text" id="bookmarkTitle" value="${escapedTitle}" 
                   placeholder="Введите название закладки" required maxlength="100">
          </div>
          
          <div class="form-group">
            <label for="bookmarkUrl">URL:</label>
            <input type="url" id="bookmarkUrl" value="${escapedUrl}" 
                   placeholder="https://example.com" required>
          </div>
          
          <div class="form-group">
            <label for="bookmarkFolder">Папка:</label>
            <select id="bookmarkFolder">
              <option value="">Без папки</option>
              ${foldersOptions}
            </select>
          </div>
          
          <div class="form-actions">
            <button type="button" id="saveBookmarkBtn" class="btn-primary">
              Сохранить закладку
            </button>
          </div>
        </form>
      </div>

      <div class="section">
        <h3>Советы</h3>
        <ul class="tips-list">
          <li>✅ URL должен начинаться с http:// или https://</li>
          <li>✅ Вы можете выбрать папку для организации закладок</li>
          <li>✅ Закладка будет добавлена в ваши браузерные закладки</li>
        </ul>
      </div>
    `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BookmarkApp();
});