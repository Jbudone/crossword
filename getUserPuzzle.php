<?php
    include('controller.php');

    $puzzleId = intval($_GET['puzzleId']);

    echo getPuzzle($puzzleId);
