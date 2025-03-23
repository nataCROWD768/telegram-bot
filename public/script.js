// Проверка, является ли устройство мобильным
function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
}

// Ограничение доступа для не-мобильных устройств
document.addEventListener('DOMContentLoaded', () => {
    if (!isMobileDevice()) {
        // Скрываем основное содержимое
        document.getElementById('app-content').style.display = 'none';
        // Показываем сообщение
        document.getElementById('mobile-only-message').style.display = 'block';
        return; // Прекращаем выполнение скрипта
    }

    // Если устройство мобильное, продолжаем выполнение
    const products = [
        { id: 1, name: 'НАБОР «МОЛОДОСТЬ»', description: 'Описание 1', image: '/images/image1.jpg', clubPrice: 1000, clientPrice: 1200, rating: 4.5 },
        { id: 2, name: 'МАСЛО СBD, 10%', description: 'Описание 2', image: '/images/image2.jpg', clubPrice: 1500, clientPrice: 1800, rating: 4.0 },
        { id: 3, name: 'БИОЙОДИН 150', description: 'Описание 3', image: '/images/image3.jpg', clubPrice: 2000, clientPrice: 2400, rating: 4.8 },
        { id: 4, name: 'БИОЛАСТИН', description: 'Описание 4', image: '/images/image4.jpg', clubPrice: 800, clientPrice: 1000, rating: 3.5 },
        { id: 5, name: 'CONTROL RGP - молекулярный гель на основе Фукуса и Арганового масла', description: 'Описание 5', image: '/images/image5.jpg', clubPrice: 1200, clientPrice: 1400, rating: 4.2 },
        { id: 6, name: 'DETOX RGP - молекулярный гель на основе Фукуса и Арганового масла', description: 'Описание 6', image: '/images/image6.jpg', clubPrice: 1100, clientPrice: 1300, rating: 4.3 },
        { id: 7, name: 'SLIM RGP - молекулярный гель на основе Фукуса и Арганового масла', description: 'Описание 7', image: '/images/image7.jpg', clubPrice: 900, clientPrice: 1100, rating: 4.1 },
        { id: 8, name: 'ХВОЙНЫЙ БАЛЬЗАМ', description: 'Описание 8', image: '/images/image8.jpg', clubPrice: 1600, clientPrice: 1900, rating: 4.7 },
        { id: 9, name: 'ВОДНЫЙ ЭКСТРАКТ ПРОПОЛИСА', description: 'Описание 9', image: '/images/image9.jpg', clubPrice: 1300, clientPrice: 1500, rating: 4.4 }
    ];

    // Функция для рендеринга списка товаров
    function renderProducts(productArray) {
        const productList = document.getElementById('product-list');
        productList.innerHTML = ''; // Очищаем список перед рендерингом

        productArray.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="card-image">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="rating">★ ${product.rating}</div>
                </div>
                <div class="card-content">
                    <h3>${product.name}</h3>
                    <div class="prices">
                        <div class="price-container">
                            <i class="fas fa-crown price-icon"></i>
                            <span class="club-price">${product.clubPrice} ₽</span>
                        </div>
                        <div class="price-container">
                            <i class="fas fa-user price-icon"></i>
                            <span class="client-price">${product.clientPrice} ₽</span>
                        </div>
                    </div>
                    <div class="card-button">
                        <a href="#">Карточка продукта</a>
                    </div>
                </div>
            `;
            productList.appendChild(card);
        });
    }

    // Инициализация списка товаров
    renderProducts(products);

    // Поиск товаров
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProducts = products.filter(product =>
            product.name.toLowerCase().includes(searchTerm)
        );
        renderProducts(filteredProducts);
    });
});