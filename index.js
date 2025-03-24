require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
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

// Инициализация Express
const app = express();
const isLocal = process.env.NODE_ENV !== 'production';
const BOT_TOKEN = process.env.BOT_TOKEN || '7998254262:AAEPpbNdFxiTttY4aLrkdNVzlksBIf6lwd8';
const bot = new TelegramBot(BOT_TOKEN, { polling: isLocal });
const ADMIN_ID = process.env.ADMIN_ID || '942851377';

// Инициализируем lastMessageId как свойство бота
bot.lastMessageId = {};

// Функция форматирования даты на русском языке с проверкой
const formatDate = (date) => {
    if (!date || isNaN(new Date(date).getTime())) {
        return 'Дата неизвестна';
    }
    const months = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    const d = new Date(date);
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
};

// Настройка Express
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

// Настройка Webhook с allowed_updates
const setupWebhook = async () => {
    if (isLocal) {
        console.log('Локальный режим: polling активен');
        return;
    }
    const appName = process.env.RENDER_APP_NAME || 'telegram-bot-gmut';
    const WEBHOOK_URL = `https://${appName}.onrender.com/bot${BOT_TOKEN}`;
    const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;
    console.log(`Попытка установить Webhook: ${WEBHOOK_URL}`);

    try {
        const deleteResponse = await axios.get(`${telegramApi}/deleteWebhook`);
        console.log('Результат удаления старого Webhook:', deleteResponse.data);

        // Указываем allowed_updates, чтобы включить web_app_data
        const setResponse = await axios.get(`${telegramApi}/setWebhook?url=${WEBHOOK_URL}&allowed_updates=["message","callback_query","web_app_data"]`);
        console.log('Результат установки Webhook:', setResponse.data);
        if (!setResponse.data.ok) {
            throw new Error(`Не удалось установить Webhook: ${setResponse.data.description}`);
        }

        const webhookInfo = await axios.get(`${telegramApi}/getWebhookInfo`);
        console.log('Текущая информация о Webhook:', webhookInfo.data);
    } catch (error) {
        console.error('Ошибка настройки Webhook:', error.message);
        process.exit(1);
    }
};

// Кэширование для маршрута /api/products
let productCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

app.get('/api/products', async (req, res) => {
    console.log('Получен запрос на /api/products');
    try {
        const now = Date.now();
        if (productCache && now - cacheTimestamp < CACHE_DURATION) {
            console.log('Возвращаем данные из кэша');
            return res.json(productCache);
        }

        const products = await Product.find();
        if (!products || products.length === 0) {
            console.log('Товары не найдены в базе данных');
            return res.status(404).json({ error: 'Товары не найдены' });
        }
        const productsWithReviews = await Promise.all(products.map(async (product) => {
            const reviews = await Review.find({ productId: product._id, isApproved: true });
            console.log(`Отзывы для продукта ${product.name}:`, reviews);
            const averageRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : product.averageRating || 0;
            return { ...product.toObject(), reviews, averageRating };
        }));
        console.log('Отправка данных клиенту:', productsWithReviews);

        productCache = { products: productsWithReviews, total: products.length };
        cacheTimestamp = now;
        res.json(productCache);
    } catch (error) {
        console.error('Ошибка API /api/products:', error.stack);
        res.status(500).json({ error: 'Ошибка загрузки товаров' });
    }
});

// Эндпоинт для получения URL изображения по file_id
app.get('/api/image/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
        res.redirect(fileUrl);
    } catch (error) {
        console.error('Ошибка получения изображения:', error);
        res.status(500).json({ error: 'Не удалось загрузить изображение' });
    }
});

