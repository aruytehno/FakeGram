// Состояние приложения
let appState = {
    currentChat: null,
    chats: [],
    messages: {},
    typingTimeouts: {},
    activeTyping: false,
    username: 'Пользователь',
    userAvatar: '👤',
    editingChatId: null
};

// DOM элементы
const chatsList = document.getElementById('chatsList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const currentChatName = document.getElementById('currentChatName');
const currentChatAvatar = document.getElementById('currentChatAvatar');
const chatStatus = document.getElementById('chatStatus');
const typingIndicator = document.getElementById('typingIndicator');
const menuBtn = document.getElementById('menuBtn');
const userMenu = document.getElementById('userMenu');
const importFile = document.getElementById('importFile');

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker зарегистрирован:', reg))
            .catch(err => console.log('Ошибка Service Worker:', err));
    });
}

// Загрузка диалогов из JSON
async function loadDialogues() {
    try {
        const response = await fetch('dialogues.json');
        const data = await response.json();

        appState.chats = data.chats;

        // Преобразуем сообщения в удобный формат
        appState.chats.forEach(chat => {
            appState.messages[chat.id] = chat.messages || [];
            delete chat.messages;
        });

        if (appState.chats.length > 0) {
            appState.currentChat = appState.chats[0].id;
            updateChatHeader();
        }

        loadChats();
        loadMessages();
    } catch (error) {
        console.error('Ошибка загрузки диалогов:', error);
        loadDemoData();
    }
}

// Демо-данные
function loadDemoData() {
    appState.chats = [
        { id: 'demo1', name: 'Демо чат', avatar: '👤', lastMsg: 'Загрузите dialogues.json', time: 'сейчас', status: 'ожидание' }
    ];
    appState.messages = {
        demo1: [
            { id: 1, text: 'Создайте файл dialogues.json в корне проекта', sender: 'system', time: '12:00', type: 'received' }
        ]
    };
    appState.currentChat = 'demo1';
    loadChats();
    loadMessages();
}

// Загрузка списка чатов
function loadChats() {
    chatsList.innerHTML = '';
    appState.chats.forEach(chat => {
        const lastMsg = getLastMessage(chat.id);
        const chatEl = document.createElement('div');
        chatEl.className = `chat-item ${chat.id === appState.currentChat ? 'active' : ''}`;
        chatEl.dataset.chatId = chat.id;
        chatEl.innerHTML = `
            <div class="avatar">${chat.avatar}</div>
            <div class="chat-item-info">
                <div class="chat-item-name">${chat.name}</div>
                <div class="chat-item-lastmsg">${lastMsg?.text || chat.lastMsg || 'Нет сообщений'}</div>
            </div>
            <div class="chat-item-time">${chat.time || ''}</div>
        `;
        chatEl.addEventListener('click', () => switchChat(chat.id));
        chatsList.appendChild(chatEl);
    });
}

// Получение последнего сообщения
function getLastMessage(chatId) {
    const messages = appState.messages[chatId] || [];
    return messages[messages.length - 1];
}

// Обновление заголовка чата
function updateChatHeader() {
    const chat = appState.chats.find(c => c.id === appState.currentChat);
    if (chat) {
        currentChatName.textContent = chat.name;
        currentChatAvatar.textContent = chat.avatar;
        chatStatus.textContent = chat.status || 'онлайн';
    }
}

// Переключение чата
function switchChat(chatId) {
    if (appState.typingTimeouts[appState.currentChat]) {
        clearTimeout(appState.typingTimeouts[appState.currentChat]);
    }

    appState.currentChat = chatId;
    updateChatHeader();
    loadMessages();
    loadChats();

    typingIndicator.style.display = 'none';
    appState.activeTyping = false;

    // Закрываем меню при переключении чата
    closeMenu();
}

