class CrosswordGame {
    constructor() {
        this.allPuzzles = null;
        this.puzzleId = null; // int value of puzzleId
        this.puzzleData = null;
        this.currentCell = null;
        this.direction = 'across';
        this.selectedNumber = null;
        this.userState = null;
        this.autoCheck = true; // Add this flag
        this.lastClickTime = 0;
        this.keyIsDown = false;
        this.queuedSaveGameState = null;
        this.isComplete = false;
        


        this.wordCells = new Map(); // Store word cells for quick lookup

        this.clueElements = {
            display: document.getElementById('current-clue-display'),
            explanation: document.getElementById('current-clue-explanation'),
            leftClue: document.getElementById('clue-left'),
            rightClue: document.getElementById('clue-right'),
            text: document.getElementById('clue-text'),
            pos: document.getElementById('clue-pos')
        };

        this.clueType = 0; // 0: NYT, 1: GPT, 2: GPT-Easy

        this.loadPuzzleNYT();
    }

    loadPuzzlesList() {

        let uri = 'getUserPuzzles.php';
        fetch(uri, {
            method: 'GET'
        }).then(response => response.text())
          .then((res) => {
              this.allPuzzles = JSON.parse(res);
              this.displayPuzzlesList();
          });
    }

    loadedPuzzleNYT() {

        try {
            this.userState = Array(this.puzzleData.height).fill()
                .map(() => Array(this.puzzleData.width).fill(''));
            this.displayPuzzle();
            this.loadPuzzlesList();
        } catch (error) {
            console.error('Error parsing puzzle:', error);
            alert('Error parsing puzzle file');
        }
    }


    loadPuzzleNYT() {
        // puzzleID in url?
        const urlSearch = new URL(window.location).searchParams;
        let urlPuzzleId = urlSearch.get('puzzleid');
        if (!urlPuzzleId) {
            // puzzleID in localStorage.session?
            let sessionStateStr = localStorage.getItem('session');
            let sessionState = null;
            if (sessionStateStr) {
                sessionState = JSON.parse(sessionStateStr);
                urlPuzzleId = sessionState.prevPuzzleId;
            }
        }

        this.puzzleData = null;
        if (urlPuzzleId) {
            let localPuzData = localStorage.getItem(`puzzle-${urlPuzzleId}`);
            if (localPuzData) {
                const json = JSON.parse(localPuzData);
                if (json.saveData) {
                    window['userSavedState'] = JSON.parse(json.saveData);
                }
                const localPuzDataDecomp = LZString.decompressFromBase64(json.data);
                this.puzzleData = JSON.parse(localPuzDataDecomp);

                if (this.puzzleData) {
                    this.loadedPuzzleNYT();
                    return;
                }
            }
        }

        // FIXME: compare puzdate against puzzles list date for puzzle; in case its been updated on server, we can fetch again
        if (!this.puzzleData) {
            let uri = 'getUserPuzzle.php';
            if (urlPuzzleId) {
                uri += `?puzzleId=${urlPuzzleId}`;
            }

            fetch(uri, {
                method: 'GET'
            }).then((response) => {
                if (response.status != 200) {
                    return false;
                }

                return response.text()
            })
            .then((res) => {
                const json = JSON.parse(res);
                if (!json) {
                    // bad puzzle
                    return;
                }

                if (json.saveData) {
                    window['userSavedState'] = JSON.parse(json.saveData);
                }
                let resDecomp = LZString.decompressFromBase64(json.data);
                this.puzzleData = JSON.parse(resDecomp);
                let puzzleId = this.puzzleData.id;
                localStorage.setItem(`puzzle-${puzzleId}`, res);
                this.loadedPuzzleNYT();
            });
        }
    }

    updateDirectionHighlight() {
        // Remove all previous highlighting
        const cells = document.querySelectorAll('.puzzle-cell');
        cells.forEach(cell => {
            cell.classList.remove('current-word-across', 'current-word-down');
        });

        if (this.currentCell) {
            const row = parseInt(this.currentCell.dataset.row);
            const col = parseInt(this.currentCell.dataset.col);
            this.highlightCurrentWord(row, col);
        }
    }

    validateCell(input, row, col) {
        const correct = this.puzzleData.solution[row][col];
        const userInput = this.userState[row][col];

        // Clear existing validation classes
        input.classList.remove('correct-cell', 'incorrect-cell');

        // Only validate if there's user input
        if (userInput) {
            if (userInput === correct) {
                input.classList.add('correct-cell');
            } else {
                input.classList.add('incorrect-cell');
            }
        }
    }

