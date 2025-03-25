const formatDate = (date) => {
    const moscowTime = new Date(date).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return moscowTime; // Формат: "ДД.ММ.ГГГГ, ЧЧ:ММ:СС"
};

module.exports = { formatDate };