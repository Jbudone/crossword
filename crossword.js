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
        this.userSavedState = null;
        
        this.wordCells = new Map(); // Store word cells for quick lookup

        this.clueElements = {
            display: document.getElementById('current-clue-display'),
            explanation: document.getElementById('current-clue-explanation'),
            leftClue: document.getElementById('clue-left'),
            rightClue: document.getElementById('clue-right'),
            text: document.getElementById('clue-text'),
        };

        this.clueType = 0; // 0: NYT, 1: GPT, 2: GPT-Easy

        // For interactive play
        this.pubSub = null;
        this.pubSubClient = null;
    }

    async initialize() {
        await this.loadPuzzleNYT();
    }

    loadPuzzlesList() {

        // all user's puzzles
        let uri = 'getUserPuzzles.php';
        fetch(uri, {
            method: 'GET'
        }).then(response => response.text())
          .then((res) => {
              this.allPuzzles = JSON.parse(res);
              this.displayPuzzlesList();
          });
    }

    async initPubSub() {


        // FIXME: crossword DB userID with deviceID
        const clientIdN = parseInt(Math.random() * 1000000),
            clientId = `client-${clientIdN}`;

        this.pubSubClient = clientId;
        const channelName = `crossword-id-${this.puzzleId}`;

        const client = new Ably.Realtime({ key, clientId });

        await client.connection.once('connected');

        const channel = client.channels.get(channelName);

        await channel.subscribe((message) => {
            if (message.clientId == this.pubSubClient) return; // loopback
            //console.log('RECEIVED ' + message.data);

            const json = message.data;
            if (json.setCell) {
                const cell = this.getCellInput(json.row, json.col);
                this.setCell(cell, json.char, json.cheated);
            } else if (json.selectCells) {

                const cells = document.querySelectorAll('.puzzle-cell');
                cells.forEach(cell => {
                    cell.classList.remove('friend-current-word');
                });

                json.selectCells.forEach((cell) => {
                    const cellEl = this.getCellInput(cell.row, cell.col);
                    cellEl.parentElement.classList.add('friend-current-word');
                });
            }
        });

        await channel.presence.subscribe('enter', (member) => {
            console.log("MEMBER ENTERED");
            console.log(member.data);
        });

        await channel.presence.subscribe('leave', (member) => {
            console.log("MEMBER LEFT");
            console.log(member.data);

            const cells = document.querySelectorAll('.puzzle-cell');
            cells.forEach(cell => {
                cell.classList.remove('friend-current-word');
            });
        });

        await channel.presence.enterClient(clientId);

        this.pubSub = channel;
    }

    async pubSubSend(msg) {
        await this.pubSub.publish('test', msg);
    }

    async pubSubSendInput(row, col, char, cheated) {
        // Cheated: revealed cell rather than manually answering
        this.pubSubSend({
            setCell: true,
            row, col, char,
            cheated
        });
    }

    async pubSubSendSelected(cells) {
        this.pubSubSend({
            selectCells: cells
        });
    }

    async loadedPuzzleNYT() {

        try {
            this.userState = Array(this.puzzleData.height).fill()
                .map(() => Array(this.puzzleData.width).fill(''));
            await this.displayPuzzle();
            this.loadPuzzlesList();

            await this.initPubSub();
        } catch (error) {
            console.error('Error parsing puzzle:', error);
            alert('Error parsing puzzle file');
        }
    }


    async loadPuzzleNYT() {
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
            else {
                // None -- default to some arbitrary known puzzleid
                // FIXME: we should instead load all crosswords and then find the newest -
                urlPuzzleId = 22697;
            }
        }

        let savedGameState = null;
        this.puzzleData = null;

        // Fetch puzzle from localStorage
        let localPuzData = localStorage.getItem(`puzzle_${urlPuzzleId}`); // puzData
        if (localPuzData) {
            const json = JSON.parse(localPuzData);

            // Load local puzData
            const localPuzDataDecomp = LZString.decompressFromBase64(json.data);
            this.puzzleData = JSON.parse(localPuzDataDecomp);

            // Load local savedState (if exists)
            let localSave = localStorage.getItem(`puzzle_${urlPuzzleId}_save`); // local saveState
            if (localSave) {
                savedGameState = JSON.parse(localSave);
            }
        }

        // Fetch puzzle from cloud: puzData (if not stored locally), and savedState (if exists on cloud)
        // NOTE: we fetch always, in case server has more recent savedState (from another client)
        let uri = 'getUserPuzzle.php';
        if (urlPuzzleId) {
            uri += `?puzzleId=${urlPuzzleId}`;

            // Do we already have puzData? Then we only want savedState
            if (this.puzzleData != null) {
                uri += `&saveStateOnly=1`;
            }
        }

        fetch(uri, {
            cache: 'no-cache', // cache busting user saves
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

            // load puzData
            if (json.data) {
                let resDecomp = LZString.decompressFromBase64(json.data);
                this.puzzleData = JSON.parse(resDecomp);
                let puzzleId = this.puzzleData.id;
                localStorage.setItem(`puzzle_${puzzleId}`, res); // puzdata
            }

            // load saveData
            const cloudSaveData = json.saveData && JSON.parse(json.saveData);
            let loadingGameState = null;
            if (!savedGameState) {
                loadingGameState = cloudSaveData;
            } else if (!cloudSaveData) {
                loadingGameState = savedGameState;
            } else if (savedGameState.state != cloudSaveData.state) {
                // state mismatch, prefer   solved > partial > blank
                loadingGameState = (savedGameState.state > cloudSaveData) ? savedGameState : cloudSaveData;
            } else {
                // Merge cloud + localStorage, in case there was a mismatch (eg. playing offline)
                // Zip the two arrays, and prefer: solved > revealed > wrong > blank
                if (savedGameState.cells.length != cloudSaveData.cells.length) {
                    loadingGameState = cloudSaveData;
                } else {
                    loadingGameState = savedGameState;
                    let mergedCells = "";
                    for (let i = 0; i < savedGameState.cells.length; ++i) {
                        const savedCell = savedGameState.cells[i],
                            cloudCell = cloudSaveData.cells[i];
                        let savedCellValue = 0,
                            cloudCellValue = 0;

                        if (savedCell == ' ') savedCellValue = 0;
                        else if (savedCell == '-') savedCellValue = 2;
                        else if (savedCell == '.') savedCellValue = 3;

                        if (cloudCell == ' ') cloudCellValue = 0;
                        else if (cloudCell == '-') cloudCellValue = 2;
                        else if (cloudCell == '.') cloudCellValue = 3;

                        const usedCell = (savedCellValue >= cloudCellValue) ? savedCell : cloudCell;
                        mergedCells += usedCell;
                    }
                    loadingGameState.cells = mergedCells;
                }
            }
            
            this.userSavedState = loadingGameState;
            this.loadedPuzzleNYT();
        });
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
        localStorage.setItem(`puzzle_${this.puzzleId}_save`, gameStateStr); // saved gameState

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

        const SAVE_QUEUE_TIME = 500;
        if (!this.queuedSaveGameState) {
            this.queuedSaveGameState = setTimeout(this.saveGameStateToServer.bind(this), SAVE_QUEUE_TIME);
        }
    }

    saveGameStateToServer() {

        this.queuedSaveGameState = null;
        let gameStateStr = localStorage.getItem(`puzzle_${this.puzzleId}_save`); // saved gameState
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

    async loadGameState() {

        let gameState = this.userSavedState;

        if (gameState.cells) {
            // Board complete?
            let flatIdx = 0;
            let assumedComplete = true;
            for (let row = 0; row < this.puzzleData.height && assumedComplete; row++) {
                for (let col = 0; col < this.puzzleData.width && assumedComplete; col++) {
                    let cell = gameState.cells[flatIdx];
                    const expectedLetter = this.puzzleData.solution[row][col];

                    if (cell != '.' && cell != '-' && expectedLetter != '.' && cell != expectedLetter) {
                        assumedComplete = false;
                    }

                    ++flatIdx;
                }
            }

            gameState.isComplete = assumedComplete;
            this.restoreCellValues(gameState.cells);
        }

        return true;
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

    async showCompleted() {

        //await loadAll(tsParticles);
        //await tsParticles.load({ id: "confetti", options });


        const duration = 60 * 60 * 1000,
            animationEnd = Date.now() + duration,
            defaults = { startVelocity: 30, spread: 360, ticks: 20, zIndex: 0 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 20 * (timeLeft / duration);

            // since particles fall down, start a bit higher than random
            confetti(
                Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
                })
            );

            confetti(
                Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
                })
            );
        }, 250);
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

    getMonthName(idx) {
        const MONTHS_OF_YEAR = [ "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC" ];
        return MONTHS_OF_YEAR[idx];
    };

    getMonthFullName(idx) {
        const MONTHS_OF_YEAR = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
        return MONTHS_OF_YEAR[idx];
    };

    async displayPuzzle() {

        this.puzzleId = this.puzzleData.id;

        // Display puzzle information
        document.getElementById('puzzleTitle').textContent = this.puzzleData.title;
        document.getElementById('puzzleAuthor').textContent = `By: ${this.puzzleData.author}`;
        //document.getElementById('puzzleDate').textContent = `Published: ${this.puzzleData.publicationDate}`;

        // Create calendar
        const monthIdx = (new Date(this.puzzleData.publicationDate)).getMonth();
        const dateIdx = (new Date(this.puzzleData.publicationDate)).getDate();
        const calendarMonthEl = document.getElementsByClassName('date-header-month')[0];
        calendarMonthEl.textContent = this.getMonthFullName(monthIdx);

        const calendarDayEl = document.getElementsByClassName('date-day')[0];
        calendarDayEl.textContent = dateIdx + 1;

        // Create grid
        const gridDiv = document.getElementById('puzzleGrid');
        const table = document.createElement('table');
        table.className = 'flex-table-2';

        let cellIdx = -1, cellNumberCount = 0;
        let curAcrossClueIdx = -1, curDownClueIdx = -1;
        for (let row = 0; row < this.puzzleData.height; row++) {
            const tr = document.createElement('tr');
            tr.className = 'flex-row';
            for (let col = 0; col < this.puzzleData.width; col++) {
                ++cellIdx;
                const td = document.createElement('td');
                td.className = 'puzzle-cell';
                td.classList.add('flex-cell-2');

                if (this.puzzleData.solution[row][col] === '.') {
                    td.classList.add('black-cell');
                } else {

                    // Grid Number
                    let newClueNumber = false;

                    if
                    (
                        this.puzzleData.cluesFlat.across[cellNumberCount] &&
                        cellIdx == this.puzzleData.cluesFlat.across[cellNumberCount].cells[0]
                    )
                    {
                        curAcrossClueIdx = cellNumberCount;
                        newClueNumber = true;
                    }

                    if
                    (
                        this.puzzleData.cluesFlat.down[cellNumberCount] &&
                        cellIdx == this.puzzleData.cluesFlat.down[cellNumberCount].cells[0]
                    )
                    {
                        curDownClueIdx = cellNumberCount;
                        newClueNumber = true;
                    }

                    if (newClueNumber)
                    {
                        cellNumberCount++;
                        const numberSpan = document.createElement('span');
                        numberSpan.className = 'cell-number';
                        numberSpan.textContent = `${cellNumberCount}`;
                        td.appendChild(numberSpan);
                    }

                    const input = document.createElement('div');
                    input.classList.add('puzzle-cell-input', 'input');
                    input.maxLength = 1;
                    input.dataset.row = row;
                    input.dataset.col = col;
                    input.dataset.acrossClueIdx = curAcrossClueIdx;
                    input.dataset.downClueIdx = curDownClueIdx;
                    input.dataset.value = '';
                    //input.addEventListener('focus', (e) => this.handleCellFocus(e.target, e));
                    //input.addEventListener('focus', (e) => {
                    //    this.handleCellFocus(e.target, e);
                    //    e.target.select();
                    //    this.selectionStart = this.selectionEnd;
                    //});

                    input.addEventListener('click', (e) => {
                        this.handleCellClick(e.target, e);
                        e.preventDefault();
                    });

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


        let onInput = (key) => {
            if (this.currentCell) {
                let char = null;
                if (key === 'Backspace' || key === 'Delete' || key === '') {
                    char = '';
                } else {
                    char = key.toUpperCase();
                }

                this.handleCellInput(this.currentCell, char);
                this.saveGameState();
            }
        };

        //document.addEventListener('keydown', (e) => {
        //    onInput(e);
        //});
        document.getElementById('hiddenInput').addEventListener('keydown', (e) => {
            if (e.key === 'F5') return;
            if (this.keyIsDown) return;
            this.keyIsDown = true;
            // FIXME: broke this on PC, probably just need to focus hiddenInput and get rid of this if below to always onInput
            if (e.key === 'Backspace') {
                e.preventDefault();
                onInput('Backspace');
            }
        });

        document.getElementById('hiddenInput').addEventListener('input', (e) => {
            // Mobile is weird, so we have to check hidden input for OSK event
            if (e.key === 'F5') return;
            if (!e.key) {
                e.preventDefault();
                let char = document.getElementById('hiddenInput').value;
                if (e.key === '') {
                    // delete
                    char = 'Backspace';
                }
                document.getElementById('hiddenInput').value = '';
                onInput(char);
            }
        });

        // hook keys
        Object.values(document.getElementsByClassName('keyboard-key'))
            .forEach((k) => {
                const data = k.attributes['data'].value;
                k.addEventListener('mousedown', (e) => { onInput(data); });
                k.addEventListener('mouseup', (e) => { this.keyIsDown = false; }); // FIXME: probably don't need this anymore
            });

        document.addEventListener('keyup', (e) => {
            this.keyIsDown = false;
        });


        document.getElementById('aiToggle').addEventListener('click', (e) => {
            this.clueType = (this.clueType > 0 ? 0 : 1);
            if (this.currentCell) {
                const { row, col } = this.getRowCol(this.currentCell);
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
        this.clueElements.text.addEventListener('click', (e) => {
            this.clueType++;
            if (this.clueType == 3) this.clueType = 0;
            if (this.currentCell) {
                const { row, col } = this.getRowCol(this.currentCell);
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
        if (this.userSavedState) {
            await this.loadGameState();

            if (this.userSavedState.isComplete) {
                await this.showCompleted();
            }
        }
    }

    getCellInput(row, col) {
        return document.querySelector(`.input[data-row="${row}"][data-col="${col}"]`);
    }

    getRowCol(cell) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        return { row, col };
    }

    handleCellFocus(input) {
        if (this.currentCell) {
            this.currentCell.classList.remove('focus');
        }

        //document.getElementById('hiddenInput').focus();
        this.currentCell = input;
        input.classList.add('focus');
        const { row, col } = this.getRowCol(input);
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
        const { row, col } = this.getRowCol(this.currentCell);
        this.revealCell(row, col);
        this.updateCurrentClue(row, col);
        this.saveGameState();
    }

    onUpdatedBoard() {

        // Board complete?
        let assumedComplete = true;
        for (let row = 0; row < this.puzzleData.height && assumedComplete; row++) {
            for (let col = 0; col < this.puzzleData.width && assumedComplete; col++) {
                const cell = this.userState[row][col];
                const expectedLetter = this.puzzleData.solution[row][col];

                if (cell != '.' && cell != '-' && expectedLetter != '.' && cell != expectedLetter) {
                    assumedComplete = false;
                }
            }
        }

        this.isComplete = assumedComplete;
        if (this.isComplete) {
            this.showCompleted();
        }
    }

    setCell(cell, char, revealed) {
        const { row, col } = this.getRowCol(cell);

        // Replace the current value
        this.userState[row][col] = char;
        cell.dataset.value = char;
        cell.innerText = char;
        if (revealed) {
            cell.dataset.revealed = 'true';
            cell.classList.add('revealed-cell');
        }

        if (!revealed && this.autoCheck) {
            this.validateCell(cell, row, col);
        }

        this.onUpdatedBoard();
    }

    handleCellInput(cell, char) {
        console.log(cell);
        let { row, col } = this.getRowCol(cell);
        console.log(row);
        console.log(col);

        // Delete?
        if (char == '') {
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
        } else if (/^[A-Z]$/.test(char)) {
            // Only process alphabetic characters

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
                cell = this.currentCell;
            }

            this.setCell(cell, char, false);

            // Move to next cell
            this.moveToNextCell(row, col);
        }

        this.updateCurrentClue(row, col);
        this.pubSubSendInput(row, col, char, false);
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
            const { row, col } = this.getRowCol(this.currentCell);
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
        const { row, col } = this.getRowCol(input);

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
                //input.dataset.value = char;
                //input.dataset.revealed = "true";
                //input.innerText = char;
                //this.userState[row][col] = char;
                //input.classList.add('revealed-cell');

                this.setCell(input, char, true);
                this.pubSubSendInput(row, col, char, true);
            }
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

        this.saveGameState();
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

    isClueSolved(clue) {
        const cells = clue.cells;
        for (let i = 0; i < cells.length; ++i) {
            const row = parseInt(cells[i] / this.puzzleData.width, 10),
                col = cells[i] % this.puzzleData.width,
                userCell = this.userState[row][col],
                solvedCell = this.puzzleData.solution[row][col];
            if (userCell != solvedCell) return false;
        }

        return true;
    }

    loadAdjacentClue(step) {
        if (this.currentCell) {
            const { row, col } = this.getRowCol(this.currentCell);

            const across = this.puzzleData.cluesFlat.across,
                down = this.puzzleData.cluesFlat.down,
                clueMapping = this.puzzleData.cluesGrid[row][col];
            //let curClueIdx = Math.max(clueMapping[0], clueMapping[1]);
            //const numClues = Object.keys(across).length + Object.keys(down).length;

            let listsByDirection = [];
            let curClueKey = 0;
            if (this.direction == 'across') {
                listsByDirection = [{ direction: 'across', list: across }, { direction: 'down', list: down }];
                curClueKey = clueMapping[0];
            } else {
                listsByDirection = [{ direction: 'down', list: down }, { direction: 'across', list: across }];
                curClueKey = clueMapping[1];
            }

            for (let dK in listsByDirection) {
                const clues = listsByDirection[dK],
                    direction = clues.direction,
                    list = clues.list;

                const listByKeys = Object.keys(list).map((n) => parseInt(n));
                let curClueIdx = listByKeys.length - 1; // assume last
                for (let i = 0; i < listByKeys.length - 1; ++i) {
                    if (listByKeys[i] >= curClueKey && listByKeys[i+1] > curClueKey) {
                        curClueIdx = i;
                        break;
                    }
                }

                const lastKey = listByKeys[listByKeys.length - 1];
                for (let i = 0; i < listByKeys.length; ++i) {
                    curClueIdx += step;
                    if (curClueIdx >= listByKeys.length) curClueIdx = 0;
                    if (curClueIdx < 0) curClueIdx = listByKeys.length - 1;
                    let curClueKey = listByKeys[curClueIdx];
                    const clue = list[curClueKey];
                    if (this.isClueSolved(clue)) continue;
                    const div = document.getElementById(`clue-${direction}-${curClueKey}`);
                    this.handleClueClick(direction, clue.cells[0], div);
                    return;
                }
            }
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
                               'current-word');
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
            const { row, col } = this.getRowCol(this.currentCell);
            this.highlightCurrentWord(row, col);
        }
    }

    highlightCurrentWord(row, col) {
        // Clear previous current word highlighting
        const cells = document.querySelectorAll('.puzzle-cell');
        cells.forEach(cell => {
            cell.classList.remove('current-word');
        });

        const highlightClass = 'current-word';

        const highlightedCells = [];

        if (this.direction === 'across') {
            // Highlight current row
            let currentCol = col;
            while (currentCol >= 0 && this.getCellInput(row, currentCol)) {
                const cell = this.getCellInput(row, currentCol);
                cell.parentElement.classList.add(highlightClass);
                highlightedCells.push({ row: row, col: currentCol });
                currentCol--;
            }
            currentCol = col + 1;
            while (currentCol < this.puzzleData.width && 
                   this.getCellInput(row, currentCol)) {
                const cell = this.getCellInput(row, currentCol);
                cell.parentElement.classList.add(highlightClass);
                highlightedCells.push({ row: row, col: currentCol });
                currentCol++;
            }
        } else {
            // Highlight current column
            let currentRow = row;
            while (currentRow >= 0 && this.getCellInput(currentRow, col)) {
                const cell = this.getCellInput(currentRow, col);
                cell.parentElement.classList.add(highlightClass);
                highlightedCells.push({ row: currentRow, col: col });
                currentRow--;
            }
            currentRow = row + 1;
            while (currentRow < this.puzzleData.height && 
                   this.getCellInput(currentRow, col)) {
                const cell = this.getCellInput(currentRow, col);
                cell.parentElement.classList.add(highlightClass);
                highlightedCells.push({ row: currentRow, col: col });
                currentRow++;
            }
        }

        this.pubSubSendSelected(highlightedCells);
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

    findClueDiv(direction, number) {
        return document.querySelector(`#${direction}Clues .clue-item[data-number="${number}"]`);
    }
}

