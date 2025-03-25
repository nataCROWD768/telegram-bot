const BASE_URL = 'https://telegram-bot-gmut.onrender.com';
let products = [];

function formatDate(date) { // Можно вынести в utils.js на клиенте
    if (!date || isNaN(new Date(date).getTime())) return 'Дата неизвестна';
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const d = new Date(date);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

async function loadProducts() {
    try {
        const response = await fetch(`${BASE_URL}/api/products`);
        if (!response.ok) throw new Error('Не удалось загрузить продукты');
        const data = await response.json();
        products = data.products;
        renderProducts(products);
    } catch (error) {
        alert('Не удалось загрузить продукты. Попробуйте позже.');
    }
}

function renderProducts(productArray) {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';
    productArray.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const hasReviews = product.reviews && product.reviews.some(review => review.isApproved) && product.averageRating > 0;
        const ratingHtml = hasReviews ? `<div class="rating">★ ${product.averageRating.toFixed(1)}</div>` : '';
        card.innerHTML = `
            <div class="card-image">
                <img src="${BASE_URL}/api/image/${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/150';">
                ${ratingHtml}
            </div>
            <div class="card-content">
                <h3>${product.name}</h3>
                <div class="prices">
                    <div class="price-container">
                        <i class="fas fa-crown price-icon"></i>
                        <span class="club-price">${product.clubPrice || 0} ₽</span>
                    </div>
                    <div class="price-container">
                        <i class="fas fa-user price-icon"></i>
                        <span class="client-price">${product.clientPrice || 0} ₽</span>
                    </div>
                </div>
                <div class="card-button">
                    <a href="#" class="product-detail-link" data-id="${product._id}">Карточка продукта</a>
                </div>
            </div>
        `;
        productList.appendChild(card);
    });

    document.querySelectorAll('.product-detail-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const productId = e.target.getAttribute('data-id');
            const product = products.find(p => p._id === productId);
            showProductDetail(product);
        });
    });
}