app.get('/api/reviews', async (req, res) => {
    console.log('Получен запрос на /api/reviews');
    try {
        const reviews = await Review.find({ isApproved: true }).populate('productId', 'name');
        console.log('Все подтверждённые отзывы:', reviews);
        const formattedReviews = reviews.map(review => ({
            ...review.toObject(),
            productName: review.productId ? review.productId.name : 'Неизвестный товар'
        }));
        res.json({ reviews: formattedReviews, total: formattedReviews.length });
    } catch (error) {
        console.error('Ошибка API /api/reviews:', error.stack);
        res.status(500).json({ error: 'Ошибка загрузки отзывов' });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const { productId, username, rating, comment, isApproved } = req.body;
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, error: 'Неверный productId' });
        }
        const review = new Review({
            userId: 'web_user_' + Date.now(),
            username: username || 'Аноним',
            productId,
            rating,
            comment,
            isApproved: isApproved || false
        });
        await review.save();
        console.log('Отзыв сохранён из веб-интерфейса:', review);

        const product = await Product.findById(productId);
        const message = `Новый отзыв на модерации:\nТовар: ${product ? product.name : 'Неизвестный товар'}\nПользователь: ${username || 'Аноним'}\nРейтинг: ${rating}\nКомментарий: ${comment}`;
        await bot.sendMessage(ADMIN_ID, message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Одобрить', callback_data: `approve_review_${review._id}` },
                        { text: 'Отклонить', callback_data: `reject_review_${review._id}` }
                    ]
                ]
            }
        });

        res.json({ success: true, review });
    } catch (error) {
        console.error('Ошибка сохранения отзыва:', error);
        res.status(500).json({ success: false, error: 'Ошибка сохранения отзыва' });
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
            bot.lastMessageId[chatId] = welcomeMsg.message_id;
        } else {
            const returnMsg = await bot.sendMessage(chatId, `👋 С возвращением, ${username}!`, { parse_mode: 'Markdown' });
            bot.lastMessageId[chatId] = returnMsg.message_id;
        }
        await handleMainMenu(bot, chatId);
    } catch (error) {
        console.error('Ошибка /start:', error.message);
        await bot.sendMessage(chatId, '❌ Ошибка');
    }
});

// URL для Web App
const webAppUrl = isLocal ? 'http://localhost:3000' : `https://${process.env.RENDER_APP_NAME || 'telegram-bot-gmut'}.onrender.com`;

// Обработка текстовых сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    console.log(`Сообщение: "${msg.text}" от ${msg.from.username}`);

    if (bot.lastMessageId[chatId] && bot.lastMessageId[chatId] !== msg.message_id) {
        try {
            await bot.deleteMessage(chatId, bot.lastMessageId[chatId]);
        } catch (error) {
            console.error('Ошибка удаления сообщения:', error);
            if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 400) {
                delete bot.lastMessageId[chatId];
            }
        }
    }

    let newMessage;
    switch (msg.text) {
        case 'Личный кабинет':
            await showProfile(bot, chatId);
            break;
        case 'Витрина':
            newMessage = await bot.sendMessage(chatId, '✅ В новой МОДЕЛИ ПАРТНЕРСКОЙ ПРОГРАММЫ (клубная система)\nв конечную стоимость продукта не входит:\n\n' +
                '- прибыль компании \n' +
                '- маркетинговое вознаграждение', {
                reply_markup: {
                    inline_keyboard: [[{ text: '🛒 Открыть витрину:', web_app: { url: `${webAppUrl}/index.html` } }]]
                }
            });
            bot.lastMessageId[chatId] = newMessage.message_id;
            break;
        case 'Бонусы и продукт':
            newMessage = await bot.sendMessage(chatId, 'ℹ️ Информация о бонусах (в разработке)');
            bot.lastMessageId[chatId] = newMessage.message_id;
            break;
        case 'Отзывы':
            const reviewsPerPage = 10;
            const reviews = await Review.find({ isApproved: true })
                .populate('productId', 'name')
                .sort({ createdAt: -1 });
            console.log('Загруженные подтверждённые отзывы для Telegram:', reviews);

            if (reviews.length === 0) {
                newMessage = await bot.sendMessage(chatId, '📝 Пока нет подтверждённых отзывов');
                bot.lastMessageId[chatId] = newMessage.message_id;
            } else {
                const totalPages = Math.ceil(reviews.length / reviewsPerPage);

                const showReviewsPage = async (page = 1) => {
                    const start = (page - 1) * reviewsPerPage;
                    const end = Math.min(start + reviewsPerPage, reviews.length);
                    const paginatedReviews = reviews.slice(start, end);

                    const reviewList = paginatedReviews.map(r => {
                        const productName = r.productId ? r.productId.name : 'Неизвестный товар';
                        return `Дата: ${formatDate(r.createdAt)}\n` +
                            `Товар: ${productName}\n` +
                            `Пользователь: ${r.username.startsWith('@') ? r.username : '@' + r.username}\n` +
                            `Рейтинг: ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}\n` +
                            `Комментарий: ${r.comment}`;
                    }).join('\n---\n');

                    const inlineKeyboard = [];
                    if (totalPages > 1) {
                        const navigationButtons = [];
                        if (page > 1) {
                            navigationButtons.push({ text: '⬅️', callback_data: `reviews_page_${page - 1}` });
                        }
                        navigationButtons.push({ text: `${page}/${totalPages}`, callback_data: 'noop' });
                        if (page < totalPages) {
                            navigationButtons.push({ text: '➡️', callback_data: `reviews_page_${page + 1}` });
                        }
                        inlineKeyboard.push(navigationButtons);
                    }

                    newMessage = await bot.sendMessage(chatId, `📝 Подтверждённые отзывы (${start + 1}-${end} из ${reviews.length}):\n\n${reviewList}`, {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: inlineKeyboard }
                    });
                    bot.lastMessageId[chatId] = newMessage.message_id;
                };

                await showReviewsPage(1);
            }
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

