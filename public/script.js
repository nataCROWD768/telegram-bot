Telegram.WebApp.ready();

let allProducts = [];
const API_URL = 'https://telegram-bot-gmut.onrender.com/api/products';

function loadProducts(products) {
    console.log('Загрузка продуктов:', products);
    const productList = document.getElementById('product-list');
    if (!productList) {
        console.error('Элемент #product-list не найден в HTML');
        Telegram.WebApp.showAlert('Ошибка: контейнер для товаров не найден');
        return;
    }
    productList.innerHTML = '';

    if (!products || products.length === 0) {
        console.log('Товары отсутствуют');
        productList.innerHTML = '<p style="text-align: center; color: #888;">Товары не найдены</p>';
        return;
    }

    products.forEach(product => {
        console.log('Создание карточки для:', product.name);
        const card = document.createElement('div');
        card.className = 'product-card card';
        card.innerHTML = `
            <div class="card-image">
                <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/80';">
            </div>
            <div class="card-content">
                <h3>${product.name}</h3>
                <div class="prices">
                    <span class="club-price">${product.clubPrice} ₽</span>
                    <span class="client-price">${product.clientPrice} ₽</span>
                </div>
                <div class="rating">★ ${product.averageRating.toFixed(1)}</div>
            </div>
        `;
        card.addEventListener('click', () => showProductDetail(product));
        productList.appendChild(card);
    });
}

function showProductDetail(product) {
    const showcase = document.getElementById('showcase');
    const detail = document.getElementById('product-detail');
    const detailContent = document.getElementById('product-detail-content');

    showcase.style.display = 'none';
    detail.style.display = 'block';

    const reviewsHtml = product.reviews && product.reviews.length > 0
        ? product.reviews.map(r => `
            <div class="review">
                <span class="username">${r.username}</span>: 
                <span class="rating">★ ${r.rating}</span>
                <p>${r.comment}</p>
            </div>
        `).join('')
        : '<p>Отзывов пока нет</p>';

    detailContent.innerHTML = `
        <div class="card-image">
            <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/80';">
        </div>
        <div class="card-content">
            <h2>${product.name}</h2>
            <div class="prices">
                <span class="club-price">Клубная: ${product.clubPrice} ₽</span>
                <span class="client-price">Клиентская: ${product.clientPrice} ₽</span>
            </div>
            <div class="rating">Рейтинг: ★ ${product.averageRating.toFixed(1)}</div>
            <div class="description">
                <h5>Описание</h5>
                <p>${product.description}</p>
            </div>
            <div class="reviews">
                <h5>Отзывы</h5>
                ${reviewsHtml}
            </div>
            <div class="review-form">
                <h5>Оставить отзыв</h5>
                <div class="rating-stars" data-rating="0">
                    <span class="star" data-value="1">★</span>
                    <span class="star" data-value="2">★</span>
                    <span class="star" data-value="3">★</span>
                    <span class="star" data-value="4">★</span>
                    <span class="star" data-value="5">★</span>
                </div>
                <textarea id="review-comment" class="materialize-textarea" placeholder="Ваш отзыв..."></textarea>
                <a class="submit-btn btn waves-effect waves-light" data-id="${product._id}">Отправить отзыв</a>
                <div id="review-status" style="color: #27ae60; margin-top: 10px;"></div>
            </div>
        </div>
    `;

    const stars = detailContent.querySelectorAll('.rating-stars .star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => s.classList.toggle('filled', parseInt(s.getAttribute('data-value')) <= rating));
            detailContent.querySelector('.rating-stars').setAttribute('data-rating', rating);
            console.log('Рейтинг выбран:', rating);
        });
    });

    const submitBtn = detailContent.querySelector('.submit-btn');
    submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const productId = product._id;
        const rating = parseInt(detailContent.querySelector('.rating-stars').getAttribute('data-rating'));
        const comment = document.getElementById('review-comment').value.trim();
        const status = document.getElementById('review-status');

        console.log('Проверка данных отзыва:', { productId, rating, comment });

        if (rating > 0 && comment) {
            const reviewData = { type: 'review', productId, rating, comment };
            console.log('Отправка отзыва:', reviewData);
            Telegram.WebApp.sendData(JSON.stringify(reviewData));
            status.textContent = 'Отзыв отправлен! Ожидает модерации.';
            document.getElementById('review-comment').value = '';
            stars.forEach(s => s.classList.remove('filled'));
            detailContent.querySelector('.rating-stars').setAttribute('data-rating', '0');
        } else {
            Telegram.WebApp.showAlert('Выберите рейтинг и введите комментарий');
        }
    });
}

console.log('Отправка запроса к:', API_URL);
fetch(API_URL, {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
    }
})
    .then(response => {
        console.log('Статус ответа:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP ошибка: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Полные данные от API:', data);
        allProducts = data.products || [];
        console.log('Товары для отображения:', allProducts);
        loadProducts(allProducts);

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase();
                const filteredProducts = allProducts.filter(product =>
                    product.name.toLowerCase().includes(query) ||
                    product.description.toLowerCase().includes(query)
                );
                loadProducts(filteredProducts);
            });
        } else {
            console.error('Элемент #search-input не найден');
        }

        const scrollTopBtn = document.getElementById('scroll-top-btn');
        if (allProducts.length > 8) {
            window.addEventListener('scroll', () => {
                scrollTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
            });
            scrollTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } else {
            scrollTopBtn.style.display = 'none';
        }
    })
    .catch(error => {
        console.error('Ошибка загрузки товаров:', error);
        const productList = document.getElementById('product-list');
        if (productList) {
            productList.innerHTML = '<p style="text-align: center; color: #888;">Ошибка загрузки товаров: ' + error.message + '</p>';
        }
        Telegram.WebApp.showAlert('Ошибка загрузки товаров: ' + error.message);
    });