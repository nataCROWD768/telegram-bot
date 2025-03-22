const Product           = require('../models/product');
const Order             = require('../models/order');
const Review            = require('../models/review');

module.exports = {
  handleCallback: async (bot, callbackQuery) => {
    const chatId    = callbackQuery.message.chat.id;
    const data      = callbackQuery.data;

    if (data.startsWith('product_')) {
      const productId = data.split('_')[1];
      const product   = await Product.findById(productId);
      const reviews   = await Review.find({ productId, isApproved: true }).limit(3);

      let reviewsText = '\n*Последние отзывы:*\n';
      reviews.forEach(r => {
        reviewsText += `@${r.username}: ${r.rating}/5 - ${r.comment}\n`;
      });

      const caption = `
                *${product.name}* (${product.category})
                
                ${product.description}
                
                Клиентская цена: ${product.clientPrice} руб.
                Клубная цена: ${product.clubPrice} руб.
                Рейтинг: ★ ${product.averageRating.toFixed(1)}
                ${reviews.length > 0 ? reviewsText : 'Отзывов пока нет'}
            `;

      await bot.sendPhoto(chatId, product.image, {
        caption,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: `Заказать (${product.clubPrice} руб.)`, callback_data: `order_${product._id}` }],
            [{ text: 'Оставить отзыв', callback_data: `review_${product._id}` }]
          ]
        }
      });
    }

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
    try {
      const products = await Product.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      }).limit(10);

      if (products.length === 0) {
        await bot.sendMessage(chatId, '🔍 Ничего не найдено');
        return;
      }

      let message = '*Результаты поиска:*\n\n';
      products.forEach((product, index) => {
        message += `${index + 1}. *${product.name}*\n`;
        message += `Клиентская: ${product.clientPrice} руб.\n`;
        message += `Клубная: ${product.clubPrice} руб.\n`;
        message += `Рейтинг: ★ ${product.averageRating.toFixed(1)}\n\n`;
      });

      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '📋 Категории', callback_data: 'categories' }]]
        }
      });
    } catch (error) {
      console.error(error);
      await bot.sendMessage(chatId, '❌ Ошибка при поиске');
    }
  }
};