// Обработка команды /search
bot.onText(/\/search (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1];
    await searchProducts(bot, chatId, query);
});

// Обработка callback_query
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('reviews_page_')) {
        const page = parseInt(data.split('_')[2]);
        const reviewsPerPage = 10;
        const reviews = await Review.find({ isApproved: true })
            .populate('productId', 'name')
            .sort({ createdAt: -1 });
        const totalPages = Math.ceil(reviews.length / reviewsPerPage);

        const start = (page - 1) * reviewsPerPage;
        const end = Math.min(start + reviewsPerPage, reviews.length);
        const paginatedReviews = reviews.slice(start, end);

        const reviewList = paginatedReviews.map(r => {
            const productName = r.productId ? r.productId.name : 'Неизвестный товар';
            return `Дата: ${formatDate(r.createdAt)}\n` +
                `Товар: ${productName}\n` +
                `Пользователь: ${r.username.startsWith('@') ? r.username : '@' + r.username}\n` +
                `Рейтинг: ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}\n` +
                `Комментарий: ${r.comment}`;
        }).join('\n---\n');

        const inlineKeyboard = [];
        if (totalPages > 1) {
            const navigationButtons = [];
            if (page > 1) {
                navigationButtons.push({ text: '⬅️', callback_data: `reviews_page_${page - 1}` });
            }
            navigationButtons.push({ text: `${page}/${totalPages}`, callback_data: 'noop' });
            if (page < totalPages) {
                navigationButtons.push({ text: '➡️', callback_data: `reviews_page_${page + 1}` });
            }
            inlineKeyboard.push(navigationButtons);
        }

        await bot.editMessageText(`📝 Подтверждённые отзывы (${start + 1}-${end} из ${reviews.length}):\n\n${reviewList}`, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: inlineKeyboard }
        });

        bot.answerCallbackQuery(callbackQuery.id);
    } else if (data === 'noop') {
        bot.answerCallbackQuery(callbackQuery.id);
    } else if (data.startsWith('approve_review_')) {
        const reviewId = data.split('_')[2];
        try {
            const review = await Review.findById(reviewId);
            if (!review) {
                await bot.answerCallbackQuery(callbackQuery.id, { text: 'Отзыв не найден' });
                return;
            }
            review.isApproved = true;
            review.updatedAt = Date.now();
            await review.save();
            console.log('Отзыв одобрен:', review);

            const product = await Product.findById(review.productId);
            const reviews = await Review.find({ productId: review.productId, isApproved: true });
            const averageRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;
            await Product.updateOne({ _id: review.productId }, { averageRating });

            await bot.editMessageText(`Отзыв одобрен:\nТовар: ${product.name}\nПользователь: ${review.username}\nРейтинг: ${review.rating}\nКомментарий: ${review.comment}`, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                reply_markup: { inline_keyboard: [] }
            });
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Отзыв одобрен' });
            productCache = null; // Сбрасываем кэш
        } catch (error) {
            console.error('Ошибка при одобрении отзыва:', error.message);
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ошибка при одобрении отзыва' });
        }
    } else if (data.startsWith('reject_review_')) {
        const reviewId = data.split('_')[2];
        try {
            const review = await Review.findById(reviewId);
            if (!review) {
                await bot.answerCallbackQuery(callbackQuery.id, { text: 'Отзыв не найден' });
                return;
            }
            const product = await Product.findById(review.productId);
            await Review.deleteOne({ _id: reviewId });
            console.log('Отзыв отклонён:', review);

            await bot.editMessageText(`Отзыв отклонён:\nТовар: ${product.name}\nПользователь: ${review.username}\nРейтинг: ${review.rating}\nКомментарий: ${review.comment}`, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                reply_markup: { inline_keyboard: [] }
            });
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Отзыв отклонён' });
            productCache = null; // Сбрасываем кэш
        } catch (error) {
            console.error('Ошибка при отклонении отзыва:', error.message);
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ошибка при отклонении отзыва' });
        }
    } else {
        console.log(`Callback: ${callbackQuery.data}`);
        handleCallback(bot, callbackQuery);
        handleAdminCallback(bot, callbackQuery);
    }
});

