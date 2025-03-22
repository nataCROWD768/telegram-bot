Telegram.WebApp.ready();

function loadProducts() {
    fetch('/api/products')
        .then(response => response.json())
        .then(data => {
            const productList = document.getElementById('product-list');
            productList.innerHTML = '';
            const products = data.products;

            products.forEach(product => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <img src="${product.image}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <div class="prices">
                        <span class="club-price">${product.clubPrice} ₽</span>
                        <span class="client-price">${product.clientPrice} ₽</span>
                    </div>
                    <div class="rating">★ ${product.averageRating.toFixed(1)}</div>
                    <button class="order-btn" data-id="${product._id}">В корзину</button>
                `;
                card.addEventListener('click', () => showProductModal(product));
                productList.appendChild(card);
            });

            // Обработчики кнопок "В корзину"
            document.querySelectorAll('.order-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Предотвращаем открытие модального окна
                    const productId = btn.getAttribute('data-id');
                    const quantity = prompt('Введите количество:', '1');
                    if (quantity && !isNaN(quantity)) {
                        Telegram.WebApp.sendData(JSON.stringify({
                            type: 'order',
                            productId,
                            quantity: parseInt(quantity)
                        }));
                        Telegram.WebApp.close();
                    }
                });
            });
        })
        .catch(error => {
            console.error('Ошибка загрузки товаров:', error);
            Telegram.WebApp.showAlert('Ошибка загрузки товаров');
        });
}

function showProductModal(product) {
    const modal = document.getElementById('product-modal');
    const modalBody = document.getElementById('modal-body');
    const reviewsHtml = product.reviews.length > 0
        ? product.reviews.map(r => `
            <div class="review">
                <span class="username">${r.username}</span>: 
                <span class="rating">★ ${r.rating}</span>
                <p>${r.comment}</p>
            </div>
        `).join('')
        : '<p>Отзывов пока нет</p>';

    modalBody.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <h2>${product.name}</h2>
        <div class="description">${product.description}</div>
        <div class="prices">
            <span class="club-price">Клубная: ${product.clubPrice} ₽</span>
            <span class="client-price">Клиентская: ${product.clientPrice} ₽</span>
        </div>
        <div class="rating">Рейтинг: ★ ${product.averageRating.toFixed(1)}</div>
        <div class="reviews">
            <h3>Отзывы</h3>
            ${reviewsHtml}
        </div>
        <div class="review-form">
            <h3>Оставить отзыв</h3>
            <label>Рейтинг:</label>
            <select id="review-rating">
                <option value="5">★ 5</option>
                <option value="4">★ 4</option>
                <option value="3">★ 3</option>
                <option value="2">★ 2</option>
                <option value="1">★ 1</option>
            </select>
            <label>Комментарий:</label>
            <textarea id="review-comment" rows="4" placeholder="Ваш отзыв..."></textarea>
            <button id="submit-review" data-id="${product._id}">Отправить отзыв</button>
        </div>
    `;

    modal.style.display = 'block';

    document.getElementById('close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('submit-review').addEventListener('click', () => {
        const productId = product._id;
        const rating = parseInt(document.getElementById('review-rating').value);
        const comment = document.getElementById('review-comment').value.trim();

        if (rating && comment) {
            Telegram.WebApp.sendData(JSON.stringify({
                type: 'review',
                productId,
                rating,
                comment
            }));
            Telegram.WebApp.close();
        } else {
            Telegram.WebApp.showAlert('Пожалуйста, выберите рейтинг и введите комментарий');
        }
    });
}

// Показ кнопки "Наверх" при прокрутке
window.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-top-btn');
    btn.style.display = window.scrollY > 300 ? 'block' : 'none';
});

document.getElementById('scroll-top-btn').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Загружаем товары при открытии
loadProducts();