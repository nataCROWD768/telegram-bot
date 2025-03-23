// Массив продуктов
const products = [
    { id: 1, name: "НАСЫЩАЯ МОЛОЧНОСТЬ", clubPrice: 1000, clientPrice: 1200, rating: 4.5, image: "images/product1.jpg" },
    { id: 2, name: "CONTROL RGP - молекулярный гель на основе Фукуса и Арганового масла", clubPrice: 1500, clientPrice: 1800, rating: 4.0, image: "images/product2.jpg" },
    { id: 3, name: "ВИОЛЮР", clubPrice: 2000, clientPrice: 2400, rating: 4.8, image: "images/product3.jpg" },
    { id: 4, name: "БИОЛАСТ", clubPrice: 800, clientPrice: 1000, rating: 3.5, image: "images/product4.jpg" },
    { id: 5, name: "CONTROL RGP", clubPrice: 1200, clientPrice: 1400, rating: 4.2, image: "images/product5.jpg" },
    { id: 6, name: "DETOX RGP", clubPrice: 1100, clientPrice: 1300, rating: 4.3, image: "images/product6.jpg" },
    { id: 7, name: "SLIM RGP", clubPrice: 900, clientPrice: 1100, rating: 4.1, image: "images/product7.jpg" },
    { id: 8, name: "ХВОЙНЫЙ", clubPrice: 1600, clientPrice: 1900, rating: 4.7, image: "images/product8.jpg" },
    { id: 9, name: "ВОДАНИЙ", clubPrice: 1300, clientPrice: 1500, rating: 4.4, image: "images/product9.jpg" }
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
            </div>
            <div class="card-content">
                <h3>${product.name}</h3>
                <div class="prices">
                    <span class="club-price">${product.clubPrice} Р</span>
                    <span class="client-price">${product.clientPrice} Р</span>
                </div>
                <div class="rating">★ ${product.rating}</div>
            </div>
        `;
        productList.appendChild(card);
    });
}

// Инициализация списка товаров при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    renderProducts(products);
});

// Поиск товаров
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm)
    );
    renderProducts(filteredProducts);
});