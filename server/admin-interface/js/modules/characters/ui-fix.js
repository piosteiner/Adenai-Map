// Temporary script to add data attribute to character cards
document.addEventListener('DOMContentLoaded', function() {
    // Function to add relationship data attributes to character cards
    function addRelationshipAttributes() {
        const characterCards = document.querySelectorAll('.character-card');
        characterCards.forEach(card => {
            // Get character data from the admin characters module
            const characterId = card.dataset.id;
            if (characterId && window.adminCharacters) {
                const characters = window.adminCharacters.getCharacters();
                const character = characters.find(c => c.id === characterId);
                if (character && character.relationship) {
                    card.setAttribute('data-character-relationship', character.relationship);
                }
            }
        });
    }

    // Add attributes when characters are loaded
    if (window.adminCharacters) {
        // Wait for characters to be rendered
        setTimeout(addRelationshipAttributes, 1000);
        
        // Also add after any filter/search operations
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.target.id === 'characters-list') {
                    setTimeout(addRelationshipAttributes, 100);
                }
            });
        });
        
        const charactersList = document.getElementById('characters-list');
        if (charactersList) {
            observer.observe(charactersList, { childList: true, subtree: true });
        }
    }
});
