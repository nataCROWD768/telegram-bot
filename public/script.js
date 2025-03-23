// Проверка, является ли устройство мобильным
function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
}

// Данные о продуктах
const products = [
    { id: 1, name: 'НАБОР «МОЛОДОСТЬ»', description: 'Набор для ухода за кожей, включающий увлажняющий крем, сыворотку и маску для лица. Идеально подходит для сохранения молодости и сияния кожи.', image: '/images/image1.jpg', clubPrice: 1000, clientPrice: 1200, rating: 4.5, reviews: [{ user: 'Анна', rating: 5, comment: 'Отличный набор! Кожа стала мягче и сияет.' }, { user: 'Мария', rating: 4, comment: 'Хороший продукт, но маска немного липкая.' }] },
    { id: 2, name: 'МАСЛО СBD, 10%', description: 'Натуральное масло CBD 10% для снятия стресса и улучшения сна. Подходит для ежедневного использования.', image: '/images/image2.jpg', clubPrice: 1500, clientPrice: 1800, rating: 4.0, reviews: [] },
    { id: 3, name: 'БИОЙОДИН 150', description: 'Биологически активная добавка с йодом для поддержки щитовидной железы и общего здоровья.', image: '/images/image3.jpg', clubPrice: 2000, clientPrice: 2400, rating: 4.8, reviews: [] },
    { id: 4, name: 'БИОЛАСТИН', description: 'Средство для укрепления волос и ногтей с биотином и коллагеном.', image: '/images/image4.jpg', clubPrice: 800, clientPrice: 1000, rating: 3.5, reviews: [] },
    { id: 5, name: 'CONTROL RGP - молекулярный гель на основе Фукуса и Арганового масла', description: 'Молекулярный гель для восстановления кожи, обогащённый экстрактом фукуса и аргановым маслом.', image: '/images/image5.jpg', clubPrice: 1200, clientPrice: 1400, rating: 4.2, reviews: [] },
    { id: 6, name: 'DETOX RGP - молекулярный гель на основе Фукуса и Арганового масла', description: 'Детокс-гель для очищения кожи с фукусом и аргановым маслом.', image: '/images/image6.jpg', clubPrice: 1100, clientPrice: 1300, rating: 4.3, reviews: [] },
    { id: 7, name: 'SLIM RGP - молекулярный гель на основе Фукуса и Арганового масла', description: 'Гель для коррекции фигуры с фукусом и аргановым маслом.', image: '/images/image7.jpg', clubPrice: 900, clientPrice: 1100, rating: 4.1, reviews: [] },
    { id: 8, name: 'ХВОЙНЫЙ БАЛЬЗАМ', description: 'Хвойный бальзам для тела с успокаивающим эффектом.', image: '/images/image8.jpg', clubPrice: 1600, clientPrice: 1900, rating: 4.7, reviews: [] },
    { id: 9, name: 'ВОДНЫЙ ЭКСТРАКТ ПРОПОЛИСА', description: 'Водный экстракт прополиса для укрепления иммунитета.', image: '/images/image9.jpg', clubPrice: 1300, clientPrice: 1500, rating: 4.4, reviews: [] }
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
                    <a href="#" class="product-detail-link" data-id="${product.id}">Карточка продукта</a>
                </div>
            </div>
        `;
        productList.appendChild(card);
    });

    // Добавляем обработчики событий для кнопок "Карточка продукта"
    document.querySelectorAll('.product-detail-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const productId = parseInt(e.target.getAttribute('data-id'));
            const product = products.find(p => p.id === productId);
            showProductDetail(product);
        });
    });
}

// Функция для отображения карточки товара
function showProductDetail(product) {
    const showcase = document.getElementById('showcase');
    const productDetail = document.getElementById('product-detail');
    const productDetailContent = document.querySelector('.product-detail-content');
    const headerTitle = document.querySelector('.header-title');
    const searchBar = document.querySelector('.search-bar');
    const backBtn = document.getElementById('back-to-showcase');

    // Скрываем витрину и показываем карточку товара
    showcase.style.display = 'none';
    productDetail.style.display = 'block';

    // Скрываем заголовок "Витрина" и строку поиска, показываем кнопку "Назад"
    headerTitle.style.display = 'none';
    searchBar.style.display = 'none';
    backBtn.style.display = 'flex';

    // Формируем содержимое карточки товара
    productDetailContent.innerHTML = `
        <div class="product-detail-image">
            <img src="${product.image}" alt="${product.name}">
            <div class="product-detail-rating">★ ${product.rating}</div>
        </div>
        <div class="product-detail-info">
            <h3>${product.name}</h3>
            <div class="product-detail-prices">
                <div class="price-container">
                    <i class="fas fa-crown price-icon"></i>
                    <span class="club-price">${product.clubPrice} ₽</span>
                    <span class="price-label">Клубная цена</span>
                </div>
                <div class="price-container">
                    <i class="fas fa-user price-icon"></i>
                    <span class="client-price">${product.clientPrice} ₽</span>
                    <span class="price-label">Клиентская цена</span>
                </div>
            </div>
            <div class="product-detail-description">
                <h4>Описание</h4>
                <p>${product.description}</p>
            </div>
            <div class="product-detail-reviews">
                <h4>Отзывы (${product.reviews.length})</h4>
                ${product.reviews.length > 0 ? product.reviews.map(review => `
                    <div class="review">
                        <p><strong>${review.user}</strong> (★ ${review.rating})</p>
                        <p>${review.comment}</p>
                    </div>
                `).join('') : '<p>Пока нет отзывов.</p>'}
            </div>
            <div class="product-detail-review-form">
                <h4>Оставить отзыв</h4>
                <div class="rating-stars" id="rating-stars-${product.id}">
                    <span class="star" data-value="1">★</span>
                    <span class="star" data-value="2">★</span>
                    <span class="star" data-value="3">★</span>
                    <span class="star" data-value="4">★</span>
                    <span class="star" data-value="5">★</span>
                </div>
                <textarea id="review-comment-${product.id}" placeholder="Ваш отзыв..."></textarea>
                <button class="submit-btn" data-id="${product.id}">Отправить</button>
            </div>
        </div>
    `;

    // Обработчик для кнопки "Назад"
    backBtn.addEventListener('click', () => {
        productDetail.style.display = 'none';
        showcase.style.display = 'block';
        headerTitle.style.display = 'block';
        searchBar.style.display = 'flex';
        backBtn.style.display = 'none';
    });

    // Обработчик для звёзд рейтинга
    const stars = document.querySelectorAll(`#rating-stars-${product.id} .star`);
    let selectedRating = 0;
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => s.classList.remove('filled'));
            for (let i = 0; i < selectedRating; i++) {
                stars[i].classList.add('filled');
            }
        });
    });

    // Обработчик для отправки отзыва
    document.querySelector(`.submit-btn[data-id="${product.id}"]`).addEventListener('click', () => {
        const comment = document.getElementById(`review-comment-${product.id}`).value;
        if (selectedRating > 0 && comment.trim() !== '') {
            product.reviews.push({
                user: 'Пользователь', // Здесь можно добавить авторизацию для имени
                rating: selectedRating,
                comment: comment
            });
            showProductDetail(product); // Обновляем карточку товара
        } else {
            alert('Пожалуйста, выберите рейтинг и напишите отзыв.');
        }
    });
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    if (!isMobileDevice()) {
        document.getElementById('app-content').style.display = 'none';
        document.getElementById('mobile-only-message').style.display = 'block';
        return;
    }

    renderProducts(products);

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProducts = products.filter(product =>
            product.name.toLowerCase().includes(searchTerm)
        );
        renderProducts(filteredProducts);
    });
});