require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const { token, welcomeVideo, companyInfo } = require('./config/botConfig');
const { handleMainMenu } = require('./handlers/menuHandler');
const { handleAdmin, showProducts, addProduct, editProduct, deleteProduct, moderateReviews, handleAdminCallback } = require('./handlers/adminHandler');
const { handleCallback, searchProducts } = require('./handlers/productHandler');
const { showProfile } = require('./handlers/profileHandler');
const Visit = require('./models/visit');
const Product = require('./models/product');
const Review = require('./models/review');
const { formatDate } = require('./utils');

const app = express();
const isLocal = process.env.NODE_ENV !== 'production';
const BOT_TOKEN = process.env.BOT_TOKEN || '7998254262:AAEPpbNdFxiTttY4aLrkdNVzlksBIf6lwd8';
const bot = new TelegramBot(BOT_TOKEN, { polling: isLocal });
const ADMIN_ID = process.env.ADMIN_ID || '942851377';

bot.lastMessageId = {};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {})
    .catch(err => process.exit(1));

const setupWebhook = async () => {
    if (isLocal) return;
    const appName = process.env.RENDER_APP_NAME || 'telegram-bot-gmut';
    const WEBHOOK_URL = `https://${appName}.onrender.com/bot${BOT_TOKEN}`;
    const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

    try {
        await axios.get(`${telegramApi}/deleteWebhook`);
        const setResponse = await axios.get(`${telegramApi}/setWebhook?url=${WEBHOOK_URL}&allowed_updates=["message","callback_query","web_app_data"]`);
        if (!setResponse.data.ok) throw new Error('Webhook setup failed');
    } catch (error) {
        process.exit(1);
    }
};

let productCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

app.get('/api/products', async (req, res) => {
    try {
        const now = Date.now();
        if (productCache && now - cacheTimestamp < CACHE_DURATION) return res.json(productCache);

        const products = await Product.find();
        if (!products.length) return res.status(404).json({ error: 'Товары не найдены' });

        const productsWithReviews = await Promise.all(products.map(async (product) => {
            const reviews = await Review.find({ productId: product._id, isApproved: true });
            const averageRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : product.averageRating || 0;
            return { ...product.toObject(), reviews, averageRating };
        }));

        productCache = { products: productsWithReviews, total: products.length };
        cacheTimestamp = now;
        res.json(productCache);
    } catch (error) {
        productCache = null;
        res.status(500).json({ error: 'Ошибка загрузки товаров' });
    }
});

app.get('/api/image/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
        const response = await axios.get(fileUrl, { responseType: 'stream' });
        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.set('Content-Disposition', 'inline');
        res.set('Cache-Control', 'public, max-age=86400');
        response.data.pipe(res);
    } catch (error) {
        res.status(500).json({ error: 'Не удалось загрузить изображение' });
    }
});

app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await Review.find({ isApproved: true }).populate('productId', 'name');
        const formattedReviews = reviews.map(review => ({
            ...review.toObject(),
            productName: review.productId ? review.productId.name : 'Неизвестный товар'
        }));
        res.json({ reviews: formattedReviews, total: formattedReviews.length });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки отзывов' });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const { productId, username, rating, comment, isApproved } = req.body;
        if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ success: false, error: 'Неверный productId' });

        const review = new Review({ userId: 'web_user_' + Date.now(), username: username || 'Аноним', productId, rating, comment, isApproved: isApproved || false });
        await review.save();

        const product = await Product.findById(productId);
        const message = `Новый отзыв на модерации:\nТовар: ${product ? product.name : 'Неизвестный товар'}\nПользователь: ${username || 'Аноним'}\nРейтинг: ${rating}\nКомментарий: ${comment}`;
        await bot.sendMessage(ADMIN_ID, message, {
            reply_markup: { inline_keyboard: [[{ text: 'Одобрить', callback_data: `approve_review_${review._id}` }, { text: 'Отклонить', callback_data: `reject_review_${review._id}` }]] }
        });

        res.json({ success: true, review });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сохранения отзыва' });
    }
});

