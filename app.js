// Состояние приложения
let appState = {
    currentChat: null,
    chats: [],
    messages: {},
    typingTimeouts: {},
    activeTyping: false
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
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
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
            delete chat.messages; // Убираем сообщения из chat, оставляем только метаданные
        });

        // Устанавливаем первый чат как текущий
        if (appState.chats.length > 0) {
            appState.currentChat = appState.chats[0].id;
            updateChatHeader();
        }

        loadChats();
        loadMessages();
    } catch (error) {
        console.error('Ошибка загрузки диалогов:', error);
        // Загружаем демо-данные если файл не найден
        loadDemoData();
    }
}

// Демо-данные на случай отсутствия JSON
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

// Получение последнего сообщения в чате
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
    // Очищаем таймеры набора текста для предыдущего чата
    if (appState.typingTimeouts[appState.currentChat]) {
        clearTimeout(appState.typingTimeouts[appState.currentChat]);
    }

    appState.currentChat = chatId;
    updateChatHeader();
    loadMessages();
    loadChats(); // Обновляем активный класс

    // Скрываем индикатор печати
    typingIndicator.style.display = 'none';
    appState.activeTyping = false;
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

    // Добавляем сообщение пользователя
    const newMessage = {
        id: Date.now(),
        text: text,
        sender: 'me',
        time: time,
        type: 'sent'
    };

    appState.messages[appState.currentChat].push(newMessage);

    // Обновляем последнее сообщение в чате
    const chat = appState.chats.find(c => c.id === appState.currentChat);
    chat.lastMsg = text;
    chat.time = time;

    messageInput.value = '';
    loadMessages();
    loadChats();

    // Проверяем, есть ли запланированные ответы
    checkForReplies();
}

// Проверка наличия запланированных ответов
function checkForReplies() {
    const messages = appState.messages[appState.currentChat] || [];
    const lastMessage = messages[messages.length - 1];

    // Ищем следующий ответ от контакта
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

    // Показываем индикатор печати
    setTimeout(() => {
        typingIndicator.style.display = 'flex';
        appState.activeTyping = true;
    }, reply.delay * 1000 - (reply.typingTime || 5) * 1000);

    // Отправляем сообщение
    appState.typingTimeouts[appState.currentChat] = setTimeout(() => {
        typingIndicator.style.display = 'none';
        appState.activeTyping = false;

        // Добавляем сообщение в чат
        appState.messages[appState.currentChat].push(reply);

        // Обновляем последнее сообщение в чате
        const chat = appState.chats.find(c => c.id === appState.currentChat);
        chat.lastMsg = reply.text;
        chat.time = reply.time;

        loadMessages();
        loadChats();

        // Проверяем следующие ответы
        checkForReplies();
    }, reply.delay * 1000);
}

// Экспорт диалогов в JSON
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
}

// Импорт диалогов из JSON
function importDialogues(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // Очищаем старые таймеры
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

            // Скрываем индикатор печати
            typingIndicator.style.display = 'none';
            appState.activeTyping = false;

            alert('Диалоги успешно импортированы!');
        } catch (error) {
            alert('Ошибка при импорте файла: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Обработчики событий
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

exportBtn.addEventListener('click', exportDialogues);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', importDialogues);

// Инициализация
loadDialogues();

// Запрос разрешения на уведомления
if (Notification.permission === 'default') {
    Notification.requestPermission();
}