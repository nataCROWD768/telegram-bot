const Order = require('../models/order');

async function showProfile(bot, chatId) {
  bot.sendMessage(chatId, 'Ваш профиль (в разработке)');
}

async function showOrderHistory(bot, chatId) {
  const orders = await Order.find({ userId: chatId }).populate('productId', 'name');
  if (orders.length === 0) {
    await bot.sendMessage(chatId, 'История заказов пуста');
  } else {
    const orderList = orders.map(o =>
        `Товар: ${o.productId.name}\nКоличество: ${o.quantity}\nСумма: ${o.totalPrice} руб.\nДата: ${o.createdAt.toLocaleDateString()}`
    ).join('\n---\n');
    await bot.sendMessage(chatId, `История заказов:\n\n${orderList}`);
  }
}

module.exports = { showProfile, showOrderHistory };