const mainMenuKeyboard = {
    keyboard: [['Личный кабинет', 'Витрина'], ['Бонусы и продукт', 'Отзывы']],
    resize_keyboard: true,
    one_time_keyboard: false,
    persistent: true
};

// Убрано bot.setMyCommands(mainMenuKeyboard);
// Опционально: bot.setMyCommands([]); // Пустой список команд

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    try {
        const existingVisit = await Visit.findOne({ userId: chatId });
        if (!existingVisit) {
            await Visit.create({ username, userId: chatId });
            await bot.sendVideoNote(chatId, welcomeVideo);
            const welcomeMsg = await bot.sendMessage(chatId, `✨ Добро пожаловать!\n${companyInfo}`, { parse_mode: 'Markdown' });
            bot.lastMessageId[chatId] = welcomeMsg.message_id;
        } else {
            const returnMsg = await bot.sendMessage(chatId, `👋 С возвращением, ${username}!`, { parse_mode: 'Markdown' });
            bot.lastMessageId[chatId] = returnMsg.message_id;
        }
        await handleMainMenu(bot, chatId);
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Ошибка');
    }
});

const webAppUrl = isLocal ? 'http://localhost:3000' : `https://${process.env.RENDER_APP_NAME || 'telegram-bot-gmut'}.onrender.com`;

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (bot.lastMessageId[chatId] && bot.lastMessageId[chatId] !== msg.message_id) {
        try {
            await bot.deleteMessage(chatId, bot.lastMessageId[chatId]);
        } catch (error) {
            if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 400) delete bot.lastMessageId[chatId];
        }
    }

    let newMessage;
    switch (msg.text) {
        case 'Личный кабинет':
            await showProfile(bot, chatId);
            break;
        case 'Витрина':
            newMessage = await bot.sendMessage(chatId, '✅ В новой МОДЕЛИ ПАРТНЕРСКОЙ ПРОГРАММЫ (клубная система)\nв конечную стоимость продукта не входит:\n\n- прибыль компании\n- маркетинговое вознаграждение', {
                reply_markup: { inline_keyboard: [[{ text: '🛒 Открыть витрину:', web_app: { url: `${webAppUrl}/index.html` } }]] }
            });
            bot.lastMessageId[chatId] = newMessage.message_id;
            break;
        case 'Бонусы и продукт':
            newMessage = await bot.sendMessage(chatId, 'ℹ️ Информация о бонусах (в разработке)');
            bot.lastMessageId[chatId] = newMessage.message_id;
            break;
        case 'Отзывы':
            await showReviews(bot, chatId);
            break;
        case '/admin':
            if (chatId.toString() !== ADMIN_ID) {
                newMessage = await bot.sendMessage(chatId, '❌ Доступ только для администратора');
                bot.lastMessageId[chatId] = newMessage.message_id;
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

async function showReviews(bot, chatId, page = 1) {
    const reviewsPerPage = 10;
    try {
        const reviews = await Review.find({ isApproved: true }).populate('productId', 'name').sort({ createdAt: -1 });
        if (!reviews.length) {
            const newMessage = await bot.sendMessage(chatId, '📝 Пока нет подтверждённых отзывов');
            bot.lastMessageId[chatId] = newMessage.message_id;
            return;
        }

        const totalPages = Math.ceil(reviews.length / reviewsPerPage);
        const start = (page - 1) * reviewsPerPage;
        const end = Math.min(start + reviewsPerPage, reviews.length);
        const paginatedReviews = reviews.slice(start, end);

        const reviewList = paginatedReviews.map(r => {
            const productName = r.productId ? r.productId.name : 'Неизвестный товар';
            return `Дата: ${formatDate(r.createdAt)}\nТовар: ${productName}\nПользователь: ${r.username.startsWith('@') ? r.username : '@' + r.username}\nРейтинг: ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}\nКомментарий: ${r.comment}`;
        }).join('\n---\n');

        const inlineKeyboard = totalPages > 1 ? [[
            ...(page > 1 ? [{ text: '⬅️', callback_data: `reviews_page_${page - 1}` }] : []),
            { text: `${page}/${totalPages}`, callback_data: 'noop' },
            ...(page < totalPages ? [{ text: '➡️', callback_data: `reviews_page_${page + 1}` }] : [])
        ]] : [];

        const newMessage = await bot.sendMessage(chatId, `📝 Подтверждённые отзывы (${start + 1}-${end} из ${reviews.length}):\n\n${reviewList}`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: inlineKeyboard }
        });
        bot.lastMessageId[chatId] = newMessage.message_id;
    } catch (error) {
        const newMessage = await bot.sendMessage(chatId, '❌ Ошибка при загрузке отзывов');
        bot.lastMessageId[chatId] = newMessage.message_id;
    }
}

