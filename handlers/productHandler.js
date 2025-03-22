const Product           = require('../models/product');
const Order             = require('../models/order');
const Review            = require('../models/review');
const sharp             = require('sharp');
const fs                = require('fs');
const path              = require('path');

// Папка для хранения миниатюр
const THUMBNAIL_DIR     = path.join(__dirname, '../public/thumbnails');
if (!fs.existsSync(THUMBNAIL_DIR)) {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

// Функция для создания миниатюры
const createThumbnail = async (imagePath) => {
  const thumbnailPath = path.join(THUMBNAIL_DIR, `thumb_${path.basename(imagePath)}`);

  // Если миниатюра уже существует, возвращаем её
  if (fs.existsSync(thumbnailPath)) {
    return thumbnailPath;
  }

  try {
    await sharp(imagePath)
        .resize(200, 200, { fit: 'cover' }) // Сжимаем до 200x200
        .jpeg({ quality: 80 }) // Уменьшаем качество для экономии размера
        .toFile(thumbnailPath);
    return thumbnailPath;
  } catch (error) {
    console.error(`Ошибка при создании миниатюры для ${imagePath}:`, error.message);
    return imagePath; // В случае ошибки возвращаем оригинал
  }
};

module.exports = {
  showProducts: async (bot, chatId, category = null) => {
    try {
      const query     = category ? { category } : {};
      const products  = await Product.find(query);

      if (products.length === 0) {
        await bot.sendMessage(chatId, '🛒 Товары в этой категории отсутствуют');
        return;
      }

      // Отправляем товары с миниатюрами
      for (const product of products) {
        const thumbnail = await createThumbnail(product.image);
        const caption = `
                    *${product.name}*
                    Клиентская: ${product.clientPrice} руб.
                    Клубная: ${product.clubPrice} руб.
                `;

        await bot.sendPhoto(chatId, thumbnail, {
          caption,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Подробнее', callback_data: `product_${product._id}` }]
            ]
          }
        });
      }

      // Кнопка для категорий
      await bot.sendMessage(chatId, 'Выберите категорию или продолжайте просмотр:', {
        reply_markup: {
          inline_keyboard: [[{ text: '📋 Категории', callback_data: 'categories' }]]
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
        ...categories.map(cat => [{ text: cat, callback_data: `cat_${cat}` }]),
        [{ text: 'Все товары', callback_data: 'all_products' }]
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

      await bot.sendPhoto(chatId, product.image, { // Оригинальное изображение для карточки
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
    if (data.startsWith('cat_')) module.exports.showProducts(bot, chatId, data.split('_')[1]);
    if (data === 'all_products') module.exports.showProducts(bot, chatId);
    if (data === 'back_to_products') module.exports.showProducts(bot, chatId);
  },

  searchProducts: async (bot, chatId, query) => {
    try {
      const products = await Product.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      });

      if (products.length === 0) {
        await bot.sendMessage(chatId, '🔍 Ничего не найдено');
        return;
      }

      for (const product of products) {
        const thumbnail = await createThumbnail(product.image);
        const caption = `
                    *${product.name}*
                    Клиентская: ${product.clientPrice} руб.
                    Клубная: ${product.clubPrice} руб.
                `;

        await bot.sendPhoto(chatId, thumbnail, {
          caption,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Подробнее', callback_data: `product_${product._id}` }]
            ]
          }
        });
      }

      await bot.sendMessage(chatId, '🔍 Результаты поиска:', {
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