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

// Определение модели Product (убедимся, что она соответствует вашей коллекции)
const productSchema = new mongoose.Schema({
    name: String,
    description: String,
    clubPrice: Number,
    clientPrice: Number,
    image: String,
    stock: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 }
}, { collection: 'products' }); // Явно указываем имя коллекции

const Product = mongoose.model('Product', productSchema);

const mainMenuKeyboard = {
    keyboard: [['Личный кабинет', 'Витрина'], ['Бонусы и продукт', 'Отзывы']],
    resize_keyboard: true,
    one_time_keyboard: false,
    persistent: true
};

async function ensureMainMenu(chatId) {
    const menuMsg = await bot.sendMessage(chatId, 'Главное меню:', { reply_markup: mainMenuKeyboard });
    bot.lastMessageId[chatId] = menuMsg.message_id;
}

// Обработка web_app_data
bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    let data;
    try {
        data = JSON.parse(msg.web_app_data.data);
        console.log('Получены данные от Web App:', data);
    } catch (error) {
        console.error('Ошибка парсинга данных от Web App:', error);
        await bot.sendMessage(chatId, '❌ Ошибка обработки данных', { reply_markup: mainMenuKeyboard });
        await ensureMainMenu(chatId);
        return;
    }

    if (data.type === 'share') {
        const { productId, name, clubPrice, clientPrice, description, image } = data;
        try {
            // Проверяем продукт в базе данных
            const product = await Product.findById(productId);
            if (!product) {
                console.error(`Продукт с ID ${productId} не найден в коллекции products`);
                throw new Error('Товар не найден в базе данных');
            }
            console.log('Найден продукт в базе:', product);

            // Формируем текст сообщения
            const caption = `
✨ *${name}* ✨
━━━━━━━━━━━━━━━━━━━
💎 *Клубная цена:* ${clubPrice.toLocaleString()} ₽
💰 *Клиентская цена:* ${clientPrice.toLocaleString()} ₽
━━━━━━━━━━━━━━━━━━━
📝 *Описание:* 
${description}
━━━━━━━━━━━━━━━━━━━
            `.trim();

            // Отправляем фото с Telegram File ID
            console.log('Отправка фото с File ID:', image);
            const newMessage = await bot.sendPhoto(chatId, image, {
                caption,
                parse_mode: 'Markdown',
                reply_markup: mainMenuKeyboard
            });
            bot.lastMessageId[chatId] = newMessage.message_id;
            console.log('Сообщение успешно отправлено, message_id:', newMessage.message_id);
            await ensureMainMenu(chatId);
        } catch (error) {
            console.error('Ошибка при отправке продукта:', error.message);
            await bot.sendMessage(chatId, `❌ Ошибка при отправке продукта: ${error.message}`, { reply_markup: mainMenuKeyboard });
            await ensureMainMenu(chatId);
        }
    } else if (data.type === 'review') {
        const { productId, rating, comment } = data;
        if (!rating || rating < 1 || rating > 5 || !comment || !mongoose.Types.ObjectId.isValid(productId)) {
            await bot.sendMessage(chatId, '❌ Неверный формат отзыва', { reply_markup: mainMenuKeyboard });
            await ensureMainMenu(chatId);
            return;
        }
        try {
            const product = await Product.findById(productId);
            if (!product) throw new Error('Товар не найден');
            const username = msg.from.username ? `@${msg.from.username}` : 'Аноним';
            const review = new Review({ userId: chatId.toString(), username, productId, rating, comment, isApproved: false });
            await review.save();

            const message = `Новый отзыв на модерации:\nТовар: ${product.name}\nПользователь: ${username}\nРейтинг: ${rating}\nКомментарий: ${comment}`;
            await bot.sendMessage(ADMIN_ID, message, {
                reply_markup: { inline_keyboard: [[{ text: 'Одобрить', callback_data: `approve_review_${review._id}` }, { text: 'Отклонить', callback_data: `reject_review_${review._id}` }]] }
            });

            const newMessage = await bot.sendMessage(chatId, 'Спасибо за ваш отзыв! Он будет опубликован после модерации.', { reply_markup: mainMenuKeyboard });
            bot.lastMessageId[chatId] = newMessage.message_id;
            await ensureMainMenu(chatId);
        } catch (error) {
            console.error('Ошибка при сохранении отзыва:', error);
            await bot.sendMessage(chatId, '❌ Ошибка при сохранении отзыва', { reply_markup: mainMenuKeyboard });
            await ensureMainMenu(chatId);
        }
    }
});

// Остальные маршруты и обработчики остаются без изменений
const setupWebhook = async () => {
    if (isLocal) return;
    const appName = process.env.RENDER_APP_NAME || 'telegram-bot-gmut';
    const WEBHOOK_URL = `https://${appName}.onrender.com/bot${BOT_TOKEN}`;
    const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

    try {
        await axios.get(`${telegramApi}/deleteWebhook`);
        const setResponse = await axios.get(`${telegramApi}/setWebhook?url=${WEBHOOK_URL}&allowed_updates=["message","callback_query","web_app_data"]`);
        if (!setResponse.data.ok) throw new Error('Webhook setup failed');
        console.log('Webhook успешно настроен');
    } catch (error) {
        console.error('Ошибка настройки Webhook:', error);
        process.exit(1);
    }
};

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

// Запуск сервера
const startServer = async () => {
    await setupWebhook();
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
};

startServer();