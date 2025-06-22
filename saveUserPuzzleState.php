<?php
    include('controller.php');

    $userId = intval($_POST['userId']);
    $puzzleId = intval($_POST['puzzleId']);
    $state = $_POST['state'];
    $completed = $_POST['completed'];

    saveUserState($userId, $puzzleId, $state, $completed);
