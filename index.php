<!DOCTYPE html>
<!--
 TODO
  - localStorage of crossword + timestamp created + timestamp touched;  request puzzle from server if local.created < server.created (puz updated); request user save state (and then replace w/ local local storage if needed)
  - automate processing and uploading puzzles 
  - mysql key for users: client, downloadpuz
  - crossword json version: migrate up to convert the json from earlier version to later version: eg. change  `clues: { original: "nyt", revised: "chatgpt" }` to `clues: { original: "nyt", revised: "chatgpt", revisedEasyVersion: "" }
  - puzzle list: from server-  we store lzcompressed, we can pass that and decompress on client side rather than server side
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
</head>
<body>
    <input type="password" id="hiddenInput" maxlength="1" style="opacity: 0; position: fixed; bottom: 0px; left: 0px;" />
    
    <div id="puzzleInfo">
        <h2 id="puzzleTitle"></h2>
        <p id="puzzleAuthor"></p>
        <p id="puzzleDate"></p>

        <div class="buttons">
            <button id="prevPuzzle" class="button">Previous Puzzle</button>
            <button id="aiToggle" class="button">AI Toggle</button>
            <button id="revealCells" class="button">Random Reveal</button>
            <button id="nextPuzzle" class="button">Next Puzzle</button>
        </div>

        <div id="browser-warning">Browser not supported. Only built and tested for Firefox or Chrome.</div>
    </div>

    <div id="puzzle-container">
        <div id="puzzleGrid"></div>
        <div id="clue-pos"></div>
        <div id="current-clue-display" class="ai-mode">
            <div id="clue-left">👈</div>
            <div id="clue-text"></div>
            <div id="clue-right">👉</div>
        </div>
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
    <script src="crossword.js?nocache=<?php echo time(); ?>"></script>
    <script src="main.js"></script>

    <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
    <script>eruda.init();</script>
</body>
</html>
