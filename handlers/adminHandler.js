const Product = require('../models/product');
const Review = require('../models/review');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

const handleAdmin = async (bot, msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, '🛠 Админ-панель:', {
        reply_markup: {
            keyboard: [
                ['Показать товары', 'Добавить товар'],
                ['Редактировать товар', 'Удалить товар'],
                ['Модерация отзывов', 'Назад в меню']
            ],
            resize_keyboard: true
        }
    });
};

const showStats = async (bot, chatId) => {
    // Здесь может быть статистика, если нужно
};

const showProducts = async (bot, chatId) => {
    try {
        const products = await Product.find();
        if (products.length === 0) {
            await bot.sendMessage(chatId, '📦 Товаров пока нет');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Товары');

        worksheet.columns = [
            { header: 'ID', key: '_id', width: 25 },
            { header: 'Название', key: 'name', width: 30 },
            { header: 'Описание', key: 'description', width: 40 },
            { header: 'Цена (клуб)', key: 'clubPrice', width: 15 },
            { header: 'Цена (клиент)', key: 'clientPrice', width: 15 },
            { header: 'Рейтинг', key: 'averageRating', width: 10 },
            { header: 'Изображение', key: 'image', width: 40 }
        ];

        worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0088CC' } };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        products.forEach(product => {
            worksheet.addRow({
                _id: product._id.toString(),
                name: product.name,
                description: product.description,
                clubPrice: product.clubPrice,
                clientPrice: product.clientPrice,
                averageRating: product.averageRating,
                image: product.image
            });
        });

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.eachCell(cell => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                });
            }
        });

        const filePath = path.join(__dirname, '../products.xlsx');
        await workbook.xlsx.writeFile(filePath);

        await bot.sendDocument(chatId, filePath, {
            caption: 'Список товаров'
        }, {
            filename: 'Товары.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        await fs.unlink(filePath);
    } catch (error) {
        console.error('Ошибка выгрузки товаров в Excel:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при выгрузке товаров');
    }
};

const addProduct = async (bot, chatId) => {
    let productData = {};

    await bot.sendMessage(chatId, '📦 Добавление нового товара. Введите название:');
    bot.once('message', async (msg) => {
        productData.name = msg.text;

        await bot.sendMessage(chatId, 'Введите описание:');
        bot.once('message', async (msg) => {
            productData.description = msg.text;

            await bot.sendMessage(chatId, 'Введите цену (клуб), руб.:');
            bot.once('message', async (msg) => {
                productData.clubPrice = parseInt(msg.text);
                if (isNaN(productData.clubPrice)) {
                    await bot.sendMessage(chatId, '❌ Цена должна быть числом. Попробуйте снова.');
                    return;
                }

                await bot.sendMessage(chatId, 'Введите цену (клиент), руб.:');
                bot.once('message', async (msg) => {
                    productData.clientPrice = parseInt(msg.text);
                    if (isNaN(productData.clientPrice)) {
                        await bot.sendMessage(chatId, '❌ Цена должна быть числом. Попробуйте снова.');
                        return;
                    }

                    await bot.sendMessage(chatId, 'Отправьте изображение товара:');
                    bot.once('message', async (msg) => {
                        if (!msg.photo) {
                            await bot.sendMessage(chatId, '❌ Пожалуйста, отправьте изображение.');
                            return;
                        }

                        const photo = msg.photo[msg.photo.length - 1];
                        const fileId = photo.file_id;
                        const file = await bot.getFile(fileId);
                        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;

                        productData.image = fileUrl;

                        try {
                            const product = new Product({
                                name: productData.name,
                                description: productData.description,
                                clubPrice: productData.clubPrice,
                                clientPrice: productData.clientPrice,
                                image: productData.image,
                                stock: 0,
                                averageRating: 0
                            });
                            await product.save();
                            await bot.sendMessage(chatId, `✅ Товар "${productData.name}" успешно добавлен!`);
                        } catch (error) {
                            console.error('Ошибка добавления товара:', error);
                            await bot.sendMessage(chatId, '❌ Ошибка при добавлении товара');
                        }
                    });
                });
            });
        });
    });
};

