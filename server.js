const TelegramBot       = require('node-telegram-bot-api');
const express           = require('express');
const mongoose          = require('mongoose');
const { token, welcomeVideo, companyInfo } = require('./config/botConfig');
const { handleMainMenu } = require('./handlers/menuHandler');
const {
    handleAdmin,
    showStats,
    showProducts,
    addProduct,
    editProduct,
    deleteProduct,
    moderateReviews,
    handleAdminCallback
} = require('./handlers/adminHandler');
const {
    showProducts: showCatalog,
    handleCallback,
    searchProducts
} = require('./handlers/productHandler');
const { showProfile, showOrderHistory } = require('./handlers/profileHandler');
const Visit             = require('./models/visit');
const Product           = require('./models/product');
const Order             = require('./models/order');
const Review            = require('./models/review');
require('dotenv').config();

const app               = express();
const isLocal           = process.env.NODE_ENV !== 'production';
const bot               = new TelegramBot(token, { polling: isLocal });

app.use(express.json());

// Проверка и подключение MongoDB
const mongoUri          = process.env.MONGODB_URI;
if (!mongoUri || (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://'))) {
    console.error('Ошибка: MONGODB_URI не задан или имеет неверный формат');
    process.exit(1);
}
mongoose.connect(mongoUri).then(() => {
    console.log('MongoDB подключен');
}).catch(err => {
    console.error('Ошибка подключения к MongoDB:', err.message);
    process.exit(1);
});

// Настройка Webhook только для production
const setupWebhook      = async () => {
    if (isLocal) {
        console.log('Локальный режим: используется polling');
        return;
    }

    const WEBHOOK_URL   = `https://${process.env.RENDER_APP_NAME}.onrender.com/bot${token}`;
    try {
        await bot.deleteWebhook(); // Удаляем старый webhook
        await bot.setWebHook(WEBHOOK_URL); // Устанавливаем новый
        console.log(`Webhook установлен: ${WEBHOOK_URL}`);
    } catch (error) {
        console.error('Ошибка при установке Webhook:', error.message);
    }
};

// Обработка старта
bot.onText(/\/start/, async (msg) => {
    const chatId        = msg.chat.id;
    const username      = msg.from.username || msg.from.first_name;

    const existingVisit = await Visit.findOne({ userId: chatId });
    if (!existingVisit) {
        await Visit.create({ username, userId: chatId });
        await bot.sendVideoNote(chatId, welcomeVideo);
        await bot.sendMessage(chatId, `
            ✨ Добро пожаловать в наш бот! ✨
            
            ${companyInfo}
            
            Мы рады видеть вас! Выберите пункт меню ниже, чтобы начать:
        `, { parse_mode: 'Markdown' });
    } else {
        await bot.sendMessage(chatId, `
            👋 С возвращением, ${username}!
            
            Выберите пункт меню, чтобы продолжить:
        `, { parse_mode: 'Markdown' });
    }

    handleMainMenu(bot, chatId);
});

// Обработка команд
bot.on('message', (msg) => {
    const chatId        = msg.chat.id;

    switch (msg.text) {
        case 'Личный кабинет':
            showProfile(bot, chatId);
            break;

        case 'Витрина':
            showCatalog(bot, chatId);
            break;

        case 'Бонусы и продукт':
            bot.sendMessage(chatId, 'ℹ️ Информация о бонусах (в разработке)');
            break;

        case 'Отзывы':
            bot.sendMessage(chatId, '📝 Оставьте отзыв через карточку товара');
            break;

        case '/admin':
            handleAdmin(bot, msg);
            break;

        case 'История заказов':
            showOrderHistory(bot, chatId);
            break;

        case 'Назад в меню':
            handleMainMenu(bot, chatId);
            break;

        case 'Статистика':
            showStats(bot, chatId);
            break;

        case 'Список товаров':
            showProducts(bot, chatId);
            break;

        case 'Добавить товар':
            addProduct(bot, chatId);
            break;

        case 'Редактировать товар':
            editProduct(bot, chatId);
            break;

        case 'Удалить товар':
            deleteProduct(bot, chatId);
            break;

        case 'Модерация отзывов':
            moderateReviews(bot, chatId);
            break;
    }

    if (msg.text?.startsWith('/search')) {
        const query     = msg.text.split(' ').slice(1).join(' ');
        searchProducts(bot, chatId, query);
    }
});

// Обработка callback-запросов
bot.on('callback_query', (callbackQuery) => {
    handleCallback(bot, callbackQuery);
    handleAdminCallback(bot, callbackQuery);
});

// Webhook endpoint
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Инициализация тестовых данных
const initData = async () => {
    if (await Product.countDocuments() === 0) {
        await Product.create([
            {
                name:           'Продукт 1',
                description:    'Качественный товар',
                category:       'Электроника',
                clientPrice:    1000,
                clubPrice:      800,
                image:          './public/product1.jpg',
                certificates:   ['./public/cert1.jpg'],
                stock:          10
            },
            {
                name:           'Продукт 2',
                description:    'Еще один товар',
                category:       'Бытовая техника',
                clientPrice:    1500,
                clubPrice:      1200,
                image:          './public/product2.jpg',
                certificates:   ['./public/cert2.jpg'],
                stock:          5
            },
            {
                name:           'Продукт 3',
                description:    'Третий товар',
                category:       'Электроника',
                clientPrice:    2000,
                clubPrice:      1600,
                image:          './public/product3.jpg',
                certificates:   ['./public/cert3.jpg'],
                stock:          8
            },
            {
                name:           'Продукт 4',
                description:    'Четвертый товар',
                category:       'Бытовая техника',
                clientPrice:    2500,
                clubPrice:      2000,
                image:          './public/product4.jpg',
                certificates:   ['./public/cert4.jpg'],
                stock:          7
            }
        ]);
    }
};

// Запуск сервера
const startServer = async () => {
    await setupWebhook();
    await initData();

    app.get('/', (req, res) => res.send('Bot is running'));
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();