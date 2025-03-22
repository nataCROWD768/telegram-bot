Telegram.WebApp.ready();

let allProducts = [];

function loadProducts(products) {
    console.log('Загрузка продуктов в витрине:', products);
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';

    if (!products || products.length === 0) {
        console.log('Товары отсутствуют');
        productList.innerHTML = '<p>Товары не найдены</p>';
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card card';
        card.innerHTML = `
            <div class="card-image">
                <img src="${product.image}" alt="${product.name}">
            </div>
            <div class="card-content">
                <h3>${product.name}</h3>
                <div class="prices">
                    <span class="club-price">${product.clubPrice} ₽</span>
                    <span class="client-price">${product.clientPrice} ₽</span>
                </div>
                <div class="rating">★ ${product.averageRating.toFixed(1)}</div>
                <a class="order-btn btn waves-effect waves-light" data-id="${product._id}">В корзину</a>
            </div>
        `;
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'A') showProductDetail(product);
        });
        productList.appendChild(card);
    });

    document.querySelectorAll('.order-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const productId = btn.getAttribute('data-id');
            const quantity = prompt('Введите количество:', '1');
            if (quantity && !isNaN(quantity)) {
                console.log('Отправка заказа:', { productId, quantity });
                Telegram.WebApp.sendData(JSON.stringify({
                    type: 'order',
                    productId,
                    quantity: parseInt(quantity)
                }));
                Telegram.WebApp.showAlert('Заказ отправлен!');
            }
        });
    });
}

function showProductDetail(product) {
    const showcase = document.getElementById('showcase');
    const detail = document.getElementById('product-detail');
    const detailContent = document.getElementById('product-detail-content');

    showcase.style.display = 'none';
    detail.style.display = 'block';

    const reviewsHtml = product.reviews.length > 0
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
            <img src="${product.image}" alt="${product.name}">
        </div>
        <div class="card-content">
            <h2>${product.name}</h2>
            <div class="prices">
                <span class="club-price">Клубная: ${product.clubPrice} ₽</span>
                <span class="client-price">Клиентская: ${product.clientPrice} ₽</span>
            </div>
            <div class="rating">Рейтинг: ★ ${product.averageRating.toFixed(1)}</div>
            <a class="order-btn btn waves-effect waves-light" data-id="${product._id}">В корзину</a>
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

    document.getElementById('back-btn').addEventListener('click', () => {
        detail.style.display = 'none';
        showcase.style.display = 'block';
    });

    detailContent.querySelector('.order-btn').addEventListener('click', () => {
        const productId = product._id;
        const quantity = prompt('Введите количество:', '1');
        if (quantity && !isNaN(quantity)) {
            console.log('Отправка заказа из карточки:', { productId, quantity });
            Telegram.WebApp.sendData(JSON.stringify({
                type: 'order',
                productId,
                quantity: parseInt(quantity)
            }));
            Telegram.WebApp.showAlert('Заказ отправлен!');
        }
    });

    const stars = detailContent.querySelectorAll('.rating-stars .star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => {
                s.classList.toggle('filled', parseInt(s.getAttribute('data-value')) <= rating);
            });
            detailContent.querySelector('.rating-stars').setAttribute('data-rating', rating);
            console.log('Рейтинг выбран:', rating);
        });
    });

    const submitBtn = detailContent.querySelector('.submit-btn');
    submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Кнопка "Отправить отзыв" нажата');
        const productId = product._id;
        const rating = parseInt(detailContent.querySelector('.rating-stars').getAttribute('data-rating'));
        const comment = document.getElementById('review-comment').value.trim();
        const status = document.getElementById('review-status');

        console.log('Проверка данных перед отправкой:', { productId, rating, comment });

        if (!productId) {
            console.error('Ошибка: productId отсутствует');
            Telegram.WebApp.showAlert('Ошибка: ID товара не найден');
            return;
        }

        if (rating > 0 && comment) {
            const reviewData = {
                type: 'review',
                productId,
                rating,
                comment
            };
            console.log('Отправка отзыва:', reviewData);
            try {
                Telegram.WebApp.sendData(JSON.stringify(reviewData));
                status.textContent = 'Отзыв отправлен! Ожидает модерации.';
                document.getElementById('review-comment').value = '';
                stars.forEach(s => s.classList.remove('filled'));
                detailContent.querySelector('.rating-stars').setAttribute('data-rating', '0');
            } catch (error) {
                console.error('Ошибка при отправке отзыва:', error);
                Telegram.WebApp.showAlert('Ошибка при отправке отзыва');
            }
        } else {
            console.log('Ошибка валидации:', { rating, comment });
            Telegram.WebApp.showAlert('Пожалуйста, выберите рейтинг и введите комментарий');
        }
    });
}

fetch('/api/products')
    .then(response => {
        console.log('Ответ от /api/products:', response.status);
        if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log('Получены данные от API:', data);
        allProducts = data.products || [];
        console.log('Массив товаров для отображения:', allProducts);
        loadProducts(allProducts);

        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filteredProducts = allProducts.filter(product =>
                product.name.toLowerCase().includes(query) ||
                product.description.toLowerCase().includes(query)
            );
            loadProducts(filteredProducts);
        });
    })
    .catch(error => {
        console.error('Ошибка загрузки товаров:', error);
        Telegram.WebApp.showAlert('Ошибка загрузки товаров');
        document.getElementById('product-list').innerHTML = '<p>Ошибка загрузки товаров</p>';
    });

window.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-top-btn');
    btn.style.display = window.scrollY > 300 ? 'block' : 'none';
});

document.getElementById('scroll-top-btn').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth', duration: 300 });
});