
// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Update copyright year
    updateCopyrightYear();

    const sessionStateStr = localStorage.getItem('session');
    if (sessionStateStr) {
        const sessionState = JSON.parse(sessionStateStr);
        const prevPuzzleId = sessionState.prevPuzzleId;

        const urlSearch = new URL(window.location).searchParams;
        const urlPuzzleId = urlSearch.get('puzzleid');
        if (!urlPuzzleId && prevPuzzleId) {
            // we aren't searching a specific puzzle, and we previously were on a set puzzle
            urlSearch.set('puzzleid', prevPuzzleId);
            window.location.search = `?puzzleid=${prevPuzzleId}`
        }
    }

    const game = new CrosswordGame();
    await game.initialize();
    window['game'] = game;
    /*
        const parser = new PuzzleParser();
        const fileInput = document.getElementById('puzzleFile');

        function displayPuzzle(puzzleData) {
            // Display puzzle information
            document.getElementById('puzzleTitle').textContent = puzzleData.title;
            document.getElementById('puzzleAuthor').textContent = `By ${puzzleData.author}`;
            document.getElementById('puzzleCopyright').textContent = puzzleData.copyright;

            // Create grid
            const gridDiv = document.getElementById('puzzleGrid');
            const table = document.createElement('table');
            table.className = 'puzzle-grid';

            for (let row = 0; row < puzzleData.height; row++) {
                const tr = document.createElement('tr');
                for (let col = 0; col < puzzleData.width; col++) {
                    const td = document.createElement('td');
                    td.className = 'puzzle-cell';
                    
                    if (puzzleData.solution[row][col] === '.') {
                        td.classList.add('black-cell');
                    } else {
                        if (puzzleData.gridNumbers[row][col] > 0) {
                            const numberSpan = document.createElement('span');
                            numberSpan.className = 'cell-number';
                            numberSpan.textContent = puzzleData.gridNumbers[row][col];
                            td.appendChild(numberSpan);
                        }
                    }
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }
            gridDiv.innerHTML = '';
            gridDiv.appendChild(table);

            // Display clues
            const acrossClues = document.getElementById('acrossClues');
            const downClues = document.getElementById('downClues');

            acrossClues.innerHTML = puzzleData.clues.across
                .map((clue, index) => `<li>${clue}</li>`)
                .join('');

            downClues.innerHTML = puzzleData.clues.down
                .map((clue, index) => `<li>${clue}</li>`)
                .join('');
        }

        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            try {
                const puzzleData = await parser.parsePuzzleFile(file);
                displayPuzzle(puzzleData);
            } catch (error) {
                console.error('Error parsing puzzle:', error);
                alert('Error parsing puzzle file');
            }
        });
    */
    
    // Set up theme toggle
    //setupThemeToggle();
});

// Function to update the copyright year
function updateCopyrightYear() {
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

// Function to setup theme toggle
//function setupThemeToggle() {
//    const themeToggle = document.getElementById('themeToggle');
//    
//    // Check for saved theme preference
//    const savedTheme = localStorage.getItem('theme');
//    if (savedTheme) {
//        document.documentElement.setAttribute('data-theme', savedTheme);
//        updateButtonText(themeToggle, savedTheme);
//    }
//
//    // Add click event listener
//    themeToggle.addEventListener('click', () => {
//        const currentTheme = document.documentElement.getAttribute('data-theme');
//        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
//        
//        document.documentElement.setAttribute('data-theme', newTheme);
//        localStorage.setItem('theme', newTheme);
//        updateButtonText(themeToggle, newTheme);
//    });
//}

// Function to update button text based on theme
function updateButtonText(button, theme) {
    button.textContent = theme === 'dark' ? 'Toggle Light Mode' : 'Toggle Dark Mode';
}
