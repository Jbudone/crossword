<?php
    include('controller.php');

    $userId = 1;
    $puzzleId = -1;
    $fetchPuzData = True;
    if (isset($_GET['puzzleId'])) {
        $puzzleId = intval($_GET['puzzleId']);
    }

    if (isset($_GET['saveStateOnly'])) {
        $fetchPuzData = False;
    }

    echo json_encode(getUserPuzzle($puzzleId, $userId, $fetchPuzData));
