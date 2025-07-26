<?php
    include('controller.php');

    $userId = 1;
    $puzzleId = -1;
    if (isset($_GET['puzzleId'])) {
        $puzzleId = intval($_GET['puzzleId']);
    }

    echo json_encode(getUserPuzzle($puzzleId, $userId));
