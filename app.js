// Состояние приложения
let currentChat = 'general';
const messages = {
    general: [
        { id: 1, text: 'Добро пожаловать в общий чат!', sender: 'system', time: '10:00', type: 'received' },
        { id: 2, text: 'Привет всем!', sender: 'user', time: '10:01', type: 'received' },
    ],
    friends: [
        { id: 1, text: 'Как дела?', sender: 'friend1', time: '09:30', type: 'received' },
    ],
    work: [
        { id: 1, text: 'Встреча в 15:00', sender: 'boss', time: '08:15', type: 'received' },
    ]
};

const chats = [
    { id: 'general', name: 'Общий чат', avatar: '👥', lastMsg: 'Привет всем!', time: '10:01' },
    { id: 'friends', name: 'Друзья', avatar: '👥', lastMsg: 'Как дела?', time: '09:30' },
    { id: 'work', name: 'Работа', avatar: '💼', lastMsg: 'Встреча в 15:00', time: '08:15' },
];

// DOM элементы
const chatsList = document.getElementById('chatsList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const currentChatName = document.getElementById('currentChatName');
const currentChatAvatar = document.getElementById('currentChatAvatar');

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker зарегистрирован:', reg))
            .catch(err => console.log('Ошибка Service Worker:', err));
    });
}

// Загрузка сообщений
function loadMessages(chatId) {
    const chatMessages = messages[chatId] || [];
    messagesContainer.innerHTML = '';

    chatMessages.forEach(msg => {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${msg.type}`;
        messageEl.innerHTML = `
            <div class="message-text">${msg.text}</div>
            <div class="message-time">${msg.time}</div>
        `;
        messagesContainer.appendChild(messageEl);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Загрузка списка чатов
function loadChats() {
    chatsList.innerHTML = '';
    chats.forEach(chat => {
        const chatEl = document.createElement('div');
        chatEl.className = `chat-item ${chat.id === currentChat ? 'active' : ''}`;
        chatEl.dataset.chatId = chat.id;
        chatEl.innerHTML = `
            <div class="avatar">${chat.avatar}</div>
            <div class="chat-item-info">
                <div class="chat-item-name">${chat.name}</div>
                <div class="chat-item-lastmsg">${chat.lastMsg}</div>
            </div>
        `;
        chatEl.addEventListener('click', () => switchChat(chat.id));
        chatsList.appendChild(chatEl);
    });
}

// Переключение чата
function switchChat(chatId) {
    currentChat = chatId;
    const chat = chats.find(c => c.id === chatId);
    currentChatName.textContent = chat.name;
    currentChatAvatar.textContent = chat.avatar;
    loadMessages(chatId);
    loadChats(); // Обновляем активный класс
}

// Отправка сообщения
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (!messages[currentChat]) {
        messages[currentChat] = [];
    }

    messages[currentChat].push({
        id: Date.now(),
        text: text,
        sender: 'me',
        time: time,
        type: 'sent'
    });

    // Обновляем последнее сообщение в чате
    const chat = chats.find(c => c.id === currentChat);
    chat.lastMsg = text;
    chat.time = time;

    messageInput.value = '';
    loadMessages(currentChat);
    loadChats();
}

// Обработчики событий
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Инициализация
loadChats();
loadMessages(currentChat);

// Эмуляция получения сообщений
setInterval(() => {
    if (Math.random() > 0.7) { // 30% шанс нового сообщения
        const randomChat = chats[Math.floor(Math.random() * chats.length)];
        if (randomChat.id === currentChat) {
            const now = new Date();
            const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

            messages[randomChat.id].push({
                id: Date.now(),
                text: 'Новое сообщение!',
                sender: 'other',
                time: time,
                type: 'received'
            });

            randomChat.lastMsg = 'Новое сообщение!';
            randomChat.time = time;

            loadMessages(currentChat);
            loadChats();

            // Уведомление
            if (Notification.permission === 'granted') {
                new Notification('Новое сообщение', {
                    body: `В чате ${randomChat.name}`,
                    icon: 'icon-192.png'
                });
            }
        }
    }
}, 10000);

// Запрос разрешения на уведомления
if (Notification.permission === 'default') {
    Notification.requestPermission();
}