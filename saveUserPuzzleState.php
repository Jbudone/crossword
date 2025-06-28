<?php
    include('controller.php');

    $userId = intval($_POST['userId']);
    $puzzleId = intval($_POST['puzzleId']);
    $state = $_POST['state'];
    $completed = intval($_POST['completed']);

    saveUserState($userId, $puzzleId, $state, $completed);
