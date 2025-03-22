const Product = require('../models/product');

const handleAdmin = async (bot, msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, '🛠 Админ-панель:', {
    reply_markup: {
      keyboard: [
        ['Показать товары', 'Добавить товар'],
        ['Редактировать товар', 'Удалить товар'],
        ['Модерация отзывов', 'Назад в меню']
      ],
      resize_keyboard: true
    }
  });
};

const showStats = async (bot, chatId) => {
  // Здесь может быть статистика, если нужно
};

const showProducts = async (bot, chatId) => {
  try {
    const products = await Product.find();
    if (products.length === 0) {
      await bot.sendMessage(chatId, '📦 Товаров пока нет');
      return;
    }
    const productList = products.map(p =>
        `ID: ${p._id}\n` +
        `Название: ${p.name}\n` +
        `Описание: ${p.description}\n` +
        `Цена (клуб): ${p.clubPrice} ₽\n` +
        `Цена (клиент): ${p.clientPrice} ₽\n` +
        `Рейтинг: ${p.averageRating}\n` +
        `Изображение: ${p.image}\n`
    ).join('\n---\n');
    await bot.sendMessage(chatId, `📦 Список товаров:\n\n${productList}`);
  } catch (error) {
    console.error('Ошибка показа товаров:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке товаров');
  }
};

const addProduct = async (bot, chatId) => {
  await bot.sendMessage(chatId, '📦 Введите данные нового товара в формате:\n`Название|Описание|Цена (клуб)|Цена (клиент)|URL изображения`', { parse_mode: 'Markdown' });
  bot.once('message', async (msg) => {
    const [name, description, clubPrice, clientPrice, image] = msg.text.split('|');
    if (!name || !description || !clubPrice || !clientPrice || !image) {
      await bot.sendMessage(chatId, '❌ Неверный формат. Попробуйте снова.');
      return;
    }
    try {
      const product = new Product({
        name,
        description,
        clubPrice: parseInt(clubPrice),
        clientPrice: parseInt(clientPrice),
        image,
        stock: 0, // Для ознакомления stock не важен
        averageRating: 0
      });
      await product.save();
      await bot.sendMessage(chatId, `✅ Товар "${name}" успешно добавлен!`);
    } catch (error) {
      console.error('Ошибка добавления товара:', error);
      await bot.sendMessage(chatId, '❌ Ошибка при добавлении товара');
    }
  });
};

const editProduct = async (bot, chatId) => {
  await bot.sendMessage(chatId, '📦 Введите ID товара для редактирования:');
  bot.once('message', async (msg) => {
    const productId = msg.text;
    const product = await Product.findById(productId);
    if (!product) {
      await bot.sendMessage(chatId, '❌ Товар не найден');
      return;
    }
    await bot.sendMessage(chatId, `Текущие данные:\n${product.name}|${product.description}|${product.clubPrice}|${product.clientPrice}|${product.image}\n\nВведите новые данные в формате:\n\`Название|Описание|Цена (клуб)|Цена (клиент)|URL изображения\``);
    bot.once('message', async (msg) => {
      const [name, description, clubPrice, clientPrice, image] = msg.text.split('|');
      if (!name || !description || !clubPrice || !clientPrice || !image) {
        await bot.sendMessage(chatId, '❌ Неверный формат. Попробуйте снова.');
        return;
      }
      try {
        await Product.updateOne({ _id: productId }, {
          name,
          description,
          clubPrice: parseInt(clubPrice),
          clientPrice: parseInt(clientPrice),
          image
        });
        await bot.sendMessage(chatId, `✅ Товар "${name}" успешно обновлён!`);
      } catch (error) {
        console.error('Ошибка редактирования товара:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при редактировании товара');
      }
    });
  });
};

const deleteProduct = async (bot, chatId) => {
  await bot.sendMessage(chatId, '📦 Введите ID товара для удаления:');
  bot.once('message', async (msg) => {
    const productId = msg.text;
    const product = await Product.findById(productId);
    if (!product) {
      await bot.sendMessage(chatId, '❌ Товар не найден');
      return;
    }
    try {
      await Product.deleteOne({ _id: productId });
      await bot.sendMessage(chatId, `✅ Товар "${product.name}" успешно удалён!`);
    } catch (error) {
      console.error('Ошибка удаления товара:', error);
      await bot.sendMessage(chatId, '❌ Ошибка при удалении товара');
    }
  });
};

const moderateReviews = async (bot, chatId) => {
  // Существующий код модерации отзывов
};

const handleAdminCallback = async (bot, callbackQuery) => {
  // Существующий код обработки callback-запросов админа
};

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