    saveGameState() {
        let cells = "";
        let hasInput = false;
        let isComplete = true;
        for (let row = 0; row < this.puzzleData.height; row++) {
            for (let col = 0; col < this.puzzleData.width; col++) {
                const expectedLetter = this.puzzleData.solution[row][col];

                if (expectedLetter === '.') {
                    // black cell
                    cells += '.';
                    continue;
                }

                const input = this.getCellInput(row, col);
                const inputLetter = input.dataset.value;
                const curValue = input.dataset.value.toUpperCase();
                const revealedCell = input.dataset.revealed === "true";
                if (revealedCell) {
                    // revealed cell
                    hasInput = true;
                    cells += '-';
                } else if (curValue === expectedLetter) {
                    // solved cell
                    hasInput = true;
                    cells += '.';
                } else if (curValue === '') {
                    // no input in cell
                    isComplete = false;
                    cells += ' ';
                } else {
                    // wrong answer
                    hasInput = true;
                    isComplete = false;
                    cells += curValue;
                }
            }
        }

        this.isComplete = isComplete;
        let state = 0; // 0 blank, 1 partial, 2 solved
        if (isComplete) {
            state = 2;
        } else if (hasInput) {
            state = 1;
        }

        const gameState = {
            state,
            timestamp: new Date().toISOString()
        };


        if (hasInput) {
            gameState.cells = cells;
        }

        let gameStateStr = JSON.stringify(gameState);
        localStorage.setItem(`puzzle_${this.puzzleId}_save`, gameStateStr);

        let sessionStateStr = localStorage.getItem('session');
        let sessionState = null;
        if (sessionStateStr) {
            sessionState = JSON.parse(sessionStateStr);
        } else {
            sessionState = {
                prevPuzzleId: 0,
            };
        }

        sessionState.prevPuzzleId = this.puzzleId;
        sessionStateStr = JSON.stringify(sessionState);
        localStorage.setItem('session', sessionStateStr);

        const SAVE_QUEUE_TIME = 8000;
        if (!this.queuedSaveGameState) {
            this.queuedSaveGameState = setTimeout(this.saveGameStateToServer.bind(this), SAVE_QUEUE_TIME);
        }
    }

    saveGameStateToServer() {

        this.queuedSaveGameState = null;
        let gameStateStr = localStorage.getItem(`puzzle_${this.puzzleId}_save`);
        let completed = this.isComplete ? 1 : 0;

        fetch('saveUserPuzzleState.php', {
            method: 'POST',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({ userId: 1, puzzleId: this.puzzleId, state: gameStateStr, completed })
        }).then((response) => {
            console.log(response);
            console.log(response.text());
        }).then(data => {
            console.log("Response from PHP:", data); // Handle the response from PHP
        }).catch(error => {
            console.error("Error:", error); // Handle any errors
        });
    }

    loadGameState() {

        let savedGameState = null;

        // Server storage
        let serverSavedState = null;
        if (window['userSavedState']) {
            serverSavedState = userSavedState;
            savedGameState = serverSavedState;
        }

        // Local storage
        const localSavedStateStr = localStorage.getItem(`puzzle_${this.puzzleId}_save`);
        if (localSavedStateStr) {
            const localSavedState = JSON.parse(localSavedStateStr);
            if (!savedGameState || !savedGameState.timestamp || (new Date(savedGameState.timestamp)) < (new Date(localSavedState.timestamp))) {
                // Only use local storage if newer than server storage
                savedGameState = localSavedState;
            }
        }

        if (savedGameState) {
            const gameState = savedGameState;

            if (gameState.isComplete) {
            //    // set complete board
                this.restoreCompleteBoard();
            } else if (gameState.cells) {
                // restore partial board
                this.restoreCellValues(gameState.cells);
            }

            return true;
        }
        return false;
    }

    restoreCellValues(cells) {
        let flatIdx = 0;
        for (let row = 0; row < this.puzzleData.height; row++) {
            for (let col = 0; col < this.puzzleData.width; col++) {
                let cell = cells[flatIdx];
                const expectedLetter = this.puzzleData.solution[row][col];

                let isEmpty = false;
                let isRevealed = false;
                let val;
                if (expectedLetter === '.') {
                    isEmpty = true;
                } else if (cell === ' ') {
                    // empty
                    val = '';
                } else if (cell === '.') {
                    // solved
                    val = expectedLetter;
                } else if (cell === '-') {
                    // revealed
                    val = expectedLetter;
                    isRevealed = true;
                } else {
                    // incorrect input
                    val = cell;
                }

                if (!isEmpty) {
                    const input = this.getCellInput(row, col);
                    input.dataset.value = val;
                    this.userState[row][col] = val;
                    input.innerText = val;
                    this.validateCell(input, row, col);

                    if (isRevealed) {
                        input.dataset.revealed = "true";
                        input.classList.add('revealed-cell');
                    }
                }

                ++flatIdx;
            }
        }
    }

    restoreCompleteBoard() {

        for (let row = 0; row < this.puzzleData.height; row++) {
            for (let col = 0; col < this.puzzleData.width; col++) {
                const input = this.getCellInput(row, col);
                const expectedLetter = this.puzzleData.solution[row][col];

                input.dataset.value = expectedLetter;
                this.userState[row][col] = expectedLetter;
                input.innerText = expectedLetter;
            }
        }
    }


