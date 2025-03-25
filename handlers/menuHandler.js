async function handleMainMenu(bot, chatId) {
    const mainMenuKeyboard = {
        keyboard: [
            ['Личный кабинет', 'Витрина'],
            ['Бонусы и продукт', 'Отзывы']
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        persistent: true
    };

    const newMessage = await bot.sendMessage(chatId, 'Главное меню:', { reply_markup: mainMenuKeyboard });
    bot.lastMessageId[chatId] = newMessage.message_id;
}

module.exports = { handleMainMenu };