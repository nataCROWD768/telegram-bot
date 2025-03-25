const handleCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  // Заглушка: пока просто подтверждаем callback
  bot.answerCallbackQuery(callbackQuery.id, { text: 'Действие пока не реализовано' });
};

const searchProducts = async (bot, chatId, query) => {
  await bot.sendMessage(chatId, `Поиск товаров по запросу: ${query} (в разработке)`);
};

module.exports = { handleCallback, searchProducts };