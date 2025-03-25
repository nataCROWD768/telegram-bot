const Visit = require('../models/visit');

const showProfile = async (bot, msg) => {
  const chatId = msg.chat.id;
  const { first_name, last_name, username } = msg.from;

  try {
    const visit = await Visit.findOne({ userId: chatId });
    if (!visit) {
      await bot.sendMessage(chatId, '❌ Профиль не найден');
      return;
    }

    // Формируем имя: "Фамилия Имя" или только "Имя", если фамилии нет
    const fullName = last_name ? `${last_name} ${first_name}` : first_name;

    // Красиво оформленный текст профиля
    const profileText = `
✨ **Личный кабинет** ✨
═══════════════════════
👤 **Имя:** _${fullName}_
🌐 **Ваша реферальная ссылка:**
[🔗 Присоединяйтесь в клуб Radar GP!](https://my.radargp.com/club/0000046C)
═══════════════════════
💡 _Используйте ссылку, чтобы пригласить друзей и получить бонусы!_
    `.trim();

    await bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
  } catch (error) {
    await bot.sendMessage(chatId, '❌ Ошибка');
  }
};

module.exports = { showProfile };