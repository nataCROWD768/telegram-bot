const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Замените на ваш токен бота
const token = 'YOUR_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

// Замените на chat_id администратора
const adminChatId = 'ADMIN_CHAT_ID';

// Хранилище для отзывов на модерации
let pendingReviews = [];

// Хранилище для продуктов
const products = [
    { id: 1, name: 'НАБОР «МОЛОДОСТЬ»', reviews: [] },
    { id: 2, name: 'МАСЛО СBD, 10%', reviews: [] },
    { id: 3, name: 'БИОЙОДИН 150', reviews: [] },
    { id: 4, name: 'БИОЛАСТИН', reviews: [] },
    { id: 5, name: 'CONTROL RGP', reviews: [] },
    { id: 6, name: 'DETOX RGP', reviews: [] },
    { id: 7, name: 'SLIM RGP', reviews: [] },
    { id: 8, name: 'ХВОЙНЫЙ БАЛЬЗАМ', reviews: [] },
    { id: 9, name: 'ВОДНЫЙ ЭКСТРАКТ ПРОПОЛИСА', reviews: [] }
];

// API-эндпоинт для синхронизации отзывов
app.post('/sync-reviews', (req, res) => {
    pendingReviews = req.body.pendingReviews;
    res.status(200).send({ message: 'Отзывы синхронизированы' });
});

// API-эндпоинт для получения списка продуктов
app.get('/products', (req, res) => {
    res.status(200).json(products);
});

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Добро пожаловать в админ-панель!', {
        reply_markup: {
            keyboard: [['Модерация отзывов']],
            resize_keyboard: true
        }
    });
});

// Обработчик команды /moderate или кнопки "Модерация отзывов"
bot.onText(/Модерация отзывов/, (msg) => {
    const chatId = msg.chat.id;

    // Проверяем, является ли пользователь администратором
    if (chatId.toString() !== adminChatId) {
        bot.sendMessage(chatId, 'У вас нет доступа к этой функции.');
        return;
    }

    if (pendingReviews.length === 0) {
        bot.sendMessage(chatId, 'Нет отзывов на модерации.');
        return;
    }

    // Отправляем каждый отзыв с инлайн-кнопками
    pendingReviews.forEach((review, index) => {
        const product = products.find(p => p.id === review.productId);
        const message = `Отзыв на модерации:\nПродукт: ${product.name}\nПользователь: ${review.user}\nРейтинг: ${review.rating}\nКомментарий: ${review.comment}`;

        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Подтвердить', callback_data: `approve_${index}` },
                        { text: 'Отклонить', callback_data: `reject_${index}` }
                    ]
                ]
            }
        });
    });
});

// Обработчик нажатий на инлайн-кнопки
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    // Проверяем, является ли пользователь администратором
    if (chatId.toString() !== adminChatId) {
        bot.answerCallbackQuery(callbackQuery.id, { text: 'У вас нет доступа.' });
        return;
    }

    const [action, index] = data.split('_');
    const reviewIndex = parseInt(index);

    if (action === 'approve') {
        const review = pendingReviews[reviewIndex];
        const product = products.find(p => p.id === review.productId);
        review.status = 'approved';
        product.reviews.push(review);
        pendingReviews.splice(reviewIndex, 1);
        bot.sendMessage(chatId, `Отзыв для продукта "${product.name}" подтверждён.`);
    } else if (action === 'reject') {
        const review = pendingReviews[reviewIndex];
        const product = products.find(p => p.id === review.productId);
        pendingReviews.splice(reviewIndex, 1);
        bot.sendMessage(chatId, `Отзыв для продукта "${product.name}" отклонён.`);
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

console.log('Бот запущен...');