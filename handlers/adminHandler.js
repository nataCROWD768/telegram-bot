const TelegramBot = require('node-telegram-bot-api');
const Review = require('../models/review');
const Product = require('../models/product');

const ADMIN_ID = process.env.ADMIN_ID || 'YOUR_ADMIN_ID_HERE';

function handleAdmin(bot, msg) {
  const chatId = msg.chat.id;
  if (chatId.toString() !== ADMIN_ID) return;

  bot.sendMessage(chatId, '👨‍💼 Админ-панель:', {
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
}

async function moderateReviews(bot, chatId) {
  const reviews = await Review.find({ isApproved: false }).populate('productId', 'name');
  if (reviews.length === 0) {
    await bot.sendMessage(chatId, 'Нет отзывов на модерации');
    return;
  }

  reviews.forEach(async (review, index) => {
    const message = `
            Отзыв #${index + 1}
            Товар: ${review.productId.name}
            Пользователь: ${review.username}
            Рейтинг: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
            Комментарий: ${review.comment}
        `;
    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Утвердить', callback_data: `approve_review_${review._id}` },
            { text: 'Отклонить', callback_data: `reject_review_${review._id}` }
          ]
        ]
      }
    });
  });
}

async function handleAdminCallback(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (chatId.toString() !== ADMIN_ID) return;

  if (data.startsWith('approve_review_')) {
    const reviewId = data.split('_')[2];
    const review = await Review.findById(reviewId);
    if (review) {
      review.isApproved = true;
      await review.save();
      await bot.editMessageText(`${callbackQuery.message.text}\n\n✅ Утверждён`, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      });
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Отзыв утверждён' });
    }
  } else if (data.startsWith('reject_review_')) {
    const reviewId = data.split('_')[2];
    const review = await Review.findByIdAndDelete(reviewId);
    if (review) {
      await bot.editMessageText(`${callbackQuery.message.text}\n\n❌ Отклонён`, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      });
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Отзыв отклонён' });
    }
  }
}

async function showStats(bot, chatId) {
  bot.sendMessage(chatId, 'Статистика (в разработке)');
}

async function showProducts(bot, chatId) {
  const products = await Product.find();
  if (products.length === 0) {
    await bot.sendMessage(chatId, 'Товаров нет');
  } else {
    const productList = products.map(p => `${p.name} - ${p.clubPrice} руб.`).join('\n');
    await bot.sendMessage(chatId, `Список товаров:\n${productList}`);
  }
}

async function addProduct(bot, chatId) {
  bot.sendMessage(chatId, 'Добавление товара (в разработке)');
}

async function editProduct(bot, chatId) {
  bot.sendMessage(chatId, 'Редактирование товара (в разработке)');
}

async function deleteProduct(bot, chatId) {
  bot.sendMessage(chatId, 'Удаление товара (в разработке)');
}

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