// Обработка Webhook
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    console.log('Webhook получил данные:', JSON.stringify(req.body, null, 2));
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Обработка события web_app_data
bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    console.log('Получены данные от Web App:', msg.web_app_data.data);

    let data;
    try {
        data = JSON.parse(msg.web_app_data.data);
    } catch (error) {
        console.error('Ошибка парсинга данных:', error);
        await bot.sendMessage(chatId, '❌ Ошибка обработки данных');
        return;
    }

    if (data.type === 'share') {
        const { productId, name, clubPrice, clientPrice, description, image } = data;
        try {
            const product = await Product.findById(productId);
            if (!product) {
                await bot.sendMessage(chatId, '❌ Товар не найден');
                return;
            }

            const caption = `
✨ *${name}* ✨
━━━━━━━━━━━━━━━━━━━
💎 *Клубная цена:* ${clubPrice.toLocaleString()} ₽
💰 *Клиентская цена:* ${clientPrice.toLocaleString()} ₽
━━━━━━━━━━━━━━━━━━━
📝 *Описание:* 
${description || 'Описание отсутствует'}
━━━━━━━━━━━━━━━━━━━
            `.trim();

            const newMessage = await bot.sendPhoto(chatId, image, {
                caption,
                parse_mode: 'Markdown'
            });
            bot.lastMessageId[chatId] = newMessage.message_id;
        } catch (error) {
            console.error('Ошибка при шаринге продукта:', error);
            await bot.sendMessage(chatId, '❌ Ошибка при отправке продукта');
        }
    } else if (data.type === 'review') {
        const { productId, rating, comment } = data;
        console.log('Попытка сохранить отзыв:', { productId, rating, comment });
        if (!rating || rating < 1 || rating > 5 || !comment || !productId || !mongoose.Types.ObjectId.isValid(productId)) {
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
            const username = msg.from.username ? `@${msg.from.username}` : 'Аноним';
            const review = new Review({
                userId: chatId.toString(),
                username,
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

            const message = `Новый отзыв на модерации:\nТовар: ${product.name}\nПользователь: ${username}\nРейтинг: ${rating}\nКомментарий: ${comment}`;
            await bot.sendMessage(ADMIN_ID, message, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Одобрить', callback_data: `approve_review_${review._id}` },
                            { text: 'Отклонить', callback_data: `reject_review_${review._id}` }
                        ]
                    ]
                }
            });

            const newMessage = await bot.sendMessage(chatId, 'Спасибо за ваш отзыв! Он будет опубликован после модерации.');
            bot.lastMessageId[chatId] = newMessage.message_id;
            productCache = null; // Сбрасываем кэш
        } catch (error) {
            console.error('Ошибка сохранения отзыва:', error.stack);
            await bot.sendMessage(chatId, '❌ Ошибка при сохранении отзыва');
        }
    } else {
        console.log('Неизвестный тип данных:', data.type);
    }
});

// Запуск сервера
const startServer = async () => {
    await setupWebhook();
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();