const Order = require('../models/order');

module.exports = {
  showProfile: async (bot, chatId) => {
    const orders = await Order.find({ userId: chatId })
      .populate('productId')
      .sort({ createdAt: -1 })
      .limit(5);

    let response = '*Ваш личный кабинет*\n\n';
    response += 'Последние заказы:\n';

    if (orders.length === 0) {
      response += 'У вас пока нет заказов';
    } else {
      orders.forEach((order, index) => {
        response += `${index + 1}. ${order.productId.name}\n`;
        response += `Количество: ${order.quantity}\n`;
        response += `Сумма: ${order.totalPrice} руб.\n`;
        response += `Статус: ${order.status}\n\n`;
      });
    }

    bot.sendMessage(chatId, response, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [['История заказов'], ['Назад в меню']],
        resize_keyboard: true
      }
    });
  },

  showOrderHistory: async (bot, chatId) => {
    const orders = await Order.find({ userId: chatId }).populate('productId');
    let response = '*История заказов*\n\n';
    
    orders.forEach((order, index) => {
      response += `${index + 1}. ${order.productId.name}\n`;
      response += `Дата: ${order.createdAt.toLocaleDateString()}\n`;
      response += `Сумма: ${order.totalPrice} руб.\n\n`;
    });

    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  }
};