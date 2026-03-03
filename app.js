// Состояние приложения
let appState = {
    currentChat: null,
    chats: [],
    messages: {},
    typingTimeouts: {},
    activeTyping: false,
    username: 'Пользователь',
    userAvatar: '👤',
    userAvatarUrl: null,
    editingChatId: null,
    scheduledEvents: {}, // для хранения запланированных событий
    pendingEvents: {} // для событий после сообщений
};

// Ключ для localStorage
const STORAGE_KEY = 'fakegram_state';

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
const currentUserAvatar = document.getElementById('currentUserAvatar');
const usernameSpan = document.getElementById('username');

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker зарегистрирован:', reg))
            .catch(err => console.log('Ошибка Service Worker:', err));
    });
}

// Функция сохранения состояния в localStorage
function saveState() {
    try {
        // Очищаем временные данные перед сохранением
        const stateToSave = {
            currentChat: appState.currentChat,
            chats: appState.chats,
            messages: appState.messages,
            username: appState.username,
            userAvatar: appState.userAvatar,
            userAvatarUrl: appState.userAvatarUrl,
            // Не сохраняем таймауты и временные события
            scheduledEvents: {},
            pendingEvents: {},
            typingTimeouts: {}
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        console.log('Состояние сохранено');
    } catch (error) {
        console.error('Ошибка сохранения состояния:', error);
    }
}

// Функция загрузки состояния из localStorage
function loadState() {
    try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            const parsed = JSON.parse(savedState);

            // Восстанавливаем состояние
            appState.currentChat = parsed.currentChat || null;
            appState.chats = parsed.chats || [];
            appState.messages = parsed.messages || {};
            appState.username = parsed.username || 'Пользователь';
            appState.userAvatar = parsed.userAvatar || '👤';
            appState.userAvatarUrl = parsed.userAvatarUrl || null;

            console.log('Состояние загружено из localStorage');
            return true;
        }
    } catch (error) {
        console.error('Ошибка загрузки состояния:', error);
    }
    return false;
}

// Загрузка диалогов из JSON или localStorage
async function loadDialogues() {
    // Сначала пробуем загрузить из localStorage
    if (loadState()) {
        if (appState.chats.length > 0) {
            // Восстанавливаем plannedEvents из чатов
            appState.chats.forEach(chat => {
                chat.plannedEvents = chat.plannedEvents || [];
            });

            updateChatHeader();
            loadChats();
            loadMessages();

            // Запускаем планировщики для всех чатов
            appState.chats.forEach(chat => {
                scheduleChatEvents(chat.id);
            });

            return;
        }
    }

    // Если нет сохраненного состояния, загружаем из JSON
    try {
        const response = await fetch('dialogues.json');
        const data = await response.json();

        appState.chats = data.chats;

        // Преобразуем сообщения в удобный формат и добавляем plannedEvents
        appState.chats.forEach(chat => {
            appState.messages[chat.id] = chat.messages || [];
            chat.plannedEvents = chat.plannedEvents || [];
            delete chat.messages;
        });

        if (appState.chats.length > 0) {
            appState.currentChat = appState.chats[0].id;
            updateChatHeader();
        }

        loadChats();
        loadMessages();

        // Запускаем планировщики
        appState.chats.forEach(chat => {
            scheduleChatEvents(chat.id);
        });

        // Сохраняем загруженные данные
        saveState();
    } catch (error) {
        console.error('Ошибка загрузки диалогов:', error);
        loadDemoData();
    }
}

// Демо-данные
function loadDemoData() {
    appState.chats = [
        {
            id: 'demo1',
            name: 'Демо чат',
            avatar: '👤',
            avatarUrl: null,
            lastMsg: 'Загрузите dialogues.json',
            time: 'сейчас',
            status: 'ожидание',
            plannedEvents: []
        }
    ];
    appState.messages = {
        demo1: [
            { id: 1, text: 'Создайте файл dialogues.json в корне проекта', sender: 'system', time: '12:00', type: 'received' }
        ]
    };
    appState.currentChat = 'demo1';
    loadChats();
    loadMessages();
    saveState();
}

