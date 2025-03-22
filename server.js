const TelegramBot       = require('node-telegram-bot-api');
const express           = require('express');
const mongoose          = require('mongoose');
const axios             = require('axios');
const path              = require('path');
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
    handleCallback,
    searchProducts
} = require('./handlers/productHandler');
const { showProfile, showOrderHistory } = require('./handlers/profileHandler');
const Visit             = require('./models/visit');
const Product           = require('./models/product');
const Order             = require('./models/order');
const Review            = require('./models/review');
const initialProducts   = require('./data/products');
require('dotenv').config();

const app               = express();
const isLocal           = process.env.NODE_ENV !== 'production';
const bot               = new TelegramBot(token, { polling: isLocal });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Раздача статических файлов

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

// Настройка Webhook через HTTP-запросы
const setupWebhook      = async () => {
    if (isLocal) {
        console.log('Локальный режим: используется polling');
        return;
    }

    const appName       = process.env.RENDER_APP_NAME;
    if (!appName) {
        console.error('Ошибка: RENDER_APP_NAME не задан в переменных окружения');
        process.exit(1);
    }

    const WEBHOOK_URL   = `https://${appName}.onrender.com/bot${token}`;
    const telegramApi   = `https://api.telegram.org/bot${token}`;

    try {
        console.log('Удаление старого webhook...');
        const deleteResponse = await axios.get(`${telegramApi}/deleteWebhook`);
        console.log('Ответ от deleteWebhook:', JSON.stringify(deleteResponse.data));

        console.log(`Установка нового webhook на ${WEBHOOK_URL}...`);
        const setResponse = await axios.get(`${telegramApi}/setWebHook?url=${WEBHOOK_URL}`);
        console.log('Ответ от setWebHook:', JSON.stringify(setResponse.data));

        if (setResponse.data.ok) {
            console.log(`Webhook успешно установлен: ${WEBHOOK_URL}`);
        } else {
            console.error('Не удалось установить webhook:', setResponse.data.description);
            process.exit(1);
        }
    } catch (error) {
        console.error('Ошибка при установке Webhook:', error.message);
        if (error.response) {
            console.error('Детали ошибки:', JSON.stringify(error.response.data));
        }
        process.exit(1);
    }
};

// Синхронизация товаров из data/products.js с MongoDB
const syncProducts = async () => {
    try {
        const existingProducts = await Product.find();
        const existingNames    = existingProducts.map(p => p.name);

        for (const productData of initialProducts) {
            if (!existingNames.includes(productData.name)) {
                await Product.create(productData);
            } else {
                await Product.updateOne({ name: productData.name }, productData);
            }
        }
        console.log('Товары синхронизированы с data/products.js');
    } catch (error) {
        console.error('Ошибка при синхронизации товаров:', error.message);
    }
};

// API для получения товаров
app.get('/api/products', async (req, res) => {
    const page  = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    try {
        const total    = await Product.countDocuments();
        const products = await Product.find()
            .skip((page - 1) * limit)
            .limit(limit);
        res.json({ products, total });
    } catch (error) {
        console.error('Ошибка API /api/products:', error.message);
        res.status(500).json({ error: 'Ошибка загрузки товаров' });
    }
});

// Обработка старта
bot.onText(/\/start/, async (msg) => {
    const chatId        = msg.chat.id;
    const username      = msg.from.username || msg.from.first_name;

    console.log(`Получена команда /start от ${username} (chatId: ${chatId})`);
    try {
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
    } catch (error) {
        console.error('Ошибка при обработке /start:', error.message);
        await bot.sendMessage(chatId, '❌ Произошла ошибка, попробуйте позже');
    }
});

// Обработка команд
bot.on('message', (msg) => {
    const chatId        = msg.chat.id;
    console.log(`Получено сообщение: "${msg.text}" от ${msg.from.username}`);

    switch (msg.text) {
        case 'Личный кабинет':
            showProfile(bot, chatId);
            break;

        case 'Витрина':
            const webAppUrl = isLocal ? 'http://localhost:3000' : `https://${process.env.RENDER_APP_NAME}.onrender.com`;
            bot.sendMessage(chatId, '🛒 Откройте витрину товаров:', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Открыть витрину', web_app: { url: webAppUrl } }
                    ]]
                }
            });
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
    console.log(`Получен callback: ${callbackQuery.data}`);
    handleCallback(bot, callbackQuery);
    handleAdminCallback(bot, callbackQuery);
});

// Webhook endpoint с отладкой
app.post(`/bot${token}`, (req, res) => {
    console.log('Получен запрос на webhook:', JSON.stringify(req.body, null, 2));
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Запуск сервера
const startServer = async () => {
    await setupWebhook();
    await syncProducts();

    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();