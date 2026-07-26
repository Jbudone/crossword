<!DOCTYPE html>
<!--
TODO:
  - login/logout; session for crossword
  - click day to go to that crossword
  - bottom: current day's crossword; last in-progress crossword with progress bar of % complete
-->
<?php
include('controller.php');
?>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="A basic HTML template">
    <meta name="author" content="Your Name">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300..700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,100..900;1,100..900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@100..900&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&amp;display=swap" rel="stylesheet">

    <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png">

    <title>Crossword</title>
    <link rel="stylesheet" href="calendar.css?nocache=<?php echo time(); ?>">
</head>
<body>
    <div id="calendar">
        <div id="calendar-header">
            <div id="calendar-header-current"></div>
            <div id="calendar-header-nav">
                <button id="calendar-header-left" class="calendar-nav-btn" aria-label="Previous month">&#10094;</button>
                <button id="calendar-header-right" class="calendar-nav-btn calendar-nav-btn-next" aria-label="Next month">&#10095;</button>
            </div>
        </div>

        <a href="#" id="calendar-resume" class="calendar-resume" style="display: none;">
            <div class="resume-play-icon">&#9654;</div>
            <div class="resume-text">
                <div class="resume-label">Continue today's puzzle</div>
                <div class="resume-title">NYT Crossword</div>
            </div>
            <div class="resume-button">Resume</div>
        </a>

        <div id="calendar-dow">
            <div class="calendar-dayofweek">S</div>
            <div class="calendar-dayofweek">M</div>
            <div class="calendar-dayofweek">T</div>
            <div class="calendar-dayofweek">W</div>
            <div class="calendar-dayofweek">T</div>
            <div class="calendar-dayofweek">F</div>
            <div class="calendar-dayofweek">S</div>
        </div>

        <div id="calendar-grid"></div>

        <div id="calendar-legend">
            <div class="legend-item"><span class="legend-dot legend-done"></span>Done</div>
            <div class="legend-item"><span class="legend-dot legend-inprogress"></span>In progress</div>
            <div class="legend-item"><span class="legend-dot legend-nopuzzle"></span>No puzzle</div>
        </div>
    </div>

    <script src="calendar.js?nocache=<?php echo time(); ?>"></script>
</body>
</html>
