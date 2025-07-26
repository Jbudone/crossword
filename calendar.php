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
    <link rel="stylesheet" href="calendar.css">
</head>
<body>
    <div id="calendar">
        <div id="calendar-header">
            <div id="calendar-header-left" class="calendar-header-child"> ◀ </div>
            <div id="calendar-header-current" class="calendar-header-child"> </div>
            <div id="calendar-header-right" class="calendar-header-child"> ▶ </div>
        </div>
        <div id="calendar-grid">
            <div class="calendar-dayofweek">SUN</div>
            <div class="calendar-dayofweek">MON</div>
            <div class="calendar-dayofweek">TUE</div>
            <div class="calendar-dayofweek">WED</div>
            <div class="calendar-dayofweek">THU</div>
            <div class="calendar-dayofweek">FRI</div>
            <div class="calendar-dayofweek">SAT</div>
        </div>
    </div>

    <script src="calendar.js?nocache=<?php echo time(); ?>"></script>
</body>
</html>
