const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors()); // Разрешаем CORS для всех доменов

// Замените на ваш токен бота
const token = '7998254262:AAEPpbNdFxiTttY4aLrkdNVzlksBIf6lwd8';
const bot = new TelegramBot(token, { polling: true });

// Замените на chat_id администратора
const adminChatId = '942851377';

// Подключение к MongoDB
mongoose.connect('mongodb+srv://nataCROWD768:april1987@cluster0.mongodb.net/reviews?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Подключено к MongoDB'))
    .catch(err => console.error('Ошибка подключения к MongoDB:', err));

// Схемы для MongoDB
const productSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: String,
    description: String,
    image: String,
    clubPrice: Number,
    clientPrice: Number,
    rating: Number,
    reviews: [{
        user: String,
        rating: Number,
        comment: String,
        status: String // 'pending' или 'approved'
    }]
});

const pendingReviewSchema = new mongoose.Schema({
    productId: Number,
    user: String,
    rating: Number,
    comment: String,
    status: String // 'pending'
});

const Product = mongoose.model('Product', productSchema);
const PendingReview = mongoose.model('PendingReview', pendingReviewSchema);

// Инициализация данных (если база данных пуста)
async function initializeData() {
    const count = await Product.countDocuments();
    if (count === 0) {
        const initialProducts = [
            { id: 1, name: 'НАБОР «МОЛОДОСТЬ»', description: 'Набор для ухода за кожей, включающий увлажняющий крем, сыворотку и маску для лица. Идеально подходит для сохранения молодости и сияния кожи.', image: '/images/image1.jpg', clubPrice: 1000, clientPrice: 1200, rating: 4.5, reviews: [{ user: 'Анна', rating: 5, comment: 'Отличный набор! Кожа стала мягче и сияет.', status: 'approved' }, { user: 'Мария', rating: 4, comment: 'Хороший продукт, но маска немного липкая.', status: 'approved' }] },
            { id: 2, name: 'МАСЛО СBD, 10%', description: 'Натуральное масло CBD 10% для снятия стресса и улучшения сна. Подходит для ежедневного использования.', image: '/images/image2.jpg', clubPrice: 1500, clientPrice: 1800, rating: 4.0, reviews: [] },
            { id: 3, name: 'БИОЙОДИН 150', description: 'Биологически активная добавка с йодом для поддержки щитовидной железы и общего здоровья.', image: '/images/image3.jpg', clubPrice: 2000, clientPrice: 2400, rating: 4.8, reviews: [] },
            { id: 4, name: 'БИОЛАСТИН', description: 'Средство для укрепления волос и ногтей с биотином и коллагеном.', image: '/images/image4.jpg', clubPrice: 800, clientPrice: 1000, rating: 3.5, reviews: [] },
            { id: 5, name: 'CONTROL RGP', description: 'Молекулярный гель для восстановления кожи, обогащённый экстрактом фукуса и аргановым маслом.', image: '/images/image5.jpg', clubPrice: 1200, clientPrice: 1400, rating: 4.2, reviews: [] },
            { id: 6, name: 'DETOX RGP', description: 'Детокс-гель для очищения кожи с фукусом и аргановым маслом.', image: '/images/image6.jpg', clubPrice: 1100, clientPrice: 1300, rating: 4.3, reviews: [] },
            { id: 7, name: 'SLIM RGP', description: 'Гель для коррекции фигуры с фукусом и аргановым маслом.', image: '/images/image7.jpg', clubPrice: 900, clientPrice: 1100, rating: 4.1, reviews: [] },
            { id: 8, name: 'ХВОЙНЫЙ БАЛЬЗАМ', description: 'Хвойный бальзам для тела с успокаивающим эффектом.', image: '/images/image8.jpg', clubPrice: 1600, clientPrice: 1900, rating: 4.7, reviews: [] },
            { id: 9, name: 'ВОДНЫЙ ЭКСТРАКТ ПРОПОЛИСА', description: 'Водный экстракт прополиса для укрепления иммунитета.', image: '/images/image9.jpg', clubPrice: 1300, clientPrice: 1500, rating: 4.4, reviews: [] }
        ];
        await Product.insertMany(initialProducts);
        console.log('Инициализированы начальные данные');
    }
}