// Загрузка списка чатов
function loadChats() {
    chatsList.innerHTML = '';
    appState.chats.forEach(chat => {
        const lastMsg = getLastMessage(chat.id);
        const chatEl = document.createElement('div');
        chatEl.className = `chat-item ${chat.id === appState.currentChat ? 'active' : ''}`;
        chatEl.dataset.chatId = chat.id;

        // Создаем аватар с поддержкой кастомных изображений
        const avatarHtml = chat.avatarUrl
            ? `<img src="${chat.avatarUrl}" alt="${chat.name}">`
            : chat.avatar;

        chatEl.innerHTML = `
            <div class="avatar">${avatarHtml}</div>
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

        // Обновляем аватар в заголовке
        if (chat.avatarUrl) {
            currentChatAvatar.innerHTML = `<img src="${chat.avatarUrl}" alt="${chat.name}">`;
        } else {
            currentChatAvatar.innerHTML = chat.avatar;
        }

        chatStatus.textContent = chat.status || 'онлайн';
    }
}

// Переключение чата
function switchChat(chatId) {
    // Очищаем все таймауты предыдущего чата
    if (appState.typingTimeouts[appState.currentChat]) {
        clearTimeout(appState.typingTimeouts[appState.currentChat]);
    }

    // Очищаем запланированные события
    if (appState.scheduledEvents[appState.currentChat]) {
        appState.scheduledEvents[appState.currentChat].forEach(timeout => clearTimeout(timeout));
    }

    appState.currentChat = chatId;
    updateChatHeader();
    loadMessages();
    loadChats();

    typingIndicator.style.display = 'none';
    appState.activeTyping = false;

    // Запускаем планировщик для нового чата
    scheduleChatEvents(chatId);

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

    // Сохраняем после отправки сообщения
    saveState();

    // Проверяем запланированные события после отправки сообщения
    checkPlannedEventsAfterMessage();
}

// Планирование событий чата
function scheduleChatEvents(chatId) {
    const chat = appState.chats.find(c => c.id === chatId);
    if (!chat || !chat.plannedEvents) return;

    // Очищаем предыдущие события
    if (appState.scheduledEvents[chatId]) {
        appState.scheduledEvents[chatId].forEach(timeout => clearTimeout(timeout));
    }
    appState.scheduledEvents[chatId] = [];

    // Планируем каждое событие
    chat.plannedEvents.forEach(event => {
        if (event.trigger === 'time') {
            // Событие по времени
            scheduleTimeBasedEvent(chatId, event);
        } else if (event.trigger === 'after_message') {
            // Событие после моего сообщения
            scheduleMessageBasedEvent(chatId, event);
        }
    });
}

// Событие по времени
function scheduleTimeBasedEvent(chatId, event) {
    const now = new Date();
    const [hours, minutes] = event.time.split(':').map(Number);
    const eventTime = new Date();
    eventTime.setHours(hours, minutes, 0, 0);

    let delay = eventTime - now;
    if (delay < 0) {
        // Если время уже прошло сегодня, планируем на завтра
        delay += 24 * 60 * 60 * 1000;
    }

    const timeout = setTimeout(() => {
        executeChatEvent(chatId, event);
    }, delay);

    appState.scheduledEvents[chatId].push(timeout);
}

// Событие после моего сообщения
function scheduleMessageBasedEvent(chatId, event) {
    // Сохраняем событие для проверки после отправки сообщений
    if (!appState.pendingEvents) appState.pendingEvents = {};
    if (!appState.pendingEvents[chatId]) appState.pendingEvents[chatId] = [];

    appState.pendingEvents[chatId].push({
        event: event,
        triggered: false
    });
}

// Проверка запланированных событий после сообщения
function checkPlannedEventsAfterMessage() {
    const chatId = appState.currentChat;
    if (!appState.pendingEvents || !appState.pendingEvents[chatId]) return;

    appState.pendingEvents[chatId].forEach(pending => {
        if (!pending.triggered) {
            pending.triggered = true;

            // Показываем "печатает"
            setTimeout(() => {
                typingIndicator.style.display = 'flex';
                appState.activeTyping = true;

                // Меняем статус на "печатает"
                const chat = appState.chats.find(c => c.id === chatId);
                const originalStatus = chat.status;
                chat.status = 'печатает';
                updateChatHeader();

                // Отправляем сообщение через время печатания
                setTimeout(() => {
                    typingIndicator.style.display = 'none';
                    appState.activeTyping = false;

                    // Отправляем запланированное сообщение
                    executeChatEvent(chatId, pending.event);

                    // Восстанавливаем статус
                    chat.status = originalStatus;
                    updateChatHeader();

                }, pending.event.typingTime * 1000);

            }, pending.event.delay * 1000);
        }
    });
}

// Выполнение события чата
function executeChatEvent(chatId, event) {
    const chat = appState.chats.find(c => c.id === chatId);

    // Изменяем статус
    if (event.status) {
        chat.status = event.status;
        updateChatHeader();
    }

    // Отправляем сообщение
    if (event.message) {
        const now = new Date();
        const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

        const newMessage = {
            id: Date.now(),
            text: event.message,
            sender: 'contact',
            time: time,
            type: 'received'
        };

        if (!appState.messages[chatId]) {
            appState.messages[chatId] = [];
        }

        appState.messages[chatId].push(newMessage);
        chat.lastMsg = event.message;
        chat.time = time;

        loadMessages();
        loadChats();

        // Сохраняем после получения сообщения
        saveState();
    }
}

// Управление меню
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
});

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

// ========== УПРАВЛЕНИЕ АВАТАРАМИ ==========

// Функция загрузки изображения
function handleImageUpload(file, callback) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        callback(e.target.result);
    };
    reader.readAsDataURL(file);
}

// Функция установки аватара по URL
function setAvatarFromUrl(url, previewElement, callback) {
    // Проверяем, что URL ведет на изображение
    const img = new Image();
    img.onload = function() {
        callback(url);
        previewElement.innerHTML = `<img src="${url}" alt="avatar">`;
    };
    img.onerror = function() {
        alert('Не удалось загрузить изображение по ссылке');
    };
    img.src = url;
}

// ========== ПРОФИЛЬ ==========

// Обновление аватара пользователя
function updateUserAvatar() {
    if (appState.userAvatarUrl) {
        currentUserAvatar.innerHTML = `<img src="${appState.userAvatarUrl}" alt="${appState.username}">`;
    } else {
        currentUserAvatar.innerHTML = appState.userAvatar;
    }
    usernameSpan.textContent = appState.username;
}

// Открытие профиля
document.getElementById('profileMenuItem').addEventListener('click', () => {
    document.getElementById('usernameInput').value = appState.username;

    // Показываем текущий аватар
    const preview = document.getElementById('profileAvatarPreview');
    if (appState.userAvatarUrl) {
        preview.innerHTML = `<img src="${appState.userAvatarUrl}" alt="avatar">`;
    } else {
        preview.innerHTML = appState.userAvatar;
    }

    openModal('profileModal');
});

// Загрузка аватара профиля из файла
document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
    document.getElementById('avatarUpload').click();
});

document.getElementById('avatarUpload').addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], (imageData) => {
        appState.userAvatarUrl = imageData;
        appState.userAvatar = null;
        document.getElementById('profileAvatarPreview').innerHTML = `<img src="${imageData}" alt="avatar">`;
    });
});

// Загрузка аватара профиля по URL
document.getElementById('avatarUrlBtn').addEventListener('click', () => {
    const urlInput = document.getElementById('avatarUrlInput');
    urlInput.style.display = urlInput.style.display === 'none' ? 'flex' : 'none';
});

document.getElementById('applyAvatarUrl').addEventListener('click', () => {
    const url = document.getElementById('avatarUrl').value;
    if (url) {
        setAvatarFromUrl(url, document.getElementById('profileAvatarPreview'), (imageUrl) => {
            appState.userAvatarUrl = imageUrl;
            appState.userAvatar = null;
            document.getElementById('avatarUrlInput').style.display = 'none';
            document.getElementById('avatarUrl').value = '';
        });
    }
});

// Сохранение профиля
function saveProfile() {
    appState.username = document.getElementById('usernameInput').value;
    updateUserAvatar();
    closeModal('profileModal');
    saveState(); // Сохраняем после изменения профиля
}

// ========== УПРАВЛЕНИЕ ДИАЛОГАМИ ==========

// Новый диалог
document.getElementById('newChatMenuItem').addEventListener('click', () => {
    appState.editingChatId = null;
    document.getElementById('chatModalTitle').textContent = 'Новый диалог';
    document.getElementById('chatNameInput').value = '';
    document.getElementById('chatStatusInput').value = 'онлайн';

    // Сбрасываем аватар
    document.getElementById('chatAvatarPreview').innerHTML = '👥';

    // Очищаем список событий
    document.getElementById('eventsList').innerHTML = '';
    window.currentEvents = [];

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

    // Показываем текущий аватар
    const preview = document.getElementById('chatAvatarPreview');
    if (chat.avatarUrl) {
        preview.innerHTML = `<img src="${chat.avatarUrl}" alt="avatar">`;
    } else {
        preview.innerHTML = chat.avatar;
    }

    // Загружаем события
    window.currentEvents = chat.plannedEvents ? [...chat.plannedEvents] : [];
    renderEventsList();

    openModal('chatModal');
});

// Загрузка аватара чата из файла
document.getElementById('uploadChatAvatarBtn').addEventListener('click', () => {
    document.getElementById('chatAvatarUpload').click();
});

document.getElementById('chatAvatarUpload').addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], (imageData) => {
        // Сохраняем во временную переменную
        window.tempChatAvatar = {
            url: imageData,
            isUrl: true
        };
        document.getElementById('chatAvatarPreview').innerHTML = `<img src="${imageData}" alt="avatar">`;
    });
});

// Загрузка аватара чата по URL
document.getElementById('chatAvatarUrlBtn').addEventListener('click', () => {
    const urlInput = document.getElementById('chatAvatarUrlInput');
    urlInput.style.display = urlInput.style.display === 'none' ? 'flex' : 'none';
});

document.getElementById('applyChatAvatarUrl').addEventListener('click', () => {
    const url = document.getElementById('chatAvatarUrl').value;
    if (url) {
        setAvatarFromUrl(url, document.getElementById('chatAvatarPreview'), (imageUrl) => {
            window.tempChatAvatar = {
                url: imageUrl,
                isUrl: true
            };
            document.getElementById('chatAvatarUrlInput').style.display = 'none';
            document.getElementById('chatAvatarUrl').value = '';
        });
    }
});

// Добавление нового события
document.getElementById('addEventBtn').addEventListener('click', () => {
    document.getElementById('eventModalTitle').textContent = 'Новое событие';
    document.getElementById('eventForm').reset();
    document.getElementById('eventId').value = '';
    document.getElementById('eventTimeGroup').style.display = 'none';
    document.getElementById('eventDelayGroup').style.display = 'none';
    openModal('eventModal');
});

// Изменение типа триггера
document.getElementById('eventTrigger').addEventListener('change', (e) => {
    const trigger = e.target.value;
    document.getElementById('eventTimeGroup').style.display = trigger === 'time' ? 'block' : 'none';
    document.getElementById('eventDelayGroup').style.display = trigger === 'after_message' ? 'block' : 'none';
});

// Сохранение события
document.getElementById('saveEventBtn').addEventListener('click', () => {
    const eventId = document.getElementById('eventId').value;
    const event = {
        trigger: document.getElementById('eventTrigger').value,
        message: document.getElementById('eventMessage').value,
        status: document.getElementById('eventStatus').value,
        typingTime: parseInt(document.getElementById('eventTypingTime').value) || 5
    };

    if (event.trigger === 'time') {
        event.time = document.getElementById('eventTime').value;
        if (!event.time) {
            alert('Укажите время события');
            return;
        }
    } else if (event.trigger === 'after_message') {
        event.delay = parseInt(document.getElementById('eventDelay').value) || 10;
    }

    if (!event.message) {
        alert('Введите текст сообщения');
        return;
    }

    if (eventId) {
        // Редактирование существующего
        const index = window.currentEvents.findIndex(e => e.id === parseInt(eventId));
        if (index !== -1) {
            event.id = parseInt(eventId);
            window.currentEvents[index] = event;
        }
    } else {
        // Новое событие
        event.id = Date.now();
        window.currentEvents.push(event);
    }

    renderEventsList();
    closeModal('eventModal');
});

// Редактирование события
function editEvent(eventId) {
    const event = window.currentEvents.find(e => e.id === eventId);
    if (!event) return;

    document.getElementById('eventModalTitle').textContent = 'Редактировать событие';
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventTrigger').value = event.trigger;
    document.getElementById('eventMessage').value = event.message;
    document.getElementById('eventStatus').value = event.status || '';
    document.getElementById('eventTypingTime').value = event.typingTime || 5;

    if (event.trigger === 'time') {
        document.getElementById('eventTime').value = event.time || '';
        document.getElementById('eventTimeGroup').style.display = 'block';
        document.getElementById('eventDelayGroup').style.display = 'none';
    } else if (event.trigger === 'after_message') {
        document.getElementById('eventDelay').value = event.delay || 10;
        document.getElementById('eventTimeGroup').style.display = 'none';
        document.getElementById('eventDelayGroup').style.display = 'block';
    }

    openModal('eventModal');
}

// Удаление события
function deleteEvent(eventId) {
    if (confirm('Удалить это событие?')) {
        window.currentEvents = window.currentEvents.filter(e => e.id !== eventId);
        renderEventsList();
    }
}

// Отображение списка событий
function renderEventsList() {
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '';

    window.currentEvents.forEach(event => {
        const eventEl = document.createElement('div');
        eventEl.className = 'event-item';

        const triggerText = event.trigger === 'time'
            ? `Время: ${event.time}`
            : `Через ${event.delay} сек после моего сообщения`;

        eventEl.innerHTML = `
            <div class="event-header">
                <span class="event-trigger">${triggerText}</span>
                <div class="event-actions">
                    <button class="event-edit-btn" onclick="editEvent(${event.id})">✏️</button>
                    <button class="event-delete-btn" onclick="deleteEvent(${event.id})">🗑️</button>
                </div>
            </div>
            <div class="event-message">${event.message}</div>
            <div class="event-details">
                <span>Статус: ${event.status || 'не меняется'}</span>
                <span>Печатает: ${event.typingTime} сек</span>
            </div>
        `;

        eventsList.appendChild(eventEl);
    });
}

// Сохранение диалога
document.getElementById('saveChatBtn').addEventListener('click', () => {
    const name = document.getElementById('chatNameInput').value;
    const status = document.getElementById('chatStatusInput').value;

    // Получаем аватар
    let avatar = '👤';
    let avatarUrl = null;

    if (window.tempChatAvatar) {
        avatarUrl = window.tempChatAvatar.url;
        avatar = null;
    } else {
        // Если нет загруженного, используем эмодзи
        avatar = '👤';
    }

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
        chat.avatarUrl = avatarUrl;
        chat.plannedEvents = window.currentEvents || [];

        if (appState.currentChat === appState.editingChatId) {
            updateChatHeader();
            // Перезапускаем планировщик для обновленного чата
            scheduleChatEvents(appState.currentChat);
        }
    } else {
        // Создание нового
        const newId = 'chat_' + Date.now();
        const newChat = {
            id: newId,
            name: name,
            avatar: avatar,
            avatarUrl: avatarUrl,
            lastMsg: 'Новый диалог',
            time: 'только что',
            status: status,
            plannedEvents: window.currentEvents || []
        };

        appState.chats.push(newChat);
        appState.messages[newId] = [];
        appState.currentChat = newId;
        updateChatHeader();
    }

    loadChats();
    loadMessages();
    closeModal('chatModal');

    // Сохраняем после изменений
    saveState();

    // Очищаем временные данные
    window.tempChatAvatar = null;
    window.currentEvents = [];
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
            currentChatAvatar.innerHTML = '👥';
            chatStatus.textContent = '';
            messagesContainer.innerHTML = '';
        }

        loadChats();
        loadMessages();
        closeMenu();

        // Сохраняем после удаления
        saveState();
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
            messages: appState.messages[chat.id] || [],
            plannedEvents: chat.plannedEvents || []
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
                chat.plannedEvents = chat.plannedEvents || [];
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

            // Сохраняем импортированные данные
            saveState();

            alert('Диалоги успешно импортированы!');
        } catch (error) {
            alert('Ошибка при импорте файла: ' + error.message);
        }
    };
    reader.readAsText(file);
});

// Обработчики отправки сообщений
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Инициализация
loadDialogues();
updateUserAvatar();

// Сохраняем состояние перед закрытием страницы
window.addEventListener('beforeunload', () => {
    saveState();
});

// Запрос уведомлений
if (Notification.permission === 'default') {
    Notification.requestPermission();
}