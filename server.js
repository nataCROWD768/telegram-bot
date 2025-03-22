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

// ID администратора (замените на свой Telegram ID)
const ADMIN_ID = process.env.ADMIN_ID || 'YOUR_ADMIN_ID_HERE';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        console.log(`Раздача файла: ${filePath}`);
    }
}));

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('MongoDB подключен');
}).catch(err => {
    console.error('Ошибка подключения к MongoDB:', err.message);
    process.exit(1);
});

const setupWebhook = async () => {
    if (isLocal) return console.log('Локальный режим: polling');
    const appName = process.env.RENDER_APP_NAME;
    const WEBHOOK_URL = `https://${appName}.onrender.com/bot${token}`;
    const telegramApi = `https://api.telegram.org/bot${token}`;

    try {
        await axios.get(`${telegramApi}/deleteWebhook`);
        const setResponse = await axios.get(`${telegramApi}/setWebHook?url=${WEBHOOK_URL}`);
        console.log(setResponse.data.ok ? `Webhook установлен: ${WEBHOOK_URL}` : 'Ошибка установки webhook');
    } catch (error) {
        console.error('Ошибка webhook:', error.message);
        process.exit(1);
    }
};

const syncProducts = async () => {
    try {
        const existingProducts = await Product.find();
        const existingNames = existingProducts.map(p => p.name);
        for (const productData of initialProducts) {
            if (!existingNames.includes(productData.name)) {
                await Product.create(productData);
            } else {
                await Product.updateOne({ name: productData.name }, productData);
            }
        }
        console.log('Товары синхронизированы');
    } catch (error) {
        console.error('Ошибка синхронизации товаров:', error.message);
    }
};

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        const productsWithReviews = await Promise.all(products.map(async (product) => {
            const reviews = await Review.find({ productId: product._id, isApproved: true });
            return { ...product.toObject(), reviews };
        }));
        res.json({ products: productsWithReviews, total: products.length });
    } catch (error) {
        console.error('Ошибка API /api/products:', error.message);
        res.status(500).json({ error: 'Ошибка загрузки товаров' });
    }
});

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    try {
        const existingVisit = await Visit.findOne({ userId: chatId });
        if (!existingVisit) {
            await Visit.create({ username, userId: chatId });
            await bot.sendVideoNote(chatId, welcomeVideo);
            await bot.sendMessage(chatId, `✨ Добро пожаловать!\n${companyInfo}\nВыберите пункт меню:`, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, `👋 С возвращением, ${username}!\nВыберите пункт меню:`, { parse_mode: 'Markdown' });
        }
        handleMainMenu(bot, chatId);
    } catch (error) {
        console.error('Ошибка /start:', error.message);
        await bot.sendMessage(chatId, '❌ Ошибка');
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const webAppUrl = isLocal ? 'http://localhost:3000' : `https://${process.env.RENDER_APP_NAME}.onrender.com`;
    console.log(`Сообщение: "${msg.text}" от ${msg.from.username}`);

    switch (msg.text) {
        case 'Личный кабинет':
            showProfile(bot, chatId);
            break;
        case 'Витрина':
            await bot.sendMessage(chatId, '🛒 Загрузка витрины...', {
                reply_markup: { inline_keyboard: [[{ text: 'Открыть витрину', web_app: { url: `${webAppUrl}/index.html` } }]] }
            });
            break;
        case 'Бонусы и продукт':
            bot.sendMessage(chatId, 'ℹ️ Информация о бонусах (в разработке)');
            break;
        case 'Отзывы':
            const reviews = await Review.find().populate('productId', 'name');
            if (reviews.length === 0) {
                await bot.sendMessage(chatId, '📝 Отзывов пока нет');
            } else {
                const reviewList = reviews.map(r =>
                    `Товар: ${r.productId.name}\n` +
                    `Пользователь: ${r.username}\n` +
                    `Рейтинг: ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}\n` +
                    `Комментарий: ${r.comment}\n` +
                    `Статус: ${r.isApproved ? 'Утверждён' : 'На модерации'}\n`
                ).join('\n---\n');
                await bot.sendMessage(chatId, `📝 Все отзывы:\n\n${reviewList}`, { parse_mode: 'Markdown' });
            }
            break;
        case '/admin':
            if (chatId.toString() !== ADMIN_ID) {
                await bot.sendMessage(chatId, '❌ Доступ только для администратора');
                return;
            }
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
            if (chatId.toString() !== ADMIN_ID) return;
            await moderateReviews(bot, chatId);
            break;
    }

    if (msg.text?.startsWith('/search')) {
        const query = msg.text.split(' ').slice(1).join(' ');
        searchProducts(bot, chatId, query);
    }
});

bot.on('callback_query', (callbackQuery) => {
    console.log(`Callback: ${callbackQuery.data}`);
    handleCallback(bot, callbackQuery);
    handleAdminCallback(bot, callbackQuery);
});

app.post(`/bot${token}`, (req, res) => {
    console.log('Webhook:', JSON.stringify(req.body, null, 2));
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    const data = JSON.parse(msg.web_app_data.data);
    console.log('Данные от Web App:', data);

    if (data.type === 'order') {
        const { productId, quantity } = data;
        const product = await Product.findById(productId);
        if (!product || quantity <= 0) {
            await bot.sendMessage(chatId, '❌ Ошибка заказа');
            return;
        }
        const order = await Order.create({
            userId: chatId,
            username: msg.from.username,
            productId,
            quantity,
            totalPrice: quantity * product.clubPrice
        });
        product.stock -= quantity;
        await product.save();
        await bot.sendMessage(chatId, `✅ Заказ оформлен! Товар: ${product.name}, Сумма: ${order.totalPrice} руб.`);
    }

    if (data.type === 'review') {
        const { productId, rating, comment } = data;
        console.log('Попытка сохранить отзыв:', { productId, rating, comment });
        if (!rating || rating < 1 || rating > 5 || !comment) {
            console.log('Ошибка валидации отзыва');
            await bot.sendMessage(chatId, '❌ Неверный формат отзыва');
            return;
        }
        try {
            const review = await Review.create({
                userId: chatId,
                username: msg.from.username || 'Аноним',
                productId,
                rating,
                comment,
                isApproved: false
            });
            console.log('Отзыв сохранён:', review);
            await bot.sendMessage(chatId, 'Спасибо за ваш отзыв! Он будет опубликован после модерации.');
        } catch (error) {
            console.error('Ошибка сохранения отзыва:', error.message);
            await bot.sendMessage(chatId, '❌ Ошибка при сохранении отзыва');
        }
    }
});

const startServer = async () => {
    await setupWebhook();
    await syncProducts();
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();