const Product           = require('../models/product');
const Order             = require('../models/order');
const Review            = require('../models/review');

module.exports = {
  showProducts: async (bot, chatId) => {
    const webAppUrl = `https://${process.env.RENDER_APP_NAME}.onrender.com/`;
    await bot.sendMessage(chatId, '🛒 Открываем витрину товаров...', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Перейти в витрину', web_app: { url: webAppUrl } }]
        ]
      }
    });
  },

  showCategories: async (bot, chatId) => {
    // Оставляем как есть, если нужно
  },

  handleCallback: async (bot, callbackQuery) => {
    const chatId    = callbackQuery.message.chat.id;
    const data      = callbackQuery.data;

    if (data.startsWith('order_')) {
      const productId = data.split('_')[1];
      await bot.sendMessage(chatId, '📦 Введите количество:', {
        reply_markup: {
          force_reply: true,
          input_field_placeholder: 'Например: 2'
        }
      });
      bot.once('message', async (msg) => {
        const quantity  = parseInt(msg.text);
        const product   = await Product.findById(productId);

        if (isNaN(quantity) || quantity <= 0) {
          await bot.sendMessage(chatId, '❌ Неверное количество');
          return;
        }

        const order = await Order.create({
          userId:     chatId,
          username:   msg.from.username,
          productId,
          quantity,
          totalPrice: quantity * product.clubPrice
        });

        product.stock -= quantity;
        await product.save();

        await bot.sendMessage(chatId, `✅ Заказ оформлен! Сумма: ${order.totalPrice} руб.`);
      });
    }

    if (data.startsWith('review_')) {
      const productId = data.split('_')[1];
      await bot.sendMessage(chatId, '📝 Оставьте отзыв в формате: рейтинг(1-5);комментарий', {
        reply_markup: { force_reply: true }
      });

      bot.once('message', async (msg) => {
        const [rating, comment] = msg.text.split(';');
        const numRating         = parseInt(rating);

        if (isNaN(numRating) || numRating < 1 || numRating > 5) {
          await bot.sendMessage(chatId, '❌ Неверный формат рейтинга');
          return;
        }

        await Review.create({
          userId:     chatId,
          username:   msg.from.username,
          productId,
          rating:     numRating,
          comment
        });

        await bot.sendMessage(chatId, 'Спасибо за ваш отзыв! Он будет опубликован после модерации.');
      });
    }
  },

  searchProducts: async (bot, chatId, query) => {
    // Можно оставить текстовый поиск или интегрировать в Web App
  }
};