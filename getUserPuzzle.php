<?php
    include('controller.php');

    $puzzleId = -1;
    if ($_GET['puzzleId']) {
        $puzzleId = intval($_GET['puzzleId']);
    }

    echo getPuzzle($puzzleId);
