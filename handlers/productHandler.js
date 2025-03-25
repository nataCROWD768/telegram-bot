const Product = require('../models/product');

async function searchProducts(bot, chatId, query) {
  try {
    const products = await Product.find({
      $or: [{ name: { $regex: query, $options: 'i' } }, { description: { $regex: query, $options: 'i' } }]
    });
    if (!products.length) return await bot.sendMessage(chatId, 'Товары не найдены');
    const productList = products.map(p => `${p.name} - ${p.clubPrice} руб.`).join('\n');
    await bot.sendMessage(chatId, `Найденные товары:\n${productList}`);
  } catch (error) {
    await bot.sendMessage(chatId, '❌ Ошибка при поиске товаров');
  }
}

module.exports = { searchProducts };