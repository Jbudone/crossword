<?php
    include('controller.php');
    $userId = 1;
    if (isset($_GET['userId'])) {
        $userId = intval($_GET['userId']);
    }

    echo getAllPuzzles($userId);
