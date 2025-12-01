class OptionsApp {
    constructor() {
        this.bookmarks = [];
        this.folders = [];
        this.searchQuery = '';
        this.contextMenu = null;
        this.init();
    }

    async init() {
        await this.loadBookmarks();
        this.bindEvents();
        this.createContextMenu();
    }

    async loadBookmarks() {
        try {
            const bookmarkTree = await chrome.bookmarks.getTree();
            this.processBookmarks(bookmarkTree);
            this.renderBookmarks();
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        }
    }

    processBookmarks(bookmarkTree) {
        this.bookmarks = [];
        this.folders = [];

        const processNode = (node) => {
            if (node.url) {
                this.bookmarks.push({
                    id: node.id,
                    title: node.title || 'Без названия',
                    url: node.url
                });
            } else if (node.children && node.id !== '0') {
                const folderBookmarks = node.children
                    .filter(child => child.url)
                    .map(child => ({
                        id: child.id,
                        title: child.title || 'Без названия',
                        url: child.url
                    }));

                this.folders.push({
                    id: node.id,
                    name: node.title || 'Без названия',
                    bookmarks: folderBookmarks
                });

                folderBookmarks.forEach(bookmark => {
                    this.bookmarks.push(bookmark);
                });
            }

            if (node.children) {
                node.children.forEach(child => processNode(child));
            }
        };

        bookmarkTree.forEach(root => processNode(root));
        console.log(this.folders);
    }

    openBookmark(url) {
        chrome.tabs.create({url: url});
    }

    async deleteBookmark(bookmarkId) {
        if (confirm('Удалить эту закладку?')) {
            await chrome.bookmarks.remove(bookmarkId);
            await this.loadBookmarks();
        }
    }

    async deleteFolder(folderId) {
        if (confirm('Удалить папку и все закладки?')) {
            await chrome.bookmarks.removeTree(folderId);
            await this.loadBookmarks();
        }
    }

    filterBookmarks() {
        const query = this.searchQuery.toLowerCase().trim();
        if (!query) {
            this.renderBookmarks();
            return;
        }

        const filteredFolders = this.folders.map(folder => ({
            ...folder,
            bookmarks: folder.bookmarks.filter(bookmark =>
                bookmark.title.toLowerCase().includes(query) ||
                bookmark.url.toLowerCase().includes(query)
            )
        })).filter(folder => folder.bookmarks.length > 0);

        this.renderBookmarks(filteredFolders);
    }

    bindEvents() {
        const searchInput = document.getElementById('searchInput');
        const refreshBtn = document.getElementById('refreshBtn');
        const bookmarksList = document.getElementById('bookmarksList');

        searchInput?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.filterBookmarks();
        });

        refreshBtn?.addEventListener('click', () => {
            this.searchQuery = '';
            searchInput.value = '';
            this.loadBookmarks();
        });

        bookmarksList?.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) {
                this.deleteBookmark(e.target.dataset.id);
                return;
            }
            if (e.target.classList.contains('delete-folder-btn')) {
                this.deleteFolder(e.target.dataset.id);
                return;
            }
            const bookmarkItem = e.target.closest('.bookmark-item');
            if (bookmarkItem?.dataset.url) {
                this.openBookmark(bookmarkItem.dataset.url);
            }
        });
        bookmarksList?.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            const bookmarkItem = e.target.closest('.bookmark-item');
            const folderHeader = e.target.closest('.folder-header');

            if (bookmarkItem) {
                const bookmarkId = bookmarkItem.dataset.id;
                const url = bookmarkItem.dataset.url;
                if (bookmarkId) {
                    this.showContextMenu(e.pageX, e.pageY, bookmarkId, 'bookmark', url);
                }
            } else if (folderHeader) {
                const folderId = folderHeader.dataset.id;
                if (folderId) {
                    this.showContextMenu(e.pageX, e.pageY, folderId, 'folder');
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });
    }

    initFolderToggle() {
        document.querySelectorAll('.folder-header').forEach(header => {
            header.removeEventListener('click', this.toggleFolder);
            header.addEventListener('click', this.toggleFolder);
        });
    }

    toggleFolder(e) {
        if (e.target.classList.contains('delete-folder-btn')) {
            return;
        }

        const bookmarksContainer = this.nextElementSibling;
        const folderIcon = this.querySelector('.folder-icon');

        if (bookmarksContainer && bookmarksContainer.classList.contains('folder-bookmarks')) {
            if (bookmarksContainer.classList.contains('expanded')) {
                bookmarksContainer.classList.remove('expanded');
                this.classList.remove('expanded');
            } else {
                bookmarksContainer.classList.add('expanded');
                this.classList.add('expanded');
            }
        }
    }

    renderBookmarks(filteredFolders = null) {
        const container = document.getElementById('bookmarksList');
        const foldersToRender = filteredFolders || this.folders;

        if (foldersToRender.length === 0) {
            container.innerHTML = '<p class="empty">Закладок не найдено</p>';
            return;
        }

        let html = `<div class="stats">Папок: ${foldersToRender.length} | Закладок: ${this.bookmarks.length}</div>`;

        foldersToRender.forEach(folder => {
            html += `
            <div class="folder-container">
                <div class="folder-header" data-id="${folder.id}">
                    <svg class="folder-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 12L10 8L6 4" stroke="#808080" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>                    
                    <span class="folder-name">${folder.name}</span>
                </div>
                <div class="folder-bookmarks">
        `;

            folder.bookmarks.forEach(bookmark => {
                html += `
                <div class="bookmark-item" data-id="${bookmark.id}" data-url="${bookmark.url}">
                    <div class="bookmark-content">
                        <img src="https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}" class="favicon">
                        <div class="bookmark-title">${bookmark.title}</div>
                    </div>
                </div>
            `;
            });

            html += `</div></div>`;
        });

        container.innerHTML = html;

        this.initFolderToggle();
    }
    createContextMenu() {
        const oldMenu = document.getElementById('contextMenu');
        if (oldMenu) {
            oldMenu.remove();
        }

        this.contextMenu = document.createElement('div');
        this.contextMenu.id = 'contextMenu';
        this.contextMenu.className = 'context-menu';
        this.contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="open">Открыть</div>
            <div class="context-menu-item" data-action="edit">Редактировать ссылку</div>
            <div class="context-menu-item" data-action="rename">Переименовать</div>
            <div class="context-menu-item" data-action="delete">Удалить</div>
        `;
        document.body.appendChild(this.contextMenu);

        this.contextMenu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.context-menu-item');
            if (!menuItem) return;

            const action = menuItem.dataset.action;
            const targetId = this.contextMenu.dataset.targetId;
            const targetType = this.contextMenu.dataset.targetType;
            const targetUrl = this.contextMenu.dataset.targetUrl;

            this.handleContextMenuAction(action, targetId, targetType, targetUrl);
            this.hideContextMenu();
        });
    }
    showContextMenu(x, y, targetId, targetType, targetUrl = '') {
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        this.contextMenu.dataset.targetId = targetId;
        this.contextMenu.dataset.targetType = targetType;
        this.contextMenu.dataset.targetUrl = targetUrl;
        this.contextMenu.classList.add('active');
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.remove('active');
        }
    }
    handleContextMenuAction(action, targetId, targetType, targetUrl) {
        switch (action) {
            case 'open':
                if (targetType === 'bookmark' && targetUrl) {
                    this.openBookmark(targetUrl);
                }
                break;
            case 'edit':
                if (targetType === 'bookmark') {
                    this.editBookmark(targetId);
                }
                break;
            case 'rename':
                if (targetType === 'bookmark') {
                    this.renameBookmark(targetId);
                } else if (targetType === 'folder') {
                    this.renameFolder(targetId);
                }
                break;
            case 'delete':
                if (targetType === 'bookmark') {
                    this.deleteBookmark(targetId);
                } else if (targetType === 'folder') {
                    this.deleteFolder(targetId);
                }
                break;
        }
    }
    async editBookmark(bookmarkId) {
        const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
        if (!bookmark) return;

        const newUrl = prompt('Введите новый URL:', bookmark.url);
        if (newUrl && newUrl !== bookmark.url) {
            try {
                await chrome.bookmarks.update(bookmarkId, { url: newUrl });
                await this.loadBookmarks();
            } catch (error) {
                console.error('Ошибка редактирования:', error);
                alert('Ошибка при редактировании закладки');
            }
        }
    }

    async renameBookmark(bookmarkId) {
        const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
        if (!bookmark) return;

        const newTitle = prompt('Введите новое название:', bookmark.title);
        if (newTitle && newTitle !== bookmark.title) {
            try {
                await chrome.bookmarks.update(bookmarkId, { title: newTitle });
                await this.loadBookmarks();
            } catch (error) {
                console.error('Ошибка переименования:', error);
                alert('Ошибка при переименовании закладки');
            }
        }
    }

    async renameFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder) return;

        const newName = prompt('Введите новое название папки:', folder.name);
        if (newName && newName !== folder.name) {
            try {
                await chrome.bookmarks.update(folderId, { title: newName });
                await this.loadBookmarks();
            } catch (error) {
                console.error('Ошибка переименования:', error);
                alert('Ошибка при переименовании папки');
            }
        }
    }


}

document.addEventListener('DOMContentLoaded', () => {
    new OptionsApp();
});