// Загрузка сообщений
function loadMessages() {
    const chatMessages = appState.messages[appState.currentChat] || [];
    messagesContainer.innerHTML = '';

    chatMessages.forEach(msg => {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${msg.type}`;
        messageEl.dataset.messageId = msg.id;
        messageEl.innerHTML = `
            <div class="message-text">${msg.text}</div>
            <div class="message-time">${msg.time}</div>
        `;
        messagesContainer.appendChild(messageEl);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Отправка сообщения
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !appState.currentChat) return;

    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (!appState.messages[appState.currentChat]) {
        appState.messages[appState.currentChat] = [];
    }

    const newMessage = {
        id: Date.now(),
        text: text,
        sender: 'me',
        time: time,
        type: 'sent'
    };

    appState.messages[appState.currentChat].push(newMessage);

    const chat = appState.chats.find(c => c.id === appState.currentChat);
    chat.lastMsg = text;
    chat.time = time;

    messageInput.value = '';
    loadMessages();
    loadChats();
    checkForReplies();
}

// Проверка ответов
function checkForReplies() {
    const messages = appState.messages[appState.currentChat] || [];
    const lastMessage = messages[messages.length - 1];

    const nextReply = messages.find(msg =>
        msg.sender === 'contact' &&
        msg.delay > 0 &&
        !msg.scheduled &&
        messages.indexOf(msg) > messages.indexOf(lastMessage)
    );

    if (nextReply && !appState.activeTyping) {
        scheduleReply(nextReply);
    }
}

// Планирование ответа
function scheduleReply(reply) {
    if (!reply || reply.scheduled) return;

    reply.scheduled = true;

    setTimeout(() => {
        typingIndicator.style.display = 'flex';
        appState.activeTyping = true;
    }, reply.delay * 1000 - (reply.typingTime || 5) * 1000);

    appState.typingTimeouts[appState.currentChat] = setTimeout(() => {
        typingIndicator.style.display = 'none';
        appState.activeTyping = false;

        appState.messages[appState.currentChat].push(reply);

        const chat = appState.chats.find(c => c.id === appState.currentChat);
        chat.lastMsg = reply.text;
        chat.time = reply.time;

        loadMessages();
        loadChats();
        checkForReplies();
    }, reply.delay * 1000);
}

// Управление меню
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (userMenu.style.display === 'none' || userMenu.style.display === '') {
        userMenu.style.display = 'block';
    } else {
        userMenu.style.display = 'none';
    }
});

// Закрытие меню при клике вне его
document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target) && e.target !== menuBtn) {
        userMenu.style.display = 'none';
    }
});

function closeMenu() {
    userMenu.style.display = 'none';
}

// Функции для модальных окон
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    closeMenu();
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Профиль
document.getElementById('profileMenuItem').addEventListener('click', () => {
    document.getElementById('usernameInput').value = appState.username;
    openModal('profileModal');
});

function saveProfile() {
    appState.username = document.getElementById('usernameInput').value;
    document.querySelector('.username').textContent = appState.username;
    closeModal('profileModal');
}

// Новый диалог
document.getElementById('newChatMenuItem').addEventListener('click', () => {
    appState.editingChatId = null;
    document.getElementById('chatModalTitle').textContent = 'Новый диалог';
    document.getElementById('chatNameInput').value = '';
    document.getElementById('chatStatusInput').value = 'онлайн';
    openModal('chatModal');
});

// Редактирование диалога
document.getElementById('editChatMenuItem').addEventListener('click', () => {
    if (!appState.currentChat) {
        alert('Выберите диалог для редактирования');
        return;
    }

    const chat = appState.chats.find(c => c.id === appState.currentChat);
    appState.editingChatId = chat.id;
    document.getElementById('chatModalTitle').textContent = 'Редактировать диалог';
    document.getElementById('chatNameInput').value = chat.name;
    document.getElementById('chatStatusInput').value = chat.status || 'онлайн';
    openModal('chatModal');
});

// Сохранение диалога
document.getElementById('saveChatBtn').addEventListener('click', () => {
    const name = document.getElementById('chatNameInput').value;
    const status = document.getElementById('chatStatusInput').value;
    const avatar = document.querySelector('.avatar-option.selected')?.textContent || '👤';

    if (!name) {
        alert('Введите название чата');
        return;
    }

    if (appState.editingChatId) {
        // Редактирование существующего
        const chat = appState.chats.find(c => c.id === appState.editingChatId);
        chat.name = name;
        chat.status = status;
        chat.avatar = avatar;

        if (appState.currentChat === appState.editingChatId) {
            updateChatHeader();
        }
    } else {
        // Создание нового
        const newId = 'chat_' + Date.now();
        const newChat = {
            id: newId,
            name: name,
            avatar: avatar,
            lastMsg: 'Новый диалог',
            time: 'только что',
            status: status
        };

        appState.chats.push(newChat);
        appState.messages[newId] = [];
        appState.currentChat = newId;
        updateChatHeader();
    }

    loadChats();
    loadMessages();
    closeModal('chatModal');

    // Сбрасываем выделение аватара
    document.querySelectorAll('.avatar-option').forEach(btn => {
        btn.classList.remove('selected');
    });
});

// Удаление диалога
document.getElementById('deleteChatMenuItem').addEventListener('click', () => {
    if (!appState.currentChat) {
        alert('Выберите диалог для удаления');
        return;
    }

    if (confirm('Удалить этот диалог?')) {
        const chatIndex = appState.chats.findIndex(c => c.id === appState.currentChat);
        appState.chats.splice(chatIndex, 1);
        delete appState.messages[appState.currentChat];

        if (appState.chats.length > 0) {
            appState.currentChat = appState.chats[0].id;
            updateChatHeader();
        } else {
            appState.currentChat = null;
            currentChatName.textContent = 'Нет диалогов';
            currentChatAvatar.textContent = '👥';
            chatStatus.textContent = '';
            messagesContainer.innerHTML = '';
        }

        loadChats();
        loadMessages();
        closeMenu();
    }
});

// Экспорт
document.getElementById('exportMenuItem').addEventListener('click', exportDialogues);

// Импорт
document.getElementById('importMenuItem').addEventListener('click', () => {
    importFile.click();
});

// Экспорт диалогов
function exportDialogues() {
    const exportData = {
        chats: appState.chats.map(chat => ({
            ...chat,
            messages: appState.messages[chat.id] || []
        }))
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `dialogues_${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    closeMenu();
}

// Импорт диалогов
importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            Object.values(appState.typingTimeouts).forEach(timeout => {
                clearTimeout(timeout);
            });

            appState.chats = data.chats || [];
            appState.messages = {};

            appState.chats.forEach(chat => {
                appState.messages[chat.id] = chat.messages || [];
                delete chat.messages;
            });

            if (appState.chats.length > 0) {
                appState.currentChat = appState.chats[0].id;
                updateChatHeader();
            }

            loadChats();
            loadMessages();
            typingIndicator.style.display = 'none';
            appState.activeTyping = false;
            closeMenu();

            alert('Диалоги успешно импортированы!');
        } catch (error) {
            alert('Ошибка при импорте файла: ' + error.message);
        }
    };
    reader.readAsText(file);
});

// Выбор аватара
document.querySelectorAll('.avatar-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });
});

// Обработчики отправки сообщений
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Инициализация
loadDialogues();

// Запрос уведомлений
if (Notification.permission === 'default') {
    Notification.requestPermission();
}