function showProductDetail(product, page = 1) {
    const showcase = document.getElementById('showcase');
    const productDetail = document.getElementById('product-detail');
    const reviewsSection = document.getElementById('reviews-section');
    const productDetailContent = document.querySelector('.product-detail-content');
    const headerTitle = document.querySelector('.header-title');
    const searchBar = document.querySelector('.search-bar');
    const backBtn = document.getElementById('back-to-showcase');

    showcase.style.display = 'none';
    reviewsSection.style.display = 'none';
    productDetail.style.display = 'block';
    headerTitle.style.display = 'none';
    searchBar.style.display = 'none';
    backBtn.style.display = 'flex';

    const hasReviews = product.reviews && product.reviews.some(review => review.isApproved) && product.averageRating > 0;
    const ratingHtml = hasReviews ? `<div class="product-detail-rating">★ ${product.averageRating.toFixed(1)}</div>` : '';
    const sortedReviews = product.reviews && product.reviews.length > 0 ? product.reviews.filter(r => r.isApproved).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
    const reviewsPerPage = 10;
    const totalReviews = sortedReviews.length;
    const totalPages = Math.ceil(totalReviews / reviewsPerPage);
    const start = (page - 1) * reviewsPerPage;
    const end = Math.min(start + reviewsPerPage, totalReviews);
    const paginatedReviews = sortedReviews.slice(start, end);

    productDetailContent.innerHTML = `
        <div class="product-detail-image">
            <img src="${BASE_URL}/api/image/${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/150';">
            ${ratingHtml}
        </div>
        <div class="product-detail-info">
            <h3>${product.name}</h3>
            <div class="product-detail-prices">
                <div class="price-container">
                    <i class="fas fa-crown price-icon"></i>
                    <span class="club-price">${product.clubPrice || 0} ₽</span>
                    <span class="price-label">Клубная цена</span>
                </div>
                <div class="price-container">
                    <i class="fas fa-user price-icon"></i>
                    <span class="client-price">${product.clientPrice || 0} ₽</span>
                    <span class="price-label">Клиентская цена</span>
                </div>
                <button class="share-btn" data-product-id="${product._id}">
                    <span class="share-icon">📤</span> Поделиться
                </button>
            </div>
            <div class="product-detail-description">
                <h4>Описание</h4>
                <p>${product.description || 'Описание отсутствует'}</p>
            </div>
            <div class="product-detail-reviews review-container">
                <h4>Отзывы (${totalReviews})</h4>
                ${paginatedReviews.length > 0 ? paginatedReviews.map(review => `
                    <div class="review">
                        <p class="review-date">Дата: ${formatDate(review.createdAt)}</p>
                        <p><strong>${review.username.startsWith('@') ? review.username : '@' + review.username}</strong> (★ ${review.rating})</p>
                        <p>${review.comment}</p>
                    </div>
                `).join('') : '<p>Пока нет отзывов.</p>'}
                ${totalReviews > reviewsPerPage ? `<div class="pagination" id="reviews-pagination">${renderPagination(totalPages, page, product)}</div>` : ''}
            </div>
            <div class="product-detail-review-form review-container">
                <h4>Оставить отзыв</h4>
                <div class="rating-stars" id="rating-stars-${product._id}">
                    <span class="star" data-value="1">★</span>
                    <span class="star" data-value="2">★</span>
                    <span class="star" data-value="3">★</span>
                    <span class="star" data-value="4">★</span>
                    <span class="star" data-value="5">★</span>
                </div>
                <textarea id="review-comment-${product._id}" placeholder="Ваш отзыв..."></textarea>
                <button class="submit-btn" data-id="${product._id}">Отправить</button>
            </div>
        </div>
    `;

    backBtn.onclick = () => {
        productDetail.style.display = 'none';
        showcase.style.display = 'block';
        headerTitle.style.display = 'block';
        headerTitle.textContent = 'Витрина';
        searchBar.style.display = 'flex';
        backBtn.style.display = 'none';
    };

    const stars = document.querySelectorAll(`#rating-stars-${product._id} .star`);
    let selectedRating = 0;
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => s.classList.remove('filled'));
            for (let i = 0; i < selectedRating; i++) stars[i].classList.add('filled');
        });
    });

    document.querySelector(`.submit-btn[data-id="${product._id}"]`).addEventListener('click', () => {
        const comment = document.getElementById(`review-comment-${product._id}`).value;
        if (selectedRating > 0 && comment.trim() !== '') {
            const tg = window.Telegram?.WebApp;
            const username = tg && tg.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username ? `@${tg.initDataUnsafe.user.username}` : 'Аноним') : 'Аноним';
            const review = { productId: product._id, user: username, rating: selectedRating, comment };
            sendReviewToAdmin(review);
            document.getElementById(`review-comment-${product._id}`).value = '';
            stars.forEach(s => s.classList.remove('filled'));
            selectedRating = 0;
        } else {
            alert('Пожалуйста, выберите рейтинг и напишите отзыв.');
        }
    });

    const shareButton = document.querySelector(`.share-btn[data-product-id="${product._id}"]`);
    if (shareButton) {
        shareButton.addEventListener('click', () => {
            shareButton.disabled = true;
            shareButton.innerHTML = '<span class="share-icon">⏳</span> Отправка...';
            const tg = window.Telegram?.WebApp;
            if (tg) {
                const shareData = { type: 'share', productId: product._id, name: product.name, clubPrice: product.clubPrice, clientPrice: product.clientPrice, description: product.description, image: product.image };
                try {
                    tg.sendData(JSON.stringify(shareData));
                    setTimeout(() => {
                        shareButton.disabled = false;
                        shareButton.innerHTML = '<span class="share-icon">📤</span> Поделиться';
                    }, 1000);
                } catch (error) {
                    alert('Ошибка при шаринге продукта');
                    shareButton.disabled = false;
                    shareButton.innerHTML = '<span class="share-icon">📤</span> Поделиться';
                }
            } else {
                alert('Эта функция работает только в Telegram');
                shareButton.disabled = false;
                shareButton.innerHTML = '<span class="share-icon">📤</span> Поделиться';
            }
        });
    }

    if (totalReviews > reviewsPerPage) {
        document.querySelectorAll('#reviews-pagination .pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newPage = parseInt(btn.getAttribute('data-page'));
                showProductDetail(product, newPage);
            });
        });
    }
}

function renderPagination(totalPages, currentPage, product) {
    let paginationHtml = '<div class="pagination-container">';
    paginationHtml += `<button class="pagination-btn${currentPage === 1 ? ' disabled' : ''}" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>←</button>`;
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) startPage = Math.max(1, endPage - maxVisiblePages + 1);

    if (startPage > 1) {
        paginationHtml += `<button class="pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) paginationHtml += `<span class="pagination-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) paginationHtml += `<button class="pagination-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i}</button>`;
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) paginationHtml += `<span class="pagination-ellipsis">...</span>`;
        paginationHtml += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    paginationHtml += `<button class="pagination-btn${currentPage === totalPages ? ' disabled' : ''}" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>→</button>`;
    paginationHtml += '</div>';
    return paginationHtml;
}

function sendReviewToAdmin(review) {
    fetch(`${BASE_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: review.productId, username: review.user, rating: review.rating, comment: review.comment, isApproved: false })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Отзыв отправлен на модерацию.');
                loadProducts();
            } else {
                alert('Ошибка при отправке отзыва');
            }
        })
        .catch(() => alert('Ошибка сервера'));
}

