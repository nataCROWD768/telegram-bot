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

// Удаляем bot.lastMessageId, так как он больше не нужен
// bot.lastMessageId = {};

function escapeMarkdown(text) {
    if (!text) return text;
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

bot.deleteMyCommands()
    .then(() => console.log('Команды бота удалены, кнопка "Меню" скрыта'))
    .catch(err => console.error('Ошибка при удалении команд:', err));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Подключение к MongoDB успешно'))
    .catch(err => {
        console.error('Ошибка подключения к MongoDB:', err);
        process.exit(1);
    });

// Код настройки Webhook оставляем без изменений
const setupWebhook = async () => {
    if (isLocal) {
        console.log('Локальный режим: используется polling');
        return;
    }
    const appName = process.env.RENDER_APP_NAME || 'telegram-bot-gmut';
    const WEBHOOK_URL = `https://${appName}.onrender.com/bot${BOT_TOKEN}`;
    const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

    try {
        const deleteResponse = await axios.get(`${telegramApi}/deleteWebhook`);
        console.log('Старый Webhook удалён:', deleteResponse.data);

        const allowedUpdates = ["message", "callback_query"];
        const url = `${telegramApi}/setWebhook?url=${encodeURIComponent(WEBHOOK_URL)}&allowed_updates=${encodeURIComponent(JSON.stringify(allowedUpdates))}`;
        const setResponse = await axios.get(url);
        if (!setResponse.data.ok) throw new Error('Webhook setup failed: ' + setResponse.data.description);
        console.log('Webhook успешно настроен:', WEBHOOK_URL, 'с allowed_updates:', allowedUpdates);

        const webhookInfo = await axios.get(`${telegramApi}/getWebhookInfo`);
        console.log('Текущая информация о Webhook:', webhookInfo.data);
    } catch (error) {
        console.error('Ошибка настройки Webhook:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
};

// Остальные маршруты API остаются без изменений
app.post('/api/share-product', async (req, res) => {
    const { chatId, productId, name, clubPrice, clientPrice, description, image } = req.body;

    if (!chatId || !productId) {
        return res.status(400).json({ error: 'chatId и productId обязательны' });
    }

    try {
        const product = await Product.findById(productId);
        if (!product) throw new Error('Товар не найден');

        const botUsername = 'nataCROWD768_bot';
        // Убираем escapeMarkdown для name, используем его только для description
        const escapedDescription = escapeMarkdown(description || 'Описание отсутствует');

        const caption = `
✨ *${name.toUpperCase()}* ✨  
➖➖➖➖➖➖➖➖➖➖➖➖  
💎 *Клубная цена:* __${clubPrice.toLocaleString()} ₽__  
💰 *Клиентская цена:* __${clientPrice.toLocaleString()} ₽__  
➖➖➖➖➖➖➖➖➖➖➖➖  
📖 *О продукте:*  
${escapedDescription}  
➖➖➖➖➖➖➖➖➖➖➖➖  
[© Radar GP Assistant](https://t.me/${botUsername})
        `.trim();

        await bot.sendMessage(chatId, caption, {
            parse_mode: 'Markdown',
            reply_markup: mainMenuKeyboard
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка при шаринге продукта:', error.message);
        res.status(500).json({ error: 'Ошибка при отправке продукта' });
    }
});

function escapeMarkdown(text) {
    if (!text) return text;
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

app.post('/api/reviews', async (req, res) => {
    const { productId, username, rating, comment, isApproved } = req.body;

    if (!productId || !username || !rating || !comment) {
        return res.status(400).json({ success: false, error: 'Все поля обязательны' });
    }

    try {
        const review = new Review({
            userId: `web_user_${Date.now()}`,
            username,
            productId,
            rating,
            comment,
            isApproved: isApproved || false
        });

        await review.save();

        const adminId = process.env.ADMIN_ID || '942851377';
        const product = await Product.findById(productId);
        const productName = product ? product.name : 'Неизвестный товар';
        await bot.sendMessage(adminId, `Новый отзыв на модерации:\nТовар: ${productName}\nПользователь: ${username}\nРейтинг: ${rating}\nКомментарий: ${comment}`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Одобрить', callback_data: `approve_review_${review._id}` },
                        { text: 'Отклонить', callback_data: `reject_review_${review._id}` }
                    ]
                ]
            }
        });

        res.json({ success: true, message: 'Отзыв отправлен на модерацию' });
    } catch (error) {
        console.error('Ошибка при сохранении отзыва:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    console.log('Получен запрос на Webhook:', req.body);
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

const mainMenuKeyboard = {
    keyboard: [['Личный кабинет', 'Витрина'], ['Бонусы и продукт', 'Отзывы']],
    resize_keyboard: true,
    one_time_keyboard: false,
    persistent: true
};

// Удаляем функцию ensureMainMenu, так как она больше не нужна
/*
async function ensureMainMenu(chatId) {
    const menuMsg = await bot.sendMessage(chatId, '.', { reply_markup: mainMenuKeyboard });
    bot.lastMessageId[chatId] = menuMsg.message_id;
}
*/

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    try {
        const existingVisit = await Visit.findOne({ userId: chatId });
        if (!existingVisit) {
            await Visit.create({ username, userId: chatId });
        }

        await bot.sendMessage(chatId, `👋 С возвращением, ${username}!`, {
            parse_mode: 'Markdown',
            reply_markup: mainMenuKeyboard
        });
    } catch (error) {
        console.error('Ошибка при /start:', error);
        await bot.sendMessage(chatId, '❌ Ошибка', { reply_markup: mainMenuKeyboard });
    }
});

const webAppUrl = isLocal ? 'http://localhost:3000' : `https://${process.env.RENDER_APP_NAME || 'telegram-bot-gmut'}.onrender.com`;

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    // Проверяем, что сообщение пришло из приватного чата
    if (msg.chat.type !== 'private') {
        return; // Игнорируем сообщения из групп и супергрупп
    }

    if (msg.text === '/start') return;

    switch (msg.text) {
        case 'Личный кабинет':
            await showProfile(bot, msg);
            break;
        case 'Витрина':
            await bot.sendMessage(chatId, '✅ В новой МОДЕЛИ ПАРТНЕРСКОЙ ПРОГРАММЫ (клубная система)\nв конечную стоимость продукта не входит:\n\n- прибыль компании\n- маркетинговое вознаграждение', {
                reply_markup: {
                    inline_keyboard: [[{ text: '🛒 Открыть витрину:', web_app: { url: `${webAppUrl}/index.html` } }]]
                }
            });
            break;
        case 'Бонусы и продукт':
            await bot.sendMessage(chatId, 'ℹ️ Информация о бонусах (в разработке)', { reply_markup: mainMenuKeyboard });
            break;
        case 'Отзывы':
            await showReviews(bot, chatId);
            break;
        case '/admin':
            if (chatId.toString() !== ADMIN_ID) {
                await bot.sendMessage(chatId, '❌ Доступ только для администратора', { reply_markup: mainMenuKeyboard });
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
        default:
            await bot.sendMessage(chatId, 'Выберите действие из меню:', { reply_markup: mainMenuKeyboard });
            break;
    }
});

async function showReviews(bot, chatId, page = 1) {
    const reviewsPerPage = 5;
    try {
        const reviews = await Review.find({ isApproved: true }).populate('productId', 'name').sort({ createdAt: -1 });
        if (!reviews.length) {
            await bot.sendMessage(chatId, '📝 Пока нет подтверждённых отзывов', { reply_markup: mainMenuKeyboard });
            return;
        }

        const totalPages = Math.ceil(reviews.length / reviewsPerPage);
        const start = (page - 1) * reviewsPerPage;
        const end = Math.min(start + reviewsPerPage, reviews.length);
        const paginatedReviews = reviews.slice(start, end);

        const reviewList = paginatedReviews.map(r => {
            const productName = r.productId ? r.productId.name : 'Неизвестный товар';
            return `Дата: ${formatDate(r.createdAt)}\nТовар: ${productName}\nПользователь: ${r.username.startsWith('@') ? r.username : '@' + r.username}\nРейтинг: ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}\nКомментарий: ${r.comment}`;
        }).join('\n➖➖➖➖➖➖➖➖➖➖➖➖\n'); // Заменяем разделитель

        const inlineKeyboard = totalPages > 1 ? [[
            ...(page > 1 ? [{ text: '⬅️', callback_data: `reviews_page_${page - 1}` }] : []),
            { text: `${page}/${totalPages}`, callback_data: 'noop' },
            ...(page < totalPages ? [{ text: '➡️', callback_data: `reviews_page_${page + 1}` }] : [])
        ]] : [];

        await bot.sendMessage(chatId, `📝 Подтверждённые отзывы (${start + 1}-${end} из ${reviews.length}):\n\n${reviewList}`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: inlineKeyboard }
        });
    } catch (error) {
        console.error('Ошибка при загрузке отзывов:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при загрузке отзывов', { reply_markup: mainMenuKeyboard });
    }
}

bot.onText(/\/reviews (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const page = parseInt(match[1]);
    await showReviews(bot, chatId, page);
});

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
    } else if (data.startsWith('approve_review_') || data.startsWith('reject_review_')) {
        await handleAdminCallback(bot, callbackQuery);
        await bot.sendMessage(chatId, 'Действие выполнено.', { reply_markup: mainMenuKeyboard });
    } else {
        await handleCallback(bot, callbackQuery);
    }
});

// Остальные маршруты и запуск сервера остаются без изменений
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        if (!products.length) return res.status(404).json({ error: 'Товары не найдены' });

        const productsWithReviews = await Promise.all(products.map(async (product) => {
            const reviews = await Review.find({ productId: product._id, isApproved: true });
            const averageRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : product.averageRating || 0;
            return { ...product.toObject(), reviews, averageRating };
        }));

        res.json({ products: productsWithReviews, total: products.length });
    } catch (error) {
        console.error('Ошибка загрузки продуктов:', error);
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
        console.error('Ошибка загрузки изображения:', error);
        res.status(500).json({ error: 'Не удалось загрузить изображение' });
    }
});

const startServer = async () => {
    await setupWebhook();
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
};

startServer();