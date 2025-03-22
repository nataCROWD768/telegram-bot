const Product = require('../models/product');

async function handleCallback(bot, callbackQuery) {
  // Пустой обработчик для callback-запросов, если потребуется
}

async function searchProducts(bot, chatId, query) {
  const products = await Product.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ]
  });
  if (products.length === 0) {
    await bot.sendMessage(chatId, 'Товары не найдены');
  } else {
    const productList = products.map(p => `${p.name} - ${p.clubPrice} руб.`).join('\n');
    await bot.sendMessage(chatId, `Найденные товары:\n${productList}`);
  }
}

module.exports = { handleCallback, searchProducts };