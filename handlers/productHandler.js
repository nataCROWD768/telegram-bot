const Product           = require('../models/product');
const Order             = require('../models/order');
const Review            = require('../models/review');

const ITEMS_PER_PAGE    = 10; // Количество товаров на странице

module.exports = {
  showProducts: async (bot, chatId, category = null, page = 1) => {
    try {
      const query     = category ? { category } : {};
      const total     = await Product.countDocuments(query);
      const products  = await Product.find(query)
          .skip((page - 1) * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE);

      if (products.length === 0) {
        await bot.sendMessage(chatId, '🛒 Товары в этой категории отсутствуют');
        return;
      }

      let message = `*Витрина товаров (стр. ${page}/${Math.ceil(total / ITEMS_PER_PAGE)}):*\n\n`;
      products.forEach((product, index) => {
        message += `${(page - 1) * ITEMS_PER_PAGE + index + 1}. *${product.name}*\n`;
        message += `Клиентская: ${product.clientPrice} руб.\n`;
        message += `Клубная: ${product.clubPrice} руб.\n`;
        message += `Рейтинг: ★ ${product.averageRating.toFixed(1)}\n\n`;
      });

      const keyboard = [];
      if (page > 1) {
        keyboard.push([{ text: '⬅️ Назад', callback_data: `products_${category || 'all'}_${page - 1}` }]);
      }
      if (page < Math.ceil(total / ITEMS_PER_PAGE)) {
        keyboard.push([{ text: 'Вперед ➡️', callback_data: `products_${category || 'all'}_${page + 1}` }]);
      }
      keyboard.push([{ text: '📋 Категории', callback_data: 'categories' }]);

      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error(error);
      await bot.sendMessage(chatId, '❌ Ошибка при загрузке витрины');
    }
  },

  showCategories: async (bot, chatId) => {
    try {
      const categories = await Product.distinct('category');
      const keyboard   = [
        ...categories.map(cat => [{ text: cat, callback_data: `cat_${cat}_1` }]),
        [{ text: 'Все товары', callback_data: 'products_all_1' }]
      ];

      await bot.sendMessage(chatId, '📋 Выберите категорию:', {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error(error);
      await bot.sendMessage(chatId, '❌ Ошибка при загрузке категорий');
    }
  },

  handleCallback: async (bot, callbackQuery) => {
    const chatId    = callbackQuery.message.chat.id;
    const data      = callbackQuery.data;

    if (data.startsWith('products_')) {
      const [_, category, page] = data.split('_');
      module.exports.showProducts(bot, chatId, category === 'all' ? null : category, parseInt(page));
    }

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
            [{ text: 'Оставить отзыв', callback_data: `review_${product._id}` }],
            [{ text: 'Назад', callback_data: 'back_to_products' }]
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

    if (data === 'categories') module.exports.showCategories(bot, chatId);
    if (data.startsWith('cat_')) {
      const [_, category, page] = data.split('_');
      module.exports.showProducts(bot, chatId, category, parseInt(page));
    }
    if (data === 'back_to_products') module.exports.showProducts(bot, chatId);
  },

  searchProducts: async (bot, chatId, query) => {
    try {
      const products = await Product.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      }).limit(ITEMS_PER_PAGE);

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