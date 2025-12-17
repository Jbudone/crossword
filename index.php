<!DOCTYPE html>
<!--
 TODO
  - localStorage of crossword + timestamp created + timestamp touched;  request puzzle from server if local.created < server.created (puz updated); request user save state (and then replace w/ local local storage if needed)
        - crossword: on load sync with server, on change sync with server, websocket (update from user, websocket push to clients on same user), apple clue position
    - checkbox: sync puzzle -- longpolling to monitor changes; changedByClientUuid   (in case changed by same user but different client)

  - automate processing and uploading puzzles 
  - mysql key for users: client, downloadpuz
  - crossword json version: migrate up to convert the json from earlier version to later version: eg. change  `clues: { original: "nyt", revised: "chatgpt" }` to `clues: { original: "nyt", revised: "chatgpt", revisedEasyVersion: "" }
  - puzzle list: from server-  we store lzcompressed, we can pass that and decompress on client side rather than server side
  - shared board: update -> store and send previous/new timestamp -> server compares against last stored timestamp -> if different then deny update and send to client -> client updates board and redoes move (if not taken) -> send update -> if denied again then refresh page
  - puzzle list: cache in localStorage -> fetch ajax -> compare against localStorage -> if changed then update localStorage and reload(?); only fetch puzzles within a specified range on ajax
  - puzzle sql: store originalData + processedData separately; also minimize processedData size (eg. state unnecessary)
  - php config to disable cache or turn back on (for when we're in development or not)
  - fit board height to mobile screen, including (smaller) clue display -- ie. larger boards overflow
  - clue text could be too large, need to scroll down to see the rest? maybe remove fixed position and instead have it directly under the board
  - animation when ending?
  - calendar page to show which days you completed or are partial completed  (can extend this into daily trivia/etc.)


  - dreamhost security errors + .git folder

  - check pricing for prompts (how much per crossword?) -- can we merge requests to spend less tokens? or have saved prompts? what about Gemini?

  - virtual keyboard lib: https://furcan.github.io/KioskBoard/
  - support for more than NYT
-->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">

    <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png">

    <title>Crossword</title>
    <link rel="stylesheet" href="styles.css?nocache=<?php echo time(); ?>">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300..700&display=swap" rel="stylesheet">
<!--
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,100..900;1,100..900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@100..900&amp;display=swap" rel="stylesheet">
-->
    <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&amp;display=swap" rel="stylesheet">

    <script src="https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js" integrity="sha512-qtX0GLM3qX8rxJN1gyDfcnMFFrKvixfoEOwbBib9VafR5vbChV5LeE5wSI/x+IlCkTY5ZFddFDCCfaVJJNnuKQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

    <script src="https://cdn.ably.com/lib/ably.min-2.js"></script>

    <script src="https://cdn.jsdelivr.net/npm/@tsparticles/confetti@3.0.3/tsparticles.confetti.bundle.min.js"></script>

<!--
    <script type="module">
        // Importing tsParticles and loadAll from CDN
        import { tsParticles } from "https://cdn.jsdelivr.net/npm/@tsparticles/engine@3.0.3/+esm";
        import { loadAll } from "https://cdn.jsdelivr.net/npm/@tsparticles/all@3.0.3/+esm";

        window['loadAll'] = loadAll;
        window['tsParticles'] = tsParticles;
    </script>
-->
</head>
<body>
    <input type="password" id="hiddenInput" maxlength="1" style="opacity: 0; position: fixed; bottom: 0px; left: 0px;" />
    
    <div id="puzzleInfo">
        <div class="puzzleDetails">
            <h2 id="puzzleTitle"></h2>
            <p id="puzzleAuthor"></p>
            <p id="puzzleDate"></p>
        </div>

        <div class="buttons">
            <button id="prevPuzzle" class="button"> ◀ </button>
            <button id="aiToggle" class="button">  </button>
            <a href='#' id='calendarView' class="button">
                <div class="calendar-grid-date">
                    <div class="date-header">
                        <div class="date-header-left">📍</div>
                        <div class="date-header-month"></div>
                        <div class="date-header-right">📍</div>
                    </div>
                    <div class="date-day"></div>
                </div>
            </a>
            <button id="revealCells" class="button"> R </button>
            <button id="nextPuzzle" class="button"> ▶ </button>
        </div>

        <div id="browser-warning">Browser not supported. Only built and tested for Firefox or Chrome.</div>
    </div>

    <div id="puzzle-container">
        <div id="puzzleGrid"></div>
<!--
        <div id="clue-pos"></div>
-->
        <div id="current-clue-explanation"></div>
        <div class="clue-lists">
            <div class="clue-section">
                <h3>Across</h3>
                <div id="acrossClues"></div>
            </div>
            <div class="clue-section">
                <h3>Down</h3>
                <div id="downClues"></div>
            </div>
        </div>
    </div>

    <div id="puzzle-foot" class="keyboard-active">
        <div id="current-clue-display" class="ai-mode">
            <div id="clue-left"><a href='#'>👈</a></div>
            <div id="clue-text"></div>
            <div id="clue-right"><a href='#'>👉</a></div>
        </div>
        <div id="keyboard">
            <div class="keyboard-row">
    <span class="keyboard-key" data="Q">Q</span>
    <span class="keyboard-key" data="W">W</span>
    <span class="keyboard-key" data="E">E</span>
    <span class="keyboard-key" data="R">R</span>
    <span class="keyboard-key" data="T">T</span>
    <span class="keyboard-key" data="Y">Y</span>
    <span class="keyboard-key" data="U">U</span>
    <span class="keyboard-key" data="I">I</span>
    <span class="keyboard-key" data="O">O</span>
    <span class="keyboard-key" data="P">P</span>
            </div>
            <div class="keyboard-row">
    <span class="keyboard-key" data="A">A</span>
    <span class="keyboard-key" data="S">S</span>
    <span class="keyboard-key" data="D">D</span>
    <span class="keyboard-key" data="F">F</span>
    <span class="keyboard-key" data="G">G</span>
    <span class="keyboard-key" data="H">H</span>
    <span class="keyboard-key" data="J">J</span>
    <span class="keyboard-key" data="K">K</span>
    <span class="keyboard-key" data="L">L</span>
            </div>
            <div class="keyboard-row">
    <span class="keyboard-key" data="Z">Z</span>
    <span class="keyboard-key" data="X">X</span>
    <span class="keyboard-key" data="C">C</span>
    <span class="keyboard-key" data="V">V</span>
    <span class="keyboard-key" data="B">B</span>
    <span class="keyboard-key" data="N">N</span>
    <span class="keyboard-key" data="M">M</span>

    <span class="keyboard-key" data="Backspace">⤶</span>
            </div>
        </div>
    </div>

    <div id="confetti" style="z-index: 5; position: absolute;"></div>

    <script src="crossword.js?nocache=<?php echo time(); ?>"></script>
    <script src="main.js"></script>

<!--
    <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
    <script>eruda.init();</script>
-->
</body>
</html>
