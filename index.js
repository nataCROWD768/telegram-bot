const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const ExcelJS = require('exceljs');
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
const { handleCallback, searchProducts } = require('./handlers/productHandler');
const { showProfile } = require('./handlers/profileHandler');
const Visit = require('./models/visit');
const Product = require('./models/product');
const Review = require('./models/review');
const initialProducts = require('./data/products');
require('dotenv').config();

const app = express();
const isLocal = process.env.NODE_ENV !== 'production';
const BOT_TOKEN = process.env.TOKEN || '7998254262:AAEPpbNdFxiTttY4aLrkdNVzlksBIf6lwd8'; // Явный fallback
const bot = new TelegramBot(BOT_TOKEN, { polling: isLocal });
const ADMIN_ID = process.env.ADMIN_ID || '942851377';

let lastMessageId = {};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => console.log(`Раздача файла: ${filePath}`)
}));

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB подключен'))
    .catch(err => {
        console.error('Ошибка подключения к MongoDB:', err.message);
        process.exit(1);
    });

// Настройка Webhook
const setupWebhook = async () => {
    if (isLocal) {
        console.log('Локальный режим: polling активен');
        return;
    }
    const appName = process.env.RENDER_APP_NAME;
    if (!appName) {
        console.error('Ошибка: RENDER_APP_NAME не задан в переменных окружения');
        process.exit(1);
    }
    if (!BOT_TOKEN) {
        console.error('Ошибка: TOKEN не задан или пустой');
        process.exit(1);
    }
    const WEBHOOK_URL = `https://${appName}.onrender.com/bot${BOT_TOKEN}`;
    const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;
    console.log(`Попытка установить webhook: ${WEBHOOK_URL}`);

    try {
        // Удаляем старый webhook
        const deleteResponse = await axios.get(`${telegramApi}/deleteWebhook`);
        console.log('Старый webhook удалён:', deleteResponse.data);

        // Устанавливаем новый webhook
        const setResponse = await axios.get(`${telegramApi}/setWebHook?url=${WEBHOOK_URL}`);
        if (setResponse.data.ok) {
            console.log(`Webhook успешно установлен: ${WEBHOOK_URL}`);
        } else {
            console.error('Ошибка установки webhook:', setResponse.data);
            process.exit(1);
        }
    } catch (error) {
        console.error('Ошибка настройки webhook:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
};

// Синхронизация товаров
const syncProducts = async () => {
    try {
        await Product.deleteMany({});
        console.log('Коллекция products очищена');
        for (const productData of initialProducts) {
            const newProduct = await Product.create(productData);
            console.log('Добавлен новый товар:', newProduct);
        }
        console.log('Товары синхронизированы');
    } catch (error) {
        console.error('Ошибка синхронизации товаров:', error.message);
    }
};

// API для получения товаров
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        console.log('Найденные товары для API:', products);
        const productsWithReviews = await Promise.all(products.map(async (product) => {
            const reviews = await Review.find({ productId: product._id, isApproved: true });
            return { ...product.toObject(), reviews };
        }));
        console.log('Отправка данных товаров клиенту:', productsWithReviews);
        res.json({ products: productsWithReviews, total: products.length });
    } catch (error) {
        console.error('Ошибка API /api/products:', error.message);
        res.status(500).json({ error: 'Ошибка загрузки товаров' });
    }
});

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    try {
        const existingVisit = await Visit.findOne({ userId: chatId });
        if (!existingVisit) {
            await Visit.create({ username, userId: chatId });
            await bot.sendVideoNote(chatId, welcomeVideo);
            const welcomeMsg = await bot.sendMessage(chatId, `✨ Добро пожаловать!\n${companyInfo}`, { parse_mode: 'Markdown' });
            lastMessageId[chatId] = welcomeMsg.message_id;
        } else {
            const returnMsg = await bot.sendMessage(chatId, `👋 С возвращением, ${username}!`, { parse_mode: 'Markdown' });
            lastMessageId[chatId] = returnMsg.message_id;
        }
        await handleMainMenu(bot, chatId);
    } catch (error) {
        console.error('Ошибка /start:', error.message);
        await bot.sendMessage(chatId, '❌ Ошибка');
    }
});

const webAppUrl = isLocal ? 'http://localhost:3000' : `https://${process.env.RENDER_APP_NAME}.onrender.com`;