async function showReviews(page = 1) {
    const showcase = document.getElementById('showcase');
    const productDetail = document.getElementById('product-detail');
    const reviewsSection = document.getElementById('reviews-section');
    const reviewsList = document.getElementById('reviews-list');
    const pagination = document.getElementById('pagination');
    const headerTitle = document.querySelector('.header-title');
    const searchBar = document.querySelector('.search-bar');
    const backBtn = document.getElementById('back-to-showcase');

    showcase.style.display = 'none';
    productDetail.style.display = 'none';
    reviewsSection.style.display = 'block';
    headerTitle.style.display = 'block';
    headerTitle.textContent = 'Отзывы';
    searchBar.style.display = 'none';
    backBtn.style.display = 'flex';

    try {
        const response = await fetch(`${BASE_URL}/api/reviews`);
        if (!response.ok) throw new Error('Не удалось загрузить отзывы');
        const data = await response.json();
        const allReviews = data.reviews;

        const reviewsPerPage = 10;
        const totalReviews = allReviews.length;
        const totalPages = Math.ceil(totalReviews / reviewsPerPage);
        const start = (page - 1) * reviewsPerPage;
        const end = Math.min(start + reviewsPerPage, totalReviews);
        const paginatedReviews = allReviews.slice(start, end);

        reviewsList.innerHTML = paginatedReviews.length > 0 ? paginatedReviews.map(review => `
            <div class="review">
                <p><strong>${review.username.startsWith('@') ? review.username : '@' + review.username}</strong> о продукте <strong>${review.productName}</strong> (★ ${review.rating})</p>
                <p>${review.comment}</p>
            </div>
        `).join('') : '<p>Пока нет подтверждённых отзывов.</p>';

        pagination.innerHTML = '';
        if (totalReviews > reviewsPerPage) {
            const paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination-container';

            const prevBtn = document.createElement('button');
            prevBtn.textContent = '←';
            prevBtn.className = 'pagination-btn' + (page === 1 ? ' disabled' : '');
            prevBtn.disabled = page === 1;
            prevBtn.addEventListener('click', () => showReviews(page - 1));
            paginationContainer.appendChild(prevBtn);

            const maxVisiblePages = 5;
            let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            if (endPage - startPage + 1 < maxVisiblePages) startPage = Math.max(1, endPage - maxVisiblePages + 1);

            if (startPage > 1) {
                const firstPage = document.createElement('button');
                firstPage.textContent = '1';
                firstPage.className = 'pagination-btn';
                firstPage.addEventListener('click', () => showReviews(1));
                paginationContainer.appendChild(firstPage);
                if (startPage > 2) paginationContainer.appendChild(Object.assign(document.createElement('span'), { textContent: '...', className: 'pagination-ellipsis' }));
            }

            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.textContent = i;
                pageBtn.className = 'pagination-btn' + (i === page ? ' active' : '');
                pageBtn.addEventListener('click', () => showReviews(i));
                paginationContainer.appendChild(pageBtn);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) paginationContainer.appendChild(Object.assign(document.createElement('span'), { textContent: '...', className: 'pagination-ellipsis' }));
                const lastPage = document.createElement('button');
                lastPage.textContent = totalPages;
                lastPage.className = 'pagination-btn';
                lastPage.addEventListener('click', () => showReviews(totalPages));
                paginationContainer.appendChild(lastPage);
            }

            const nextBtn = document.createElement('button');
            nextBtn.textContent = '→';
            nextBtn.className = 'pagination-btn' + (page === totalPages ? ' disabled' : '');
            nextBtn.disabled = page === totalPages;
            nextBtn.addEventListener('click', () => showReviews(page + 1));
            paginationContainer.appendChild(nextBtn);

            pagination.appendChild(paginationContainer);
        }

        backBtn.onclick = () => {
            reviewsSection.style.display = 'none';
            showcase.style.display = 'block';
            headerTitle.textContent = 'Витрина';
            searchBar.style.display = 'flex';
            backBtn.style.display = 'none';
        };
    } catch (error) {
        reviewsList.innerHTML = '<p>Ошибка загрузки отзывов.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProducts = products.filter(product => product.name.toLowerCase().includes(searchTerm));
        renderProducts(filteredProducts);
    });

    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.MainButton.hide();
        tg.onEvent('message', (msg) => { if (msg.text === '/reviews') showReviews(); });
        tg.expand();
    }
});