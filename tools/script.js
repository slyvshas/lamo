// script.js
document.addEventListener('DOMContentLoaded', () => {
    const searchBar = document.getElementById('search-bar');
    const cards = document.querySelectorAll('.card');

    searchBar.addEventListener('input', (e) => {
        const searchText = e.target.value.toLowerCase();

        cards.forEach(card => {
            const toolName = card.querySelector('h3').textContent.toLowerCase();
            if (toolName.includes(searchText)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
});
