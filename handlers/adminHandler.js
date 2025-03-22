const Visit = require('../models/visit');
const Product = require('../models/product');
const Order = require('../models/order');
const Review = require('../models/review');
const { adminId } = require('../config/botConfig');

module.exports = {
  handleAdmin: async (bot, msg) => {
    if (msg.from.id.toString() !== adminId) {
      bot.sendMessage(msg.chat.id, 'Доступ запрещен');
      return;
    }

    bot.sendMessage(msg.chat.id, 'Админ-панель:', {
      reply_markup: {
        keyboard: [
          ['Статистика', 'Список товаров'],
          ['Добавить товар', 'Редактировать товар'],
          ['Удалить товар', 'Модерация отзывов'],
          ['Назад в меню']
        ],
        resize_keyboard: true
      }
    });
  },

  showStats: async (bot, chatId) => {
    const visits = await Visit.countDocuments();
    const orders = await Order.countDocuments();
    const products = await Product.countDocuments();
    const reviews = await Review.countDocuments();
    const pendingReviews = await Review.countDocuments({ isApproved: false });

    const response = `
*Статистика:*
Посещений: ${visits}
Заказов: ${orders}
Товаров: ${products}
Отзывов: ${reviews}
Ожидают модерации: ${pendingReviews}
    `;
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  },

  showProducts: async (bot, chatId) => {
    const products = await Product.find();
    let response = '*Список товаров:*\n\n';
    products.forEach((p, i) => {
      response += `${i + 1}. ${p.name} (ID: ${p._id})\n`;
      response += `Цена клуба: ${p.clubPrice} руб.\n`;
      response += `Остаток: ${p.stock} шт.\n\n`;
    });
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  },

  addProduct: async (bot, chatId) => {
    bot.sendMessage(chatId, 'Введите данные нового товара в формате:\nназвание;описание;категория;цена_клиента;цена_клуба;остаток', {
      reply_markup: { force_reply: true }
    });

    bot.once('message', async (msg) => {
      const [name, description, category, clientPrice, clubPrice, stock] = msg.text.split(';');
      bot.sendMessage(chatId, 'Отправьте фото товара:', { reply_markup: { force_reply: true } });

      bot.once('message', async (photoMsg) => {
        if (!photoMsg.photo) {
          bot.sendMessage(chatId, 'Пожалуйста, отправьте фото');
          return;
        }

        const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id;
        const filePath = await bot.getFileLink(fileId);

        try {
          const product = await Product.create({
            name,
            description,
            category,
            clientPrice: parseInt(clientPrice),
            clubPrice: parseInt(clubPrice),
            stock: parseInt(stock),
            image: filePath // Сохраняем ссылку на фото
          });
          bot.sendMessage(chatId, `Товар ${product.name} добавлен с ID: ${product._id}`);
        } catch (error) {
          bot.sendMessage(chatId, 'Ошибка при добавлении товара');
        }
      });
    });
  },

  editProduct: async (bot, chatId) => {
    bot.sendMessage(chatId, 'Введите ID товара для редактирования:', {
      reply_markup: { force_reply: true }
    });

    bot.once('message', async (msg) => {
      const productId = msg.text;
      const product = await Product.findById(productId);
      if (!product) {
        bot.sendMessage(chatId, 'Товар не найден');
        return;
      }

      bot.sendMessage(chatId, `Текущие данные:\n${product.name}\n${product.description}\n${product.category}\n${product.clientPrice}/${product.clubPrice}\n${product.stock}\n\nВведите новые данные в формате:\nназвание;описание;категория;цена_клиента;цена_клуба;остаток`, {
        reply_markup: { force_reply: true }
      });

      bot.once('message', async (msg) => {
        const [name, description, category, clientPrice, clubPrice, stock] = msg.text.split(';');
        try {
          await Product.findByIdAndUpdate(productId, {
            name,
            description,
            category,
            clientPrice: parseInt(clientPrice),
            clubPrice: parseInt(clubPrice),
            stock: parseInt(stock)
          });
          bot.sendMessage(chatId, 'Товар обновлен');
        } catch (error) {
          bot.sendMessage(chatId, 'Ошибка при обновлении');
        }
      });
    });
  },

  deleteProduct: async (bot, chatId) => {
    bot.sendMessage(chatId, 'Введите ID товара для удаления:', {
      reply_markup: { force_reply: true }
    });

    bot.once('message', async (msg) => {
      const productId = msg.text;
      const product = await Product.findByIdAndDelete(productId);
      if (!product) {
        bot.sendMessage(chatId, 'Товар не найден');
        return;
      }
      bot.sendMessage(chatId, `Товар ${product.name} удален`);
    });
  },

  moderateReviews: async (bot, chatId) => {
    const reviews = await Review.find({ isApproved: false }).populate('productId');
    if (reviews.length === 0) {
      bot.sendMessage(chatId, 'Нет отзывов на модерации');
      return;
    }

    for (const review of reviews) {
      const text = `
Отзыв от @${review.username} к ${review.productId.name}:
Рейтинг: ${review.rating}/5
Комментарий: ${review.comment}
      `;
      await bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Одобрить', callback_data: `approve_${review._id}` }],
            [{ text: 'Отклонить', callback_data: `reject_${review._id}` }]
          ]
        }
      });
    }
  },

  handleAdminCallback: async (bot, callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('approve_')) {
      const reviewId = data.split('_')[1];
      await Review.findByIdAndUpdate(reviewId, { isApproved: true });
      const review = await Review.findById(reviewId).populate('productId');
      const reviews = await Review.find({ productId: review.productId, isApproved: true });
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await Product.findByIdAndUpdate(review.productId, { averageRating: avgRating });
      bot.sendMessage(chatId, 'Отзыв одобрен');
    }

    if (data.startsWith('reject_')) {
      const reviewId = data.split('_')[1];
      await Review.findByIdAndDelete(reviewId);
      bot.sendMessage(chatId, 'Отзыв отклонен');
    }
  }
};