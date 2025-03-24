require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

// Модели MongoDB
const ProductSchema = new mongoose.Schema({
    name: String,
    description: String,
    clubPrice: Number,
    clientPrice: Number,
    image: String, // file_id изображения в Telegram
    stock: Number,
    averageRating: { type: Number, default: 0 },
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
});
const Product = mongoose.model('Product', ProductSchema);

const ReviewSchema = new mongoose.Schema({
    userId: String,
    username: String,
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    rating: Number,
    comment: String,
    isApproved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
const Review = mongoose.model('Review', ReviewSchema);

// Инициализация Express
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Переменные окружения
const BOT_TOKEN = process.env.BOT_TOKEN || '7998254262:AAEPpbNdFxiTttY4aLrkdNVzlksBIf6lwd8';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://asselikhov:1234@cluster0.0v5k0.mongodb.net/telegram-bot?retryWrites=true&w=majority';
const ADMIN_ID = process.env.ADMIN_ID || '942851377';
const STORAGE_CHAT_ID = process.env.STORAGE_CHAT_ID || '942851377';
const isLocal = process.env.NODE_ENV !== 'production';

// Инициализация Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: isLocal });
bot.lastMessageId = {};

// Подключение к MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
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

// Обработка Webhook
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    console.log('Webhook получил данные:', JSON.stringify(req.body, null, 2));
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// API для получения продуктов
let cachedProducts = null;
app.get('/api/products', async (req, res) => {
    console.log('Получен запрос на /api/products');
    try {
        if (cachedProducts) {
            console.log('Возвращаем данные из кэша');
            return res.json({ success: true, products: cachedProducts });
        }

        const products = await Product.find().populate('reviews');
        for (let product of products) {
            const approvedReviews = await Review.find({ productId: product._id, isApproved: true });
            console.log(`Отзывы для продукта ${product.name}:`, approvedReviews);
            product.reviews = approvedReviews;
            product.averageRating = approvedReviews.length > 0
                ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
                : 0;
        }
        cachedProducts = products;
        console.log('Отправка данных клиенту:', products);
        res.json({ success: true, products });
    } catch (error) {
        console.error('Ошибка при получении продуктов:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// API для получения всех отзывов
app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await Review.find({ isApproved: true }).populate('productId');
        const reviewsWithProductNames = reviews.map(review => ({
            ...review._doc,
            productName: review.productId ? review.productId.name : 'Неизвестный продукт'
        }));
        console.log('Все подтверждённые отзывы для отображения:', reviewsWithProductNames);
        res.json({ success: true, reviews: reviewsWithProductNames });
    } catch (error) {
        console.error('Ошибка при получении отзывов:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// API для сохранения отзыва
app.post('/api/reviews', async (req, res) => {
    try {
        const { productId, username, rating, comment, isApproved } = req.body;
        const review = new Review({
            userId: `web_user_${Date.now()}`,
            username,
            productId,
            rating,
            comment,
            isApproved
        });
        await review.save();
        console.log('Отзыв сохранён на сервере:', review);
        cachedProducts = null; // Сбрасываем кэш
        res.json({ success: true, review });
    } catch (error) {
        console.error('Ошибка сохранения отзыва:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// API для получения изображения
app.get('/api/image/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    res.redirect(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileId}`);
});

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`Сообщение: "/start" от ${msg.from.username}`);
    try {
        const webAppUrl = 'https://telegram-bot-gmut.onrender.com';
        const newMessage = await bot.sendMessage(chatId, 'Добро пожаловать! Нажмите кнопку ниже, чтобы открыть витрину:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Открыть витрину', web_app: { url: webAppUrl } }]
                ]
            }
        });
        bot.lastMessageId[chatId] = newMessage.message_id;
    } catch (error) {
        console.error('Ошибка при отправке сообщения /start:', error.message);
        await bot.sendMessage(chatId, '❌ Ошибка при открытии витрины');
    }
});

// Обработка текстовых сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    console.log(`Сообщение: "${text}" от ${msg.from.username}`);

    if (text === 'Витрина') {
        try {
            const webAppUrl = 'https://telegram-bot-gmut.onrender.com';
            const newMessage = await bot.sendMessage(chatId, 'Нажмите кнопку ниже, чтобы открыть витрину:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Открыть витрину', web_app: { url: webAppUrl } }]
                    ]
                }
            });
            bot.lastMessageId[chatId] = newMessage.message_id;
        } catch (error) {
            console.error('Ошибка при открытии витрины:', error.message);
            await bot.sendMessage(chatId, '❌ Ошибка при открытии витрины');
        }
    } else if (text === '/reviews') {
        try {
            const webAppUrl = 'https://telegram-bot-gmut.onrender.com';
            const newMessage = await bot.sendMessage(chatId, 'Нажмите кнопку ниже, чтобы посмотреть отзывы:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Посмотреть отзывы', web_app: { url: webAppUrl } }]
                    ]
                }
            });
            bot.lastMessageId[chatId] = newMessage.message_id;
        } catch (error) {
            console.error('Ошибка при открытии отзывов:', error.message);
            await bot.sendMessage(chatId, '❌ Ошибка при открытии отзывов');
        }
    }
});

