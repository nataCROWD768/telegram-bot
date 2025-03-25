const Product = require('../models/product');
const Review = require('../models/review');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');
const { formatDate } = require('../utils'); // Импорт из utils.js

const STORAGE_CHAT_ID = '-2304626004';

const handleAdmin = async (bot, msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, '🛠 Админ-панель:', {
        reply_markup: {
            keyboard: [['Показать товары', 'Добавить товар'], ['Редактировать товар', 'Удалить товар'], ['Модерация отзывов', 'Назад в меню']],
            resize_keyboard: true
        }
    });
};

const showProducts = async (bot, chatId) => {
    try {
        const products = await Product.find();
        if (!products.length) return await bot.sendMessage(chatId, '📦 Товаров пока нет');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Товары');
        worksheet.columns = [
            { header: 'ID', key: '_id', width: 25 },
            { header: 'Название', key: 'name', width: 30 },
            { header: 'Описание', key: 'description', width: 40 },
            { header: 'Цена (клуб)', key: 'clubPrice', width: 15 },
            { header: 'Цена (клиент)', key: 'clientPrice', width: 15 },
            { header: 'Рейтинг', key: 'averageRating', width: 10 },
            { header: 'Изображение (file_id)', key: 'image', width: 40 }
        ];

        worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0088CC' } };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        products.forEach(product => worksheet.addRow(product.toObject()));
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.eachCell(cell => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                });
            }
        });

        const filePath = path.join(__dirname, '../products.xlsx');
        await workbook.xlsx.writeFile(filePath);
        await bot.sendDocument(chatId, filePath, { caption: 'Список товаров' }, { filename: 'Товары.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        await fs.unlink(filePath);
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Ошибка при выгрузке товаров');
    }
};

const collectInput = (bot, chatId, prompt) => new Promise((resolve) => {
    bot.sendMessage(chatId, prompt);
    bot.once('message', (msg) => resolve(msg.text));
});

const addProduct = async (bot, chatId) => {
    try {
        const productData = {};
        productData.name = await collectInput(bot, chatId, '📦 Добавление нового товара. Введите название:');
        productData.description = await collectInput(bot, chatId, 'Введите описание:');
        productData.clubPrice = parseInt(await collectInput(bot, chatId, 'Введите цену (клуб), руб.:'));
        if (isNaN(productData.clubPrice)) throw new Error('Неверная цена (клуб)');
        productData.clientPrice = parseInt(await collectInput(bot, chatId, 'Введите цену (клиент), руб.:'));
        if (isNaN(productData.clientPrice)) throw new Error('Неверная цена (клиент)');

        await bot.sendMessage(chatId, 'Отправьте изображение товара:');
        const photoMsg = await new Promise((resolve) => bot.once('message', resolve));
        if (!photoMsg.photo) throw new Error('Нет изображения');
        const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id;

        await bot.sendPhoto(STORAGE_CHAT_ID, fileId, { caption: `Изображение для товара: ${productData.name}` });
        productData.image = fileId;

        const product = new Product({ ...productData, stock: 0, averageRating: 0 });
        await product.save();
        await bot.sendMessage(chatId, `✅ Товар "${productData.name}" успешно добавлен!`);
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`);
    }
};

const editProduct = async (bot, chatId) => {
    try {
        const productId = await collectInput(bot, chatId, '📦 Введите ID товара для редактирования:');
        const product = await Product.findById(productId);
        if (!product) throw new Error('Товар не найден');

        const currentData = `${product.name}|${product.description}|${product.clubPrice}|${product.clientPrice}|${product.image}`;
        const newData = await collectInput(bot, chatId, `Текущие данные:\n${currentData}\n\nВведите новые данные в формате:\n\`Название|Описание|Цена (клуб)|Цена (клиент)|file_id изображения\``);
        const [name, description, clubPrice, clientPrice, image] = newData.split('|');
        if (!name || !description || !clubPrice || !clientPrice || !image) throw new Error('Неверный формат');

        if (image !== product.image) await bot.sendPhoto(STORAGE_CHAT_ID, image, { caption: `Новое изображение для товара: ${name}` });
        await Product.updateOne({ _id: productId }, { name, description, clubPrice: parseInt(clubPrice), clientPrice: parseInt(clientPrice), image });
        await bot.sendMessage(chatId, `✅ Товар "${name}" успешно обновлён!`);
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`);
    }
};

const deleteProduct = async (bot, chatId) => {
    try {
        const productId = await collectInput(bot, chatId, '📦 Введите ID товара для удаления:');
        const product = await Product.findById(productId);
        if (!product) throw new Error('Товар не найден');

        await Product.deleteOne({ _id: productId });
        await bot.sendMessage(chatId, `✅ Товар "${product.name}" успешно удалён!`);
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`);
    }
};

const moderateReviews = async (bot, chatId) => {
    try {
        const reviews = await Review.find({ isApproved: false }).populate('productId', 'name');
        if (!reviews.length) return await bot.sendMessage(chatId, '📝 Нет отзывов на модерацию');

        for (const review of reviews) {
            const productName = review.productId ? review.productId.name : 'Неизвестный товар';
            const reviewText = `Дата: ${formatDate(review.createdAt)}\nТовар: ${productName}\nПользователь: ${review.username.startsWith('@') ? review.username : '@' + review.username}\nРейтинг: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}\nКомментарий: ${review.comment}`;
            await bot.sendMessage(chatId, reviewText, {
                reply_markup: { inline_keyboard: [[{ text: 'Одобрить', callback_data: `approve_review_${review._id}` }, { text: 'Отклонить', callback_data: `reject_review_${review._id}` }]] }
            });
        }
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Ошибка при загрузке отзывов');
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
            if (review.productId) {
                const reviews = await Review.find({ productId: review.productId, isApproved: true });
                const averageRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
                await Product.updateOne({ _id: review.productId }, { averageRating });
            }
            await bot.editMessageText(`Отзыв одобрен!\nТовар: ${productName}`, { chat_id: chatId, message_id: callbackQuery.message.message_id });
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
            await bot.editMessageText(`Отзыв отклонён и удалён!\nТовар: ${productName}`, { chat_id: chatId, message_id: callbackQuery.message.message_id });
        }
        bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`);
        bot.answerCallbackQuery(callbackQuery.id);
    }
};

module.exports = { handleAdmin, showProducts, addProduct, editProduct, deleteProduct, moderateReviews, handleAdminCallback };