    setupAutoSave() {
        // Save state after each input
        //const puzzleContainer = document.getElementById('puzzle-container');
        //puzzleContainer.addEventListener('input', () => {
        //    this.saveGameState();
        //});
        
        // Save state before user leaves the page
        //window.addEventListener('beforeunload', () => {
        //    this.saveGameState();
        //});
    }

    showRestoredMessage() {
        const message = document.createElement('div');
        message.className = 'restore-message';
        message.textContent = 'Puzzle progress restored from previous session';
        message.style.cssText = `
            background-color: #4CAF50;
            color: white;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 10px;
            opacity: 1;
            transition: opacity 0.5s ease-in-out;
        `;
        
        const puzzleInfo = document.getElementById('puzzleInfo');
        puzzleInfo.insertBefore(message, puzzleInfo.firstChild);
        
        // Fade out message after 3 seconds
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 500);
        }, 3000);
    }

    displayPuzzlesList() {

        // Browser warnings
        if (window.navigator.userAgent.match(/OPR/g) != null) {
            document.getElementById('browser-warning').classList.add('visible');
        }

        let uniquePuzzles = [];
        for (let i = 0; i < this.allPuzzles.length; ++i) {
            let puzzle = this.allPuzzles[i];
            if (!uniquePuzzles.find((e) => e.puzzleId == puzzle.puzzleId)) {
                uniquePuzzles.push(puzzle);
            } 
        }

        uniquePuzzles.sort((a, b) => {
            let aDate = (new Date(a.date)).getTime();
            let bDate = (new Date(b.date)).getTime();
            return aDate > bDate;
        });

        let prevPuzzle, nextPuzzle, thisPuzzle;
        for (let i = 0; i < uniquePuzzles.length; ++i) {
            let puzzle = uniquePuzzles[i];
            if (puzzle.puzzleId == this.puzzleData.id) {
                thisPuzzle = puzzle;
                if (i > 0) prevPuzzle = uniquePuzzles[i-1];
                if (i < (uniquePuzzles.length-1)) nextPuzzle = uniquePuzzles[i+1];
                break;
            }
        }

        const prevPuzzleEl = document.getElementById('prevPuzzle');
        if (prevPuzzle) {
            prevPuzzleEl.addEventListener('click', () => {
                // Load previous puzzle url
                window.location.search = `?puzzleid=${prevPuzzle.puzzleId}`;
            });
        } else {
            prevPuzzleEl.disabled = true;
        }


        const nextPuzzleEl = document.getElementById('nextPuzzle');
        if (nextPuzzle) {
            nextPuzzleEl.addEventListener('click', () => {
                // Load nextious puzzle url
                window.location.search = `?puzzleid=${nextPuzzle.puzzleId}`;
            });
        } else {
            nextPuzzleEl.disabled = true;
        }

    }

    displayPuzzle() {

        this.puzzleId = this.puzzleData.id;

        // Display puzzle information
        document.getElementById('puzzleTitle').textContent = this.puzzleData.title;
        document.getElementById('puzzleAuthor').textContent = `By: ${this.puzzleData.author}`;
        document.getElementById('puzzleDate').textContent = `Published: ${this.puzzleData.publicationDate}`;

        // Create grid
        const gridDiv = document.getElementById('puzzleGrid');
        const table = document.createElement('table');
        //table.className = 'puzzle-grid';
        table.className = 'flex-table-2';

        for (let row = 0; row < this.puzzleData.height; row++) {
            const tr = document.createElement('tr');
            tr.className = 'flex-row';
            for (let col = 0; col < this.puzzleData.width; col++) {
                const td = document.createElement('td');
                td.className = 'puzzle-cell';
                td.classList.add('flex-cell-2');

                if (this.puzzleData.solution[row][col] === '.') {
                    td.classList.add('black-cell');
                } else {
                    if (this.puzzleData.gridNumbers[row][col] > 0) {
                        const numberSpan = document.createElement('span');
                        numberSpan.className = 'cell-number';
                        numberSpan.textContent = this.puzzleData.gridNumbers[row][col];
                        td.appendChild(numberSpan);
                    }

                    const input = document.createElement('div');
                    input.classList.add('puzzle-cell-input', 'input');
                    input.maxLength = 1;
                    input.dataset.row = row;
                    input.dataset.col = col;
                    input.dataset.value = '';

                    let onInput = (e) => {
                        if (e.key === 'F5') return;
                        if (this.keyIsDown) return;
                        this.keyIsDown = true;
                        if (this.currentCell) {
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                                e.preventDefault();

                                const row = parseInt(this.currentCell.dataset.row, 10);
                                const col = parseInt(this.currentCell.dataset.col, 10);
                                const cellSolution = this.puzzleData.solution[row][col];

                                let clearNextCell = false;
                                if (this.currentCell.dataset.value == '') {
                                    clearNextCell = true;
                                } else if (this.currentCell.dataset.value != cellSolution) {
                                    this.currentCell.dataset.value = '';
                                    this.currentCell.innerText = '';
                                    this.userState[row][col] = '';
                                }

                                this.moveToPrevCell(row, col);

                                if (clearNextCell) {
                                    const nextRow = parseInt(this.currentCell.dataset.row, 10);
                                    const nextCol = parseInt(this.currentCell.dataset.col, 10);
                                    this.currentCell.dataset.value = '';
                                    this.currentCell.innerText = '';
                                    this.userState[nextRow][nextCol] = '';
                                }
                            } else {
                                this.handleCellInput(this.currentCell, e);
                                //this.handleArrowKeys(this.currentCell, e);
                            }

                            e.preventDefault();
                        }
                    };

                    //input.addEventListener('focus', (e) => this.handleCellFocus(e.target, e));
                    //document.addEventListener('keydown', (e) => {
                    //    onInput(e);
                    //});
                    document.getElementById('hiddenInput').addEventListener('keydown', (e) => {
                        if (e.key === 'Backspace') {
                            onInput(e);
                        }
                    });

                    document.getElementById('hiddenInput').addEventListener('input', (e) => {
                        // Mobile is weird, so we have to check hidden input for OSK event
                        if (!e.key) {
                            e.key = document.getElementById('hiddenInput').value;
                            if (e.key === '') {
                                // delete
                                e.key = 'Backspace';
                            }
                            document.getElementById('hiddenInput').value = '';
                            onInput(e);
                        }
                    });

                    document.addEventListener('keyup', (e) => {
                        this.keyIsDown = false;
                    });
                    //input.addEventListener('focus', (e) => {
                    //    this.handleCellFocus(e.target, e);
                    //    e.target.select();
                    //    this.selectionStart = this.selectionEnd;
                    //});

                    // Add space key handler to toggle direction
                    input.addEventListener('keydown', (e) => {
                        if (e.key === ' ') {
                            e.preventDefault();
                            this.toggleDirection();
                            this.handleCellFocus(e.target);
                        }
                    });
                    input.addEventListener('click', (e) => {
                        //this.toggleDirection();
                        this.handleCellClick(e.target, e);
                        //input.setSelectionRange(input.value.length, input.value.length);
                        e.preventDefault();
                    });

                    input.addEventListener('mousedown', (e) => {
                        //input.setSelectionRange(input.value.length, input.value.length);
                        e.preventDefault();
                    });

                    input.addEventListener('mouseup', (e) => {
                        //input.setSelectionRange(input.value.length, input.value.length);
                        e.preventDefault();
                    });


                    // Prevent paste
                    input.addEventListener('paste', (e) => {
                        e.preventDefault();
                    });

                    // Prevent drag and drop
                    input.addEventListener('drop', (e) => {
                        e.preventDefault();
                    });

                    input.addEventListener('dblclick', (e) => {
                        this.handleCellDblClick(e.target, e);
                        e.preventDefault();
                        //input.setSelectionRange(input.value.length, input.value.length);
                    });
                    //inputWrapper.appendChild(input);
                    //td.appendChild(inputWrapper);
                    td.appendChild(input);
                }
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        gridDiv.innerHTML = '';
        gridDiv.appendChild(table);

        this.initializeWordCells();
        this.setupClues();


        document.getElementById('aiToggle').addEventListener('click', (e) => {
            this.clueType = (this.clueType > 0 ? 0 : 1);
            if (this.currentCell) {
                const row = parseInt(this.currentCell.dataset.row);
                const col = parseInt(this.currentCell.dataset.col);
                this.updateCurrentClue(row, col);
                this.handleCellFocus(this.currentCell);
            }

            e.preventDefault();
        });

        document.getElementById('revealCells').addEventListener('click', (e) => {
            this.revealRandomCells(5);
            e.preventDefault();
        });

        document.getElementById('calendarView').addEventListener('click', (e) => {
            window.location = 'calendar.php';
            e.preventDefault();
        });

        //this.clueElements.text.addEventListener('click', (e) => {
        //    this.useAIClue = !this.useAIClue;
        //    if (this.currentCell) {
        //        const row = parseInt(this.currentCell.dataset.row);
        //        const col = parseInt(this.currentCell.dataset.col);
        //        this.updateCurrentClue(row, col);
        //    }
        //});
        document.getElementById('current-clue-display').addEventListener('click', (e) => {
            this.clueType++;
            if (this.clueType == 3) this.clueType = 0;
            if (this.currentCell) {
                const row = parseInt(this.currentCell.dataset.row);
                const col = parseInt(this.currentCell.dataset.col);
                this.updateCurrentClue(row, col);
                this.handleCellFocus(this.currentCell);
            }
            e.preventDefault();
        });

        this.clueElements.leftClue.addEventListener('click', (e) => {
            this.loadAdjacentClue(-1);
        });

        this.clueElements.rightClue.addEventListener('click', (e) => {
            this.loadAdjacentClue(1);
        });

        // Load saved state if it exists
        const hasRestoredState = this.loadGameState();
        
        // Add auto-save functionality
        //this.setupAutoSave();
        
        if (hasRestoredState) {
            this.showRestoredMessage();
        }
    }

    getCellInput(row, col) {
        return document.querySelector(`.input[data-row="${row}"][data-col="${col}"]`);
    }

    handleCellFocus(input) {
        if (this.currentCell) {
            this.currentCell.classList.remove('focus');
        }

        document.getElementById('hiddenInput').focus();
        this.currentCell = input;
        input.classList.add('focus');
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);
        this.updateAllCellsHighlight();
        this.updateCurrentClue(row, col);

        const puzzleContainer = document.getElementById('puzzle-container');
        puzzleContainer.scrollIntoView()
    }

    handleCellClick(input) {
        const currentTime = Date.now();
        
        // switch direction?
        if (input === this.currentCell) {
            this.toggleDirection();
        }

        if (this.currentCell != input) {
            this.handleCellFocus(input);
        }
        
        this.lastClickTime = currentTime;
    }

    handleCellDblClick(input) {
        const row = parseInt(this.currentCell.dataset.row);
        const col = parseInt(this.currentCell.dataset.col);
        this.revealCell(row, col);
    }

    handleCellInput(input, event) {
        // Prevent the default behavior
        event.preventDefault();

        let row = parseInt(input.dataset.row);
        let col = parseInt(input.dataset.col);

        // Get the typed character
        const char = event.key.toUpperCase();

        // Only process alphabetic characters
        if (/^[A-Z]$/.test(char)) {

            if (this.autoCheck && this.isCellCorrect(row, col)) {
                // first move to next cell
                this.moveToNextCell(row, col);

                // did we even move?
                const oldRow = row, oldCol = col;
                let newRow = parseInt(this.currentCell.dataset.row);
                let newCol = parseInt(this.currentCell.dataset.col);
                if (oldRow === newRow && oldCol === newCol) {
                    // didn't move, just bail
                    return;
                }

                row = newRow;
                col = newCol;
                input = this.currentCell;
            }

            // Replace the current value
            input.dataset.value = char;
            input.innerText = char;

            // Update user state
            this.userState[row][col] = char;

            // Validate if autoCheck is enabled
            if (this.autoCheck) {
                this.validateCell(input, row, col);
            }

            // Move to next cell
            this.moveToNextCell(row, col);
        }

        // update current clue, in case we solved the word
        this.updateCurrentClue(row, col);

        // Save state after each input
        this.saveGameState();
    }

    isCellCorrect(row, col) {
        return this.userState[row][col] === this.puzzleData.solution[row][col];
    }

    isWordSolved(row, col) {
        const cells = this.direction === 'across' 
            ? this.getAcrossWord(row, col) 
            : this.getDownWord(row, col);
        const wordLen = cells.length;

        for (let i = 0; i < wordLen; ++i) {
            const cell = cells[i];
            if (!this.isCellCorrect(cell.row, cell.col)) {
                return false;
            }
        }

        return true;
    }

    toggleDirection() {
        this.direction = this.direction === 'across' ? 'down' : 'across';
        //document.getElementById('direction-text').textContent = 
        //    this.direction.charAt(0).toUpperCase() + this.direction.slice(1);
        if (this.currentCell) {
            const row = parseInt(this.currentCell.dataset.row);
            const col = parseInt(this.currentCell.dataset.col);
            this.updateAllCellsHighlight();
            this.updateCurrentClue(row, col);
        }
    }

    moveToAdjacentCell(currentRow, currentCol, step) {
        const cells = this.direction === 'across' 
            ? this.getAcrossWord(currentRow, currentCol) 
            : this.getDownWord(currentRow, currentCol);
        const wordLen = cells.length;

        let row = currentRow, col = currentCol;
        let cell = null;
        let i;
        for (i = 1; i < wordLen; ++i) {
            if (this.direction === 'down') {
                row += step;
            } else {
                col += step;
            }

            let cellSolution = null;
            if
            (
                step > 0 &&
                (
                    row >= this.puzzleData.height ||
                    col >= this.puzzleData.width ||
                    (cellSolution = this.puzzleData.solution[row][col]) === '.'
                )
            )
            {
                // loop to beginning of word
                if (this.direction === 'down') {
                    row = currentRow - step * (wordLen - i + 1);
                } else {
                    col = currentCol - step * (wordLen - i + 1);
                }

                --i;
                continue;
            }
            else if
            (
                step < 0 &&
                (
                    row < 0 ||
                    col < 0 ||
                    (cellSolution = this.puzzleData.solution[row][col]) === '.'
                )
            )
            {
                // loop to end of word
                if (this.direction === 'down') {
                    row = currentRow - step * (wordLen - i + 1);
                } else {
                    col = currentCol - step * (wordLen - i + 1);
                }

                --i;
                continue;
            }

            if (!this.autoCheck) break;
            cell = this.getCellInput(row, col);
            if (cell && cell.dataset.value != cellSolution) break;
        }

        if (i === wordLen) return; // looped back to start

        if (row != currentRow || col != currentCol && cell != null) {
            this.handleCellFocus(cell);
        }
    }

    moveToNextCell(currentRow, currentCol) {
        this.moveToAdjacentCell(currentRow, currentCol, 1);
    }

    moveToPrevCell(currentRow, currentCol) {
        this.moveToAdjacentCell(currentRow, currentCol, -1);
    }

    // Update arrow key navigation to use smart navigation
    handleArrowKeys(input, event) {
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);

        if (event.key.startsWith('Arrow')) {
            event.preventDefault();
            let nextCell;

            switch(event.key) {
                case 'ArrowLeft':
                    this.moveToPreviousCell(row, col);
                    break;
                case 'ArrowRight':
                    this.moveToNextCell(row, col);
                    break;
                case 'ArrowUp':
                    let upRow = row;
                    do {
                        upRow--;
                        if (upRow < 0) break;
                        nextCell = this.getCellInput(upRow, col);
                    } while (
                        nextCell && 
                        this.autoCheck && 
                        this.isCellCorrect(upRow, col)
                    );
                    if (nextCell) this.handleCellFocus(nextCell);
                    break;
                case 'ArrowDown':
                    let downRow = row;
                    do {
                        downRow++;
                        if (downRow >= this.puzzleData.height) break;
                        nextCell = this.getCellInput(downRow, col);
                    } while (
                        nextCell && 
                        this.autoCheck && 
                        this.isCellCorrect(downRow, col)
                    );
                    if (nextCell) this.handleCellFocus(nextCell);
                    break;
            }
        }
    }

    revealCell(row, col) {
        const input = this.getCellInput(row, col);
        if (input) {
            const char = this.puzzleData.solution[row][col];

            // Don't reveal if we already have the solution
            if (input.dataset.value !== char)
            {
                input.dataset.value = char;
                input.dataset.revealed = "true";
                input.innerText = char;
                this.userState[row][col] = char;
                input.classList.add('revealed-cell');
            }

            this.saveGameState();
        }
    }

    revealRandomCells(n) {
        let missingCells = [];
        for (let row = 0; row < this.puzzleData.height; ++row) {
            for (let col = 0; col < this.puzzleData.width; ++col) {
                let userInput = this.userState[row][col],
                    correct = this.puzzleData.solution[row][col];

                if (userInput !== correct) {
                    missingCells.push({ col, row });
                }
            }
        }

        for (let i = 0; i < n && missingCells.length > 0; ++i) {
            let randIdx = Math.floor(missingCells.length * Math.random()),
                cell = missingCells[randIdx];
            missingCells.splice(randIdx, 1);

            this.revealCell(cell.row, cell.col);
        }
    }

    updateCurrentClue(row, col) {
        // Clear previous highlighting
        document.querySelectorAll('.clue-item').forEach(clue => {
            clue.classList.remove('highlighted-clue');
        });

        // Find the clue
        const clueList = this.direction === 'across' ? this.puzzleData.cluesFlat.across : this.puzzleData.cluesFlat.down;
        const clueMapping = this.puzzleData.cluesGrid[row][col];
        const acrossClue = clueMapping[0], downClue = clueMapping[1];
        const clueListIdx = this.direction === 'across' ? acrossClue : downClue;
        const clue = clueList[clueListIdx];

        this.clueElements.display.classList.remove('ai-mode');
        this.clueElements.display.classList.remove('ai-mode-easy');
        
        if (clue) {
            // Update the current clue display
            let clueText = clue.text;
            if (this.clueType == 0) {
                // NYT
            } else if (this.clueType == 1) {
                // GPT
                clueText = clue.textAI;
                this.clueElements.display.classList.add('ai-mode');
            } else {
                // GPT-Easy
                clueText = clue.textAIEasy;
                this.clueElements.display.classList.add('ai-mode-easy');
            }

            if (clue.wordCount > 1) {
                clueText += ` (${clue.wordCount} words)`;
            }

            const isSolved = this.isWordSolved(row, col);
            if (isSolved) {
                this.clueElements.explanation.classList.add('show');
                this.clueElements.explanation.textContent = clue.explanation;
                this.clueElements.display.classList.add('solved');
            } else {
                this.clueElements.display.classList.remove('solved');
                this.clueElements.explanation.classList.remove('show');
            }

            this.clueElements.text.textContent = `${clueListIdx}${this.direction.toUpperCase()[0]} ${clueText}`;
            
            // Highlight the clue in the list
            const clueElement = document.querySelector(`#clue-${this.direction}-${clueListIdx}`);
            if (clueElement) {
                clueElement.classList.add('highlighted-clue');
                //clueElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    loadAdjacentClue(step) {
        if (this.currentCell) {
            const row = parseInt(this.currentCell.dataset.row);
            const col = parseInt(this.currentCell.dataset.col);

            const clueList = this.direction === 'across' ? this.puzzleData.cluesFlat.across : this.puzzleData.cluesFlat.down;
            const clueMapping = this.puzzleData.cluesGrid[row][col];
            let clueListKey = this.direction === 'across' ? clueMapping[0] : clueMapping[1];
            let clueListIdx = Object.keys(clueList).indexOf(`${clueListKey}`);

            if (step > 0) {
                if (clueListIdx === clueList.length - 1) {
                    clueListIdx = 0;
                } else {
                    clueListIdx++;
                }
            } else {
                if (clueListIdx === 0) {
                    clueListIdx = clueList.length - 1;
                } else {
                    clueListIdx--;
                }
            }

            clueListKey = Object.keys(clueList)[clueListIdx];
            const clue = clueList[clueListKey];
            const div = document.getElementById(`clue-${this.direction}-${clueListKey}`);
            this.handleClueClick(this.direction, clue.cells[0], div)
        }
    }

    setupClues() {
        const cluesAcrossMap = {}, cluesDownMap = {};
        this.puzzleData.cluesGrid.forEach((row) => {
            row.forEach((col) => {
                let acrossClue = col[0];
                let downClue = col[1];
                if (acrossClue != -1) {
                    cluesAcrossMap[acrossClue] = this.puzzleData.cluesFlat.across[acrossClue];
                }

                if (downClue != -1) {
                    cluesDownMap[downClue] = this.puzzleData.cluesFlat.down[downClue];
                }
            });
        });

        const acrossClues = document.getElementById('acrossClues');
        const downClues = document.getElementById('downClues');

        acrossClues.innerHTML = '';
        downClues.innerHTML = '';

        for (let c in cluesAcrossMap) {
            const clue = cluesAcrossMap[c];

            const div = document.createElement('div');
            div.className = 'clue-item';
            //const number = this.findClueNumber('across', index);
            const number = parseInt(c, 10);
            div.id = `clue-across-${number}`;
            div.textContent = `${number}. ${clue.text}`;
            div.addEventListener('click', () => this.handleClueClick('across', clue.cells[0], div));
            acrossClues.appendChild(div);
        }


        for (let c in cluesDownMap) {
            const clue = cluesDownMap[c];

            const div = document.createElement('div');
            div.className = 'clue-item';
            //const number = this.findClueNumber('down', index);
            const number = parseInt(c, 10);
            div.id = `clue-down-${number}`;
            div.textContent = `${number}. ${clue.text}`;
            div.addEventListener('click', () => this.handleClueClick('down', clue.cells[0], div));
            downClues.appendChild(div);
        }

    }


    isAcrossStart(row, col) {
        if (this.puzzleData.solution[row][col] === '.') return false;
        // First column, or previous cell is black
        return col === 0 || this.puzzleData.solution[row][col - 1] === '.';
    }

    isDownStart(row, col) {
        if (this.puzzleData.solution[row][col] === '.') return false;
        // First row, or cell above is black
        return row === 0 || this.puzzleData.solution[row - 1][col] === '.';
    }

    handleClueClick(direction, cellNumber, clueDiv) {
        // Update the current direction
        this.direction = direction;

        // Find the starting position for this clue
        //const position = this.findPositionByNumber(number);

        const position = {
            row: parseInt(cellNumber / this.puzzleData.width, 10),
            col: cellNumber % this.puzzleData.width
        };

        if (position) {
            // Select the cell and update highlighting
            let clickedCell = this.getCellInput(position.row, position.col);
            this.handleCellFocus(clickedCell);

            // Update clue highlighting
            document.querySelectorAll('.clue-item').forEach(div => {
                div.classList.remove('highlighted');
            });

            // Find and highlight the clicked clue
            //const clueDiv = document.querySelector(`#${direction}Clues .clue-item[data-number="${number}"]`);
            //if (clueDiv) {
            //    clueDiv.classList.add('highlighted');
            //    clueDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            //}
        }
    }

    initializeWordCells() {
        // Initialize word cells map
        this.wordCells.clear();
        
        // Find all across words
        for (let row = 0; row < this.puzzleData.height; row++) {
            let wordStart = null;
            for (let col = 0; col < this.puzzleData.width; col++) {
                if (this.getCellInput(row, col)) {
                    if (wordStart === null) wordStart = col;
                    // If this is part of a word (2 or more cells)
                    if (col > wordStart) {
                        // Add both directions for this cell
                        this.addWordCell(row, col, 'across');
                        this.addWordCell(row, col, 'down');
                    }
                } else {
                    wordStart = null;
                }
            }
        }

        // Find all down words
        for (let col = 0; col < this.puzzleData.width; col++) {
            let wordStart = null;
            for (let row = 0; row < this.puzzleData.height; row++) {
                if (this.getCellInput(row, col)) {
                    if (wordStart === null) wordStart = row;
                    // If this is part of a word (2 or more cells)
                    if (row > wordStart) {
                        // Add both directions for this cell
                        this.addWordCell(row, col, 'across');
                        this.addWordCell(row, col, 'down');
                    }
                } else {
                    wordStart = null;
                }
            }
        }

        // Apply initial highlighting
        this.updateAllCellsHighlight();
    }

    addWordCell(row, col, direction) {
        const key = `${row},${col}`;
        if (!this.wordCells.has(key)) {
            this.wordCells.set(key, new Set());
        }
        this.wordCells.get(key).add(direction);
    }

    updateAllCellsHighlight() {
        // Remove all highlighting first
        const cells = document.querySelectorAll('.puzzle-cell');
        cells.forEach(cell => {
            cell.classList.remove('word-cell-across', 'word-cell-down', 
                               'current-word-across', 'current-word-down');
        });

        // Apply word cell highlighting
        this.wordCells.forEach((directions, key) => {
            const [row, col] = key.split(',').map(Number);
            const cell = this.getCellInput(row, col);
            if (cell) {
                directions.forEach(direction => {
                    cell.parentElement.classList.add(`word-cell-${direction}`);
                });
            }
        });

        // If there's a current cell, highlight its word
        if (this.currentCell) {
            const row = parseInt(this.currentCell.dataset.row);
            const col = parseInt(this.currentCell.dataset.col);
            this.highlightCurrentWord(row, col);
        }
    }

    highlightCurrentWord(row, col) {
        // Clear previous current word highlighting
        const cells = document.querySelectorAll('.puzzle-cell');
        cells.forEach(cell => {
            cell.classList.remove('current-word-across', 'current-word-down');
        });

        const highlightClass = `current-word-${this.direction}`;

        if (this.direction === 'across') {
            // Highlight current row
            let currentCol = col;
            while (currentCol >= 0 && this.getCellInput(row, currentCol)) {
                const cell = this.getCellInput(row, currentCol);
                cell.parentElement.classList.add(highlightClass);
                currentCol--;
            }
            currentCol = col + 1;
            while (currentCol < this.puzzleData.width && 
                   this.getCellInput(row, currentCol)) {
                const cell = this.getCellInput(row, currentCol);
                cell.parentElement.classList.add(highlightClass);
                currentCol++;
            }
        } else {
            // Highlight current column
            let currentRow = row;
            while (currentRow >= 0 && this.getCellInput(currentRow, col)) {
                const cell = this.getCellInput(currentRow, col);
                cell.parentElement.classList.add(highlightClass);
                currentRow--;
            }
            currentRow = row + 1;
            while (currentRow < this.puzzleData.height && 
                   this.getCellInput(currentRow, col)) {
                const cell = this.getCellInput(currentRow, col);
                cell.parentElement.classList.add(highlightClass);
                currentRow++;
            }
        }
    }

    getAcrossWord(row, col) {
        const cells = [];
        let startCol = col;

        // Find start of word by moving left until we hit a black square or edge
        while (startCol > 0 && this.puzzleData.solution[row][startCol - 1] !== '.') {
            startCol--;
        }

        // Collect all cells in the word by moving right until we hit a black square or edge
        while (startCol < this.puzzleData.width && this.puzzleData.solution[row][startCol] !== '.') {
            cells.push({ row, col: startCol });
            startCol++;
        }

        return cells;
    }

    getDownWord(row, col) {
        const cells = [];
        let startRow = row;

        // Find start of word by moving up until we hit a black square or edge
        while (startRow > 0 && this.puzzleData.solution[startRow - 1][col] !== '.') {
            startRow--;
        }

        // Collect all cells in the word by moving down until we hit a black square or edge
        while (startRow < this.puzzleData.height && this.puzzleData.solution[startRow][col] !== '.') {
            cells.push({ row: startRow, col });
            startRow++;
        }

        return cells;
    }

    highlightClue(row, col) {
        // Remove highlighting from all clues
        document.querySelectorAll('.clue-item').forEach(div => {
            div.classList.remove('highlighted');
        });

        // Get the clue number for the current word
        const number = this.getWordNumber(row, col);
        if (number) {
            // Find and highlight the corresponding clue div
            const clueDiv = this.findClueDiv(this.direction, number);
            if (clueDiv) {
                clueDiv.classList.add('highlighted');
                // Scroll the clue into view
                //clueDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    getWordNumber(row, col) {
        // Get all cells in the current word
        const cells = this.direction === 'across' 
            ? this.getAcrossWord(row, col) 
            : this.getDownWord(row, col);

        // Return the number of the first cell in the word
        if (cells.length > 0) {
            const startCell = cells[0];
            return this.puzzleData.gridNumbers[startCell.row][startCell.col];
        }
        return null;
    }

    findClueDiv(direction, number) {
        return document.querySelector(`#${direction}Clues .clue-item[data-number="${number}"]`);
    }
}

