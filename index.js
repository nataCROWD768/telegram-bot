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
const initialProducts = require('./data/products');
require('dotenv').config();

const app = express();
const isLocal = process.env.NODE_ENV !== 'production';
const BOT_TOKEN = process.env.TOKEN || '7998254262:AAEPpbNdFxiTttY4aLrkdNVzlksBIf6lwd8';
const bot = new TelegramBot(BOT_TOKEN, { polling: isLocal });
const ADMIN_ID = process.env.ADMIN_ID || '942851377';

let lastMessageId = {};

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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => console.log(`Раздача файла: ${filePath}`)
}));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB подключен'))
    .catch(err => {
        console.error('Ошибка подключения к MongoDB:', err.message);
        process.exit(1);
    });

const setupWebhook = async () => {
    if (isLocal) {
        console.log('Локальный режим: polling активен');
        return;
    }
    const appName = process.env.RENDER_APP_NAME || 'telegram-bot-gmut';
    const WEBHOOK_URL = `https://${appName}.onrender.com/bot${BOT_TOKEN}`;
    const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;
    console.log(`Попытка установить webhook: ${WEBHOOK_URL}`);

    try {
        const deleteResponse = await axios.get(`${telegramApi}/deleteWebhook`);
        console.log('Старый webhook удалён:', deleteResponse.data);

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

const syncProducts = async () => {
    try {
        console.log('Синхронизация товаров...');
        const existingProducts = await Product.find();
        const existingProductNames = existingProducts.map(p => p.name);

        for (const productData of initialProducts) {
            if (!existingProductNames.includes(productData.name)) {
                const newProduct = await Product.create(productData);
                console.log('Добавлен новый товар:', newProduct);
            } else {
                await Product.updateOne(
                    { name: productData.name },
                    { $set: productData }
                );
                console.log(`Обновлён товар: ${productData.name}`);
            }
        }
        console.log('Товары синхронизированы');
    } catch (error) {
        console.error('Ошибка синхронизации товаров:', error.message);
    }
};

app.get('/api/products', async (req, res) => {
    console.log('Получен запрос на /api/products');
    try {
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
        res.json({ products: productsWithReviews, total: products.length });
    } catch (error) {
        console.error('Ошибка API /api/products:', error.stack);
        res.status(500).json({ error: 'Ошибка загрузки товаров' });
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

const webAppUrl = isLocal ? 'http://localhost:3000' : `https://${process.env.RENDER_APP_NAME || 'telegram-bot-gmut'}.onrender.com`;

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    console.log(`Сообщение: "${msg.text}" от ${msg.from.username}`);

    if (lastMessageId[chatId] && lastMessageId[chatId] !== msg.message_id) {
        try {
            await bot.deleteMessage(chatId, lastMessageId[chatId]);
        } catch (error) {
            console.error('Ошибка удаления сообщения:', error);
            if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 400) {
                delete lastMessageId[chatId];
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
            lastMessageId[chatId] = newMessage.message_id;
            break;
        case 'Бонусы и продукт':
            newMessage = await bot.sendMessage(chatId, 'ℹ️ Информация о бонусах (в разработке)');
            lastMessageId[chatId] = newMessage.message_id;
            break;
        case 'Отзывы':
            const reviewsPerPage = 10;
            const reviews = await Review.find({ isApproved: true })
                .populate('productId', 'name')
                .sort({ createdAt: -1 }); // Сортировка по убыванию даты
            console.log('Загруженные подтверждённые отзывы для Telegram:', reviews);

            if (reviews.length === 0) {
                newMessage = await bot.sendMessage(chatId, '📝 Пока нет подтверждённых отзывов');
                lastMessageId[chatId] = newMessage.message_id;
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
                    lastMessageId[chatId] = newMessage.message_id;
                };

                await showReviewsPage(1); // Показываем первую страницу
            }
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

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('reviews_page_')) {
        const page = parseInt(data.split('_')[2]);
        const reviewsPerPage = 10;
        const reviews = await Review.find({ isApproved: true })
            .populate('productId', 'name')
            .sort({ createdAt: -1 }); // Сортировка по убыванию даты
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
        bot.answerCallbackQuery(callbackQuery.id); // Пустое действие для текста страницы
    } else {
        console.log(`Callback: ${callbackQuery.data}`);
        handleCallback(bot, callbackQuery);
        handleAdminCallback(bot, callbackQuery);
    }
});

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    console.log('Webhook получил данные:', JSON.stringify(req.body, null, 2));
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    const data = JSON.parse(msg.web_app_data.data);
    console.log('Получены данные от Web App:', data);

    if (data.type === 'review') {
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
            lastMessageId[chatId] = newMessage.message_id;
        } catch (error) {
            console.error('Ошибка сохранения отзыва:', error.stack);
            await bot.sendMessage(chatId, '❌ Ошибка при сохранении отзыва');
        }
    } else if (data.type === 'share') {
        const { productId, name, clubPrice, clientPrice, description, image } = data;
        console.log('Попытка поделиться продуктом:', { productId, name });

        try {
            const product = await Product.findById(productId);
            if (!product) {
                console.log('Товар не найден:', productId);
                await bot.sendMessage(chatId, '❌ Товар не найден');
                return;
            }

            const caption = `
✨ *${name}* ✨
💎 *Клубная цена:* ${clubPrice.toLocaleString()} ₽
💰 *Клиентская цена:* ${clientPrice.toLocaleString()} ₽
📝 *Описание:* ${description || 'Описание отсутствует'}
            `.trim();

            const newMessage = await bot.sendPhoto(chatId, image || 'https://via.placeholder.com/300', {
                caption,
                parse_mode: 'Markdown'
            });
            lastMessageId[chatId] = newMessage.message_id;
        } catch (error) {
            console.error('Ошибка отправки карточки для шаринга:', error.stack);
            await bot.sendMessage(chatId, '❌ Ошибка при шаринге продукта');
        }
    }
});

const startServer = async () => {
    await setupWebhook();
    // await syncProducts(); // Закомментировано, чтобы не перезаписывать продукты при каждом запуске
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();