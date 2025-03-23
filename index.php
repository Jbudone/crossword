<!DOCTYPE html>
<!--
 TODO
  - database: store puzzles + puzzles.json in database, periodically save crossword progress per-account to server (in case we lose localStorage)
        {"author":"Peter Gorman","editor":"Will Shortz","format_type":"Normal","print_date":"2025-02-20","publish_type":"Daily","puzzle_id":22562,"title":"","version":0,"percent_filled":0,"solved":false,"star":null}
        PUZZLES: [author, editor, date, puzzleId]
        PUZZLE: [puzzleId, BLOB]
        USER: [userId, userName]
        USER_PUZZLE_SAVE: [userId, puzzleId, BLOB]

        - save server gamestate less frequently
        - timestamp on save state; pick newer one
        - automate processing and uploading puzzles 
  - button to reveal random cells
  - fit board height to mobile screen, including (smaller) clue display -- ie. larger boards overflow
  - clue text could be too large, need to scroll down to see the rest? maybe remove fixed position and instead have it directly under the board
  - animation when ending?
  - calendar page to show which days you completed or are partial completed  (can extend this into daily trivia/etc.)
  - press/hold to unveil non-ai clue (let go brings it back to AI)


  - php config to disable cache or turn back on (for when we're in development or not)
  - cache sql results? (since it rarely changes)
  - compress php data sending down (since its massive but all json text)
  - dreamhost security errors + .git folder

  - store openai key and nyt key in php config; pass along -- shouldn't matter if we perform offline
  - check pricing for prompts (how much per crossword?) -- can we merge requests to spend less tokens? or have saved prompts?
  - fix dreamhost nodejs specification (wrong nodejs) -- shouldn't matter if we don't use ai in client

  - virtual keyboard lib: https://furcan.github.io/KioskBoard/
  - support for more than NYT
-->
<?php
include('controller.php');
?>
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
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,100..900;1,100..900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@100..900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&amp;display=swap" rel="stylesheet">
</head>
<body>
<script>
var allPuzzles = <?php echo getAllPuzzles(); ?>;
var puzzleData = <?php
$puzzleid = 22492;
if (isset($_GET['puzzleid'])) {
    $puzzleid = intval($_GET['puzzleid']);
}

echo getPuzzle($puzzleid);
?>;
<?php
$userId = 1;
$userSavedState = getUserSaveState((int)$userId, (int)$puzzleid);
if ($userSavedState) {
    ?>var userSavedState = <?php echo $userSavedState; ?>;<?php
}
?>
</script>
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
    <script src="main.js?nocache=<?php echo time(); ?>"></script>

    <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
    <script>eruda.init();</script>
</body>
</html>
