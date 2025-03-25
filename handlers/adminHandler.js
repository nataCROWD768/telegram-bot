const Product = require('../models/product');
const Review = require('../models/review');

const handleAdmin = async (bot, msg) => {
    const chatId = msg.chat.id;
    const newMessage = await bot.sendMessage(chatId, 'Админ-панель:', {
        reply_markup: {
            keyboard: [
                ['Показать товары', 'Добавить товар'],
                ['Редактировать товар', 'Удалить товар'],
                ['Модерация отзывов', 'Назад в меню']
            ],
            resize_keyboard: true
        }
    });
    bot.lastMessageId[chatId] = newMessage.message_id;
};

const showProducts = async (bot, chatId) => {
    const products = await Product.find();
    const message = products.length ? products.map(p => `${p.name} - ${p.clubPrice} ₽`).join('\n') : 'Товаров нет';
    const newMessage = await bot.sendMessage(chatId, `Список товаров:\n${message}`);
    bot.lastMessageId[chatId] = newMessage.message_id;
};

const addProduct = async (bot, chatId) => {
    const newMessage = await bot.sendMessage(chatId, 'Функция добавления товара в разработке');
    bot.lastMessageId[chatId] = newMessage.message_id;
};

const editProduct = async (bot, chatId) => {
    const newMessage = await bot.sendMessage(chatId, 'Функция редактирования товара в разработке');
    bot.lastMessageId[chatId] = newMessage.message_id;
};

const deleteProduct = async (bot, chatId) => {
    const newMessage = await bot.sendMessage(chatId, 'Функция удаления товара в разработке');
    bot.lastMessageId[chatId] = newMessage.message_id;
};

const moderateReviews = async (bot, chatId) => {
    const reviews = await Review.find({ isApproved: false }).populate('productId', 'name');
    if (!reviews.length) {
        const newMessage = await bot.sendMessage(chatId, 'Нет отзывов на модерации');
        bot.lastMessageId[chatId] = newMessage.message_id;
        return;
    }
    for (const review of reviews) {
        const productName = review.productId ? review.productId.name : 'Неизвестный товар';
        await bot.sendMessage(chatId, `Отзыв на модерации:\nТовар: ${productName}\nПользователь: ${review.username}\nРейтинг: ${review.rating}\nКомментарий: ${review.comment}`, {
            reply_markup: { inline_keyboard: [[{ text: 'Одобрить', callback_data: `approve_review_${review._id}` }, { text: 'Отклонить', callback_data: `reject_review_${review._id}` }]] }
        });
    }
};

const handleAdminCallback = async (bot, callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    try {
        if (data.startsWith('approve_review_')) {
            const reviewId = data.split('_')[2];
            const review = await Review.findByIdAndUpdate(reviewId, { isApproved: true }, { new: true }).populate('productId', 'name');
            if (!review) throw new Error('Отзыв не найден');
            const productName = review.productId ? review.productId.name : 'Неизвестный товар';

            // Обновляем средний рейтинг продукта
            if (review.productId) {
                const reviews = await Review.find({ productId: review.productId, isApproved: true });
                const averageRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
                await Product.updateOne({ _id: review.productId }, { averageRating });
            }

            // Сбрасываем кэш продуктов
            global.productCache = null; // Явно сбрасываем глобальный кэш

            await bot.editMessageText(`Отзыв одобрен!\nТовар: ${productName}\nРейтинг: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}\nКомментарий: ${review.comment}`, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                parse_mode: 'Markdown'
            });

            // Оповещаем пользователя, оставившего отзыв, что его отзыв опубликован
            const userChatId = review.userId;
            await bot.sendMessage(userChatId, `Ваш отзыв на "${productName}" опубликован!\nРейтинг: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}\nКомментарий: ${review.comment}`, {
                parse_mode: 'Markdown'
            });
        } else if (data.startsWith('reject_review_')) {
            const reviewId = data.split('_')[2];
            const review = await Review.findById(reviewId).populate('productId', 'name');
            if (!review) throw new Error('Отзыв не найден');
            const productName = review.productId ? review.productId.name : 'Неизвестный товар';
            await Review.deleteOne({ _id: reviewId });

            if (review.productId) {
                const reviews = await Review.find({ productId: review.productId, isApproved: true });
                const averageRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
                await Product.updateOne({ _id: review.productId }, { averageRating });
            }

            global.productCache = null;

            await bot.editMessageText(`Отзыв отклонён и удалён!\nТовар: ${productName}`, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id
            });
        }
        bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`);
        bot.answerCallbackQuery(callbackQuery.id);
    }
};

module.exports = { handleAdmin, showProducts, addProduct, editProduct, deleteProduct, moderateReviews, handleAdminCallback };