// Обработка сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    console.log(`Сообщение: "${msg.text}" от ${msg.from.username}`);

    if (lastMessageId[chatId] && lastMessageId[chatId] !== msg.message_id) {
        try {
            await bot.deleteMessage(chatId, lastMessageId[chatId]);
        } catch (error) {
            console.error('Ошибка удаления сообщения:', error);
        }
    }

    let newMessage;
    switch (msg.text) {
        case 'Личный кабинет':
            await showProfile(bot, chatId);
            break;
        case 'Витрина':
            newMessage = await bot.sendMessage(chatId, '🛒 Открыть витрину:', {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Перейти', web_app: { url: `${webAppUrl}/index.html` } }]]
                }
            });
            lastMessageId[chatId] = newMessage.message_id;
            break;
        case 'Бонусы и продукт':
            newMessage = await bot.sendMessage(chatId, 'ℹ️ Информация о бонусах (в разработке)');
            lastMessageId[chatId] = newMessage.message_id;
            break;
        case 'Отзывы':
            const reviews = await Review.find().populate('productId', 'name');
            if (reviews.length === 0) {
                newMessage = await bot.sendMessage(chatId, '📝 Отзывов пока нет');
            } else {
                const reviewList = reviews.map(r =>
                    `Товар: ${r.productId.name}\n` +
                    `Пользователь: ${r.username}\n` +
                    `Рейтинг: ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}\n` +
                    `Комментарий: ${r.comment}\n` +
                    `Статус: ${r.isApproved ? 'Утверждён' : 'На модерации'}\n`
                ).join('\n---\n');
                newMessage = await bot.sendMessage(chatId, `📝 Все отзывы:\n\n${reviewList}`, { parse_mode: 'Markdown' });
            }
            lastMessageId[chatId] = newMessage.message_id;
            break;
        case '/admin':
            if (chatId.toString() !== ADMIN_ID) {
                newMessage = await bot.sendMessage(chatId, '❌ Доступ только для администратора');
                lastMessageId[chatId] = newMessage.message_id;
                return;
            }
            await handleAdmin(bot, msg);
            break;
        case 'Назад в меню':
            await handleMainMenu(bot, chatId);
            break;
        case 'Модерация отзывов':
            if (chatId.toString() !== ADMIN_ID) return;
            await moderateReviews(bot, chatId);
            break;
        case 'Показать товары':
            if (chatId.toString() !== ADMIN_ID) return;
            await showProducts(bot, chatId);
            break;
        case 'Добавить товар':
            if (chatId.toString() !== ADMIN_ID) return;
            await addProduct(bot, chatId);
            break;
        case 'Редактировать товар':
            if (chatId.toString() !== ADMIN_ID) return;
            await editProduct(bot, chatId);
            break;
        case 'Удалить товар':
            if (chatId.toString() !== ADMIN_ID) return;
            await deleteProduct(bot, chatId);
            break;
    }
});

// Обработка callback-запросов
bot.on('callback_query', (callbackQuery) => {
    console.log(`Callback: ${callbackQuery.data}`);
    handleCallback(bot, callbackQuery);
    handleAdminCallback(bot, callbackQuery);
});

// Webhook-обработчик
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    console.log('Webhook получил данные:', JSON.stringify(req.body, null, 2));
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Обработка данных от Web App
bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    const data = JSON.parse(msg.web_app_data.data);
    console.log('Получены данные от Web App:', data);

    if (data.type === 'review') {
        const { productId, rating, comment } = data;
        console.log('Попытка сохранить отзыв:', { productId, rating, comment });
        if (!rating || rating < 1 || rating > 5 || !comment || !productId) {
            console.log('Ошибка валидации отзыва:', { productId, rating, comment });
            await bot.sendMessage(chatId, '❌ Неверный формат отзыва');
            return;
        }
        try {
            const product = await Product.findById(productId);
            if (!product) {
                console.log('Товар не найден:', productId);
                await bot.sendMessage(chatId, '❌ Товар не найден');
                return;
            }
            const review = new Review({
                userId: chatId.toString(),
                username: msg.from.username || 'Аноним',
                productId,
                rating,
                comment,
                isApproved: false
            });
            await review.save();
            console.log('Отзыв сохранён:', review);

            const reviews = await Review.find({ productId, isApproved: true });
            const averageRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;
            await Product.updateOne({ _id: productId }, { averageRating });

            const newMessage = await bot.sendMessage(chatId, 'Спасибо за ваш отзыв! Он будет опубликован после модерации.');
            lastMessageId[chatId] = newMessage.message_id;
        } catch (error) {
            console.error('Ошибка сохранения отзыва:', error.stack);
            await bot.sendMessage(chatId, '❌ Ошибка при сохранении отзыва');
        }
    }
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