bot.onText(/\/search (.+)/, async (msg, match) => searchProducts(bot, msg.chat.id, match[1]));

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('reviews_page_')) {
        const page = parseInt(data.split('_')[2]);
        await showReviews(bot, chatId, page);
        bot.answerCallbackQuery(callbackQuery.id);
    } else if (data === 'noop') {
        bot.answerCallbackQuery(callbackQuery.id);
    } else {
        await handleCallback(bot, callbackQuery);
        await handleAdminCallback(bot, callbackQuery);
    }
});

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    let data;
    try {
        data = JSON.parse(msg.web_app_data.data);
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Ошибка обработки данных');
        return;
    }

    if (data.type === 'share') {
        const { productId, name, clubPrice, clientPrice, description, image } = data;
        try {
            const product = await Product.findById(productId);
            if (!product) throw new Error('Товар не найден');

            const caption = `✨ *${name}* ✨\n━━━━━━━━━━━━━━━━━━━\n💎 *Клубная цена:* ${clubPrice.toLocaleString()} ₽\n💰 *Клиентская цена:* ${clientPrice.toLocaleString()} ₽\n━━━━━━━━━━━━━━━━━━━\n📝 *Описание:* \n${description || 'Описание отсутствует'}\n━━━━━━━━━━━━━━━━━━━`.trim();
            const newMessage = await bot.sendPhoto(chatId, `${webAppUrl}/api/image/${image}`, { caption, parse_mode: 'Markdown' });
            bot.lastMessageId[chatId] = newMessage.message_id;
        } catch (error) {
            await bot.sendMessage(chatId, '❌ Ошибка при отправке продукта');
        }
    } else if (data.type === 'review') {
        const { productId, rating, comment } = data;
        if (!rating || rating < 1 || rating > 5 || !comment || !mongoose.Types.ObjectId.isValid(productId)) {
            await bot.sendMessage(chatId, '❌ Неверный формат отзыва');
            return;
        }
        try {
            const product = await Product.findById(productId);
            if (!product) throw new Error('Товар не найден');
            const username = msg.from.username ? `@${msg.from.username}` : 'Аноним';
            const review = new Review({ userId: chatId.toString(), username, productId, rating, comment, isApproved: false });
            await review.save();

            const reviews = await Review.find({ productId, isApproved: true });
            const averageRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
            await Product.updateOne({ _id: productId }, { averageRating });

            const message = `Новый отзыв на модерации:\nТовар: ${product.name}\nПользователь: ${username}\nРейтинг: ${rating}\nКомментарий: ${comment}`;
            await bot.sendMessage(ADMIN_ID, message, {
                reply_markup: { inline_keyboard: [[{ text: 'Одобрить', callback_data: `approve_review_${review._id}` }, { text: 'Отклонить', callback_data: `reject_review_${review._id}` }]] }
            });

            const newMessage = await bot.sendMessage(chatId, 'Спасибо за ваш отзыв! Он будет опубликован после модерации.');
            bot.lastMessageId[chatId] = newMessage.message_id;
            productCache = null;
        } catch (error) {
            await bot.sendMessage(chatId, '❌ Ошибка при сохранении отзыва');
        }
    }
});

const startServer = async () => {
    await setupWebhook();
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {});
};

startServer();