// Обработка события web_app_data
bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    console.log('=== Начало обработки web_app_data ===');
    console.log('Чат ID:', chatId);
    console.log('Полное сообщение от Telegram:', JSON.stringify(msg, null, 2));
    console.log('Сырые данные от Web App:', msg.web_app_data.data);

    let data;
    try {
        data = JSON.parse(msg.web_app_data.data);
        console.log('Распарсенные данные:', data);
    } catch (error) {
        console.error('Ошибка парсинга JSON:', error.message);
        await bot.sendMessage(chatId, '❌ Ошибка обработки данных');
        return;
    }

    if (data.type === 'share') {
        const { productId, name, clubPrice, clientPrice, description, image } = data;
        console.log('Обработка шаринга продукта:', { productId, name, clubPrice, clientPrice, description, image });

        try {
            const product = await Product.findById(productId);
            if (!product) {
                console.log('Товар не найден в базе:', productId);
                await bot.sendMessage(chatId, '❌ Товар не найден');
                return;
            }
            console.log('Найденный продукт:', product);

            const caption = `
✨ *${name}* ✨
💎 *Клубная цена:* ${clubPrice.toLocaleString()} ₽
💰 *Клиентская цена:* ${clientPrice.toLocaleString()} ₽
📝 *Описание:* ${description || 'Описание отсутствует'}
            `.trim();

            console.log('Отправка фото в чат:', { chatId, image, caption });
            const newMessage = await bot.sendPhoto(chatId, image, {
                caption,
                parse_mode: 'Markdown'
            });
            console.log('Карточка продукта успешно отправлена, message_id:', newMessage.message_id);
            bot.lastMessageId[chatId] = newMessage.message_id;
        } catch (error) {
            console.error('Ошибка при отправке карточки продукта:', error.stack);
            await bot.sendMessage(chatId, '❌ Ошибка при шаринге продукта: ' + error.message);
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
        } catch (error) {
            console.error('Ошибка сохранения отзыва:', error.stack);
            await bot.sendMessage(chatId, '❌ Ошибка при сохранении отзыва');
        }
    } else {
        console.log('Неизвестный тип данных:', data.type);
    }
    console.log('=== Конец обработки web_app_data ===');
});

// Обработка callback_query для модерации отзывов
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (data.startsWith('approve_review_')) {
        const reviewId = data.split('_')[2];
        try {
            const review = await Review.findById(reviewId);
            if (!review) {
                await bot.answerCallbackQuery(query.id, { text: 'Отзыв не найден' });
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
                message_id: messageId,
                reply_markup: { inline_keyboard: [] }
            });
            await bot.answerCallbackQuery(query.id, { text: 'Отзыв одобрен' });
            cachedProducts = null; // Сбрасываем кэш
        } catch (error) {
            console.error('Ошибка при одобрении отзыва:', error.message);
            await bot.answerCallbackQuery(query.id, { text: 'Ошибка при одобрении отзыва' });
        }
    } else if (data.startsWith('reject_review_')) {
        const reviewId = data.split('_')[2];
        try {
            const review = await Review.findById(reviewId);
            if (!review) {
                await bot.answerCallbackQuery(query.id, { text: 'Отзыв не найден' });
                return;
            }
            const product = await Product.findById(review.productId);
            await Review.deleteOne({ _id: reviewId });
            console.log('Отзыв отклонён:', review);

            await bot.editMessageText(`Отзыв отклонён:\nТовар: ${product.name}\nПользователь: ${review.username}\nРейтинг: ${review.rating}\nКомментарий: ${review.comment}`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: [] }
            });
            await bot.answerCallbackQuery(query.id, { text: 'Отзыв отклонён' });
            cachedProducts = null; // Сбрасываем кэш
        } catch (error) {
            console.error('Ошибка при отклонении отзыва:', error.message);
            await bot.answerCallbackQuery(query.id, { text: 'Ошибка при отклонении отзыва' });
        }
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await setupWebhook();
});