function handleMainMenu(bot, chatId) {
  bot.sendMessage(chatId, 'Выберите пункт меню:', {
    reply_markup: {
      keyboard: [
        ['Личный кабинет', 'Витрина'],
        ['Бонусы и продукт', 'Отзывы'],
        ['История заказов']
      ],
      resize_keyboard: true
    }
  });
}

module.exports = { handleMainMenu };