// Вызываем инициализацию данных
initializeData();

// Настройка WebSocket-сервера
const wss = new WebSocket.Server({ port: 8080 });

// Храним подключённых клиентов
const clients = new Set();

wss.on('connection', (ws) => {
    console.log('Клиент подключён через WebSocket');
    clients.add(ws);

    ws.on('close', () => {
        console.log('Клиент отключён');
        clients.delete(ws);
    });
});

// Функция для уведомления всех клиентов об изменениях
function notifyClients(data) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// API-эндпоинт для получения списка продуктов
app.get('/products', async (req, res) => {
    try {
        console.log('Получен запрос на /products');
        const products = await Product.find();
        console.log('Продукты из базы данных:', products);
        res.status(200).json(products);
    } catch (error) {
        console.error('Ошибка при получении продуктов:', error);
        res.status(500).json({ error: 'Ошибка при получении продуктов' });
    }
});

// API-эндпоинт для синхронизации отзывов
app.post('/sync-reviews', async (req, res) => {
    try {
        const { pendingReviews } = req.body;
        await PendingReview.deleteMany({}); // Очищаем старые отзывы
        await PendingReview.insertMany(pendingReviews);
        res.status(200).send({ message: 'Отзывы синхронизированы' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при синхронизации отзывов' });
    }
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
bot.onText(/Модерация отзывов/, async (msg) => {
    const chatId = msg.chat.id;

    // Проверяем, является ли пользователь администратором
    if (chatId.toString() !== adminChatId) {
        bot.sendMessage(chatId, 'У вас нет доступа к этой функции.');
        return;
    }

    const pendingReviews = await PendingReview.find();
    if (pendingReviews.length === 0) {
        bot.sendMessage(chatId, 'Нет отзывов на модерации.');
        return;
    }

    // Отправляем каждый отзыв с инлайн-кнопками
    for (let index = 0; index < pendingReviews.length; index++) {
        const review = pendingReviews[index];
        const product = await Product.findOne({ id: review.productId });
        const message = `Отзыв на модерации:\nПродукт: ${product.name}\nПользователь: ${review.user}\nРейтинг: ${review.rating}\nКомментарий: ${review.comment}`;

        await bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Подтвердить', callback_data: `approve_${index}` },
                        { text: 'Отклонить', callback_data: `reject_${index}` }
                    ]
                ]
            }
        });
    }
});

// Обработчик нажатий на инлайн-кнопки
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    // Проверяем, является ли пользователь администратором
    if (chatId.toString() !== adminChatId) {
        bot.answerCallbackQuery(callbackQuery.id, { text: 'У вас нет доступа.' });
        return;
    }

    const [action, index] = data.split('_');
    const reviewIndex = parseInt(index);

    const pendingReviews = await PendingReview.find();
    const review = pendingReviews[reviewIndex];

    if (!review) {
        bot.sendMessage(chatId, 'Отзыв не найден.');
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }

    const product = await Product.findOne({ id: review.productId });

    if (action === 'approve') {
        review.status = 'approved';
        product.reviews.push(review);
        await product.save();
        await PendingReview.deleteOne({ _id: review._id });
        bot.sendMessage(chatId, `Отзыв для продукта "${product.name}" подтверждён.`);
    } else if (action === 'reject') {
        await PendingReview.deleteOne({ _id: review._id });
        bot.sendMessage(chatId, `Отзыв для продукта "${product.name}" отклонён.`);
    }

    // Уведомляем клиентов через WebSocket
    const updatedProducts = await Product.find();
    notifyClients({ type: 'update_products', data: updatedProducts });

    bot.answerCallbackQuery(callbackQuery.id);
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

console.log('Бот запущен...');