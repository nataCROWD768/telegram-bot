body {
    font-family: 'Roboto', sans-serif;
    background-color: #f8f9fa;
    margin: 0;
    padding: 0;
}

.container {
    width: 390px;
    margin: 0 auto;
    padding: 0;
}

.header {
    position: fixed;
    top: 0;
    width: 390px;
    background: linear-gradient(45deg, #1e3a8a, #3b82f6);
    color: white;
    padding: 8px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    z-index: 1000;
}

.header-title {
    font-size: 16px;
    margin: 0;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.search-bar {
    width: 100px;
}

#search-input {
    width: 100%;
    padding: 4px 8px;
    font-size: 12px;
    border: none;
    border-radius: 20px;
    background-color: rgba(255, 255, 255, 0.95);
    color: #333;
    box-sizing: border-box;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
}

#search-input:focus {
    outline: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

#search-input::placeholder {
    color: #888;
}

#showcase {
    margin-top: 60px;
}

.product-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 10px;
}

.product-card {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    height: 180px;
}

.product-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-image {
    width: 100%;
    height: 80px;
    overflow: hidden;
    background-color: #f0f0f0;
}

.card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    transition: transform 0.3s ease;
    display: block;
}

.product-card:hover .card-image img {
    transform: scale(1.05);
}

.card-content {
    width: 100%;
    height: 100px;
    padding: 2px 2px;
    flex-grow: 0;
    display: flex;
    flex-direction: column;
}

.card-content h3 {
    font-family: 'Open Sans', sans-serif;
    font-size: 8px;
    font-weight: 600;
    margin: 2px 0 1px;
    color: #2c3e50;
    line-height: 1.2;
    max-height: 19.2px; /* Высота для 2 строк (8px * 1.2 * 2) */
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.prices {
    display: flex;
    flex-direction: column;
    margin-bottom: 1px;
    font-family: 'Open Sans', sans-serif;
    line-height: 1.1; /* Уменьшаем высоту строки для компактности */
}

.club-price {
    color: #16a34a;
    font-weight: 600;
    font-size: 8px; /* Уменьшаем шрифт для клубной цены */
}

.client-price {
    color: #ef4444;
    text-decoration: line-through;
    font-size: 7px; /* Уменьшаем шрифт для клиентской цены */
    opacity: 0.8;
}

.rating {
    color: #f59e0b;
    font-size: 8px;
    margin-top: auto;
    font-family: 'Open Sans', sans-serif;
}

#product-detail {
    padding: 15px;
}

.description, .reviews, .review-form {
    margin-top: 15px;
}

.review {
    border-bottom: 1px solid #eee;
    padding: 8px 0;
}

.rating-stars .star {
    font-size: 20px;
    cursor: pointer;
    color: #d1d5db;
}

.rating-stars .star.filled {
    color: #f59e0b;
}

#review-comment {
    width: 100%;
    min-height: 80px;
    margin-top: 8px;
    font-size: 13px;
    border-radius: 4px;
    border: 1px solid #d1d5db;
    padding: 8px;
}

.submit-btn {
    margin-top: 8px;
    background-color: #1e3a8a;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    text-decoration: none;
    display: inline-block;
    font-size: 13px;
    transition: background-color 0.3s ease;
}

.submit-btn:hover {
    background-color: #3b82f6;
}

.scroll-top-btn {
    position: fixed;
    bottom: 15px;
    right: 15px;
    background-color: #1e3a8a;
    color: white;
    padding: 8px 12px;
    border-radius: 50%;
    text-decoration: none;
    display: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    transition: background-color 0.3s ease;
}

.scroll-top-btn:hover {
    background-color: #3b82f6;
}