const editProduct = async (bot, chatId) => {
    await bot.sendMessage(chatId, '📦 Введите ID товара для редактирования:');
    bot.once('message', async (msg) => {
        const productId = msg.text;
        const product = await Product.findById(productId);
        if (!product) {
            await bot.sendMessage(chatId, '❌ Товар не найден');
            return;
        }
        await bot.sendMessage(chatId, `Текущие данные:\n${product.name}|${product.description}|${product.clubPrice}|${product.clientPrice}|${product.image}\n\nВведите новые данные в формате:\n\`Название|Описание|Цена (клуб)|Цена (клиент)|URL изображения\``);
        bot.once('message', async (msg) => {
            const [name, description, clubPrice, clientPrice, image] = msg.text.split('|');
            if (!name || !description || !clubPrice || !clientPrice || !image) {
                await bot.sendMessage(chatId, '❌ Неверный формат. Попробуйте снова.');
                return;
            }
            try {
                await Product.updateOne({ _id: productId }, {
                    name,
                    description,
                    clubPrice: parseInt(clubPrice),
                    clientPrice: parseInt(clientPrice),
                    image
                });
                await bot.sendMessage(chatId, `✅ Товар "${name}" успешно обновлён!`);
            } catch (error) {
                console.error('Ошибка редактирования товара:', error);
                await bot.sendMessage(chatId, '❌ Ошибка при редактировании товара');
            }
        });
    });
};

const deleteProduct = async (bot, chatId) => {
    await bot.sendMessage(chatId, '📦 Введите ID товара для удаления:');
    bot.once('message', async (msg) => {
        const productId = msg.text;
        const product = await Product.findById(productId);
        if (!product) {
            await bot.sendMessage(chatId, '❌ Товар не найден');
            return;
        }
        try {
            await Product.deleteOne({ _id: productId });
            await bot.sendMessage(chatId, `✅ Товар "${product.name}" успешно удалён!`);
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            await bot.sendMessage(chatId, '❌ Ошибка при удалении товара');
        }
    });
};

const moderateReviews = async (bot, chatId) => {
    try {
        const reviews = await Review.find({ isApproved: false }).populate('productId', 'name');
        if (reviews.length === 0) {
            await bot.sendMessage(chatId, '📝 Нет отзывов на модерацию');
            return;
        }

        for (const review of reviews) {
            const reviewText = `
                Товар: ${review.productId.name}
                Пользователь: ${review.username}
                Рейтинг: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                Комментарий: ${review.comment}
            `;
            await bot.sendMessage(chatId, reviewText, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Одобрить', callback_data: `approve_review_${review._id}` },
                            { text: 'Отклонить', callback_data: `reject_review_${review._id}` }
                        ]
                    ]
                }
            });
        }
    } catch (error) {
        console.error('Ошибка модерации отзывов:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при загрузке отзывов');
    }
};

const handleAdminCallback = async (bot, callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('approve_review_')) {
        const reviewId = data.split('_')[2];
        try {
            const review = await Review.findByIdAndUpdate(reviewId, { isApproved: true }, { new: true }).populate('productId', 'name');
            if (!review) {
                await bot.sendMessage(chatId, '❌ Отзыв не найден');
                return;
            }
            const reviews = await Review.find({ productId: review.productId, isApproved: true });
            const averageRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;
            await Product.updateOne({ _id: review.productId }, { averageRating });
            await bot.editMessageText(`Отзыв одобрен!\nТовар: ${review.productId.name}`, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id
            });
        } catch (error) {
            console.error('Ошибка одобрения отзыва:', error);
            await bot.sendMessage(chatId, '❌ Ошибка при одобрении отзыва');
        }
    } else if (data.startsWith('reject_review_')) {
        const reviewId = data.split('_')[2];
        try {
            const review = await Review.findById(reviewId).populate('productId', 'name');
            if (!review) {
                await bot.sendMessage(chatId, '❌ Отзыв не найден');
                return;
            }
            await Review.deleteOne({ _id: reviewId });
            const reviews = await Review.find({ productId: review.productId, isApproved: true });
            const averageRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;
            await Product.updateOne({ _id: review.productId }, { averageRating });
            await bot.editMessageText(`Отзыв отклонён и удалён!\nТовар: ${review.productId.name}`, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id
            });
        } catch (error) {
            console.error('Ошибка отклонения отзыва:', error);
            await bot.sendMessage(chatId, '❌ Ошибка при отклонении отзыва');
        }
    }

    bot.answerCallbackQuery(callbackQuery.id);
};

module.exports = {
    handleAdmin,
    showStats,
    showProducts,
    addProduct,
    editProduct,
    deleteProduct,
    moderateReviews,
    handleAdminCallback
};