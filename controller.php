<?php

// FIXME: we cache big query results to separate table using npm LZString, but to decompress we need 1:1 between php and nodejs which isn't the case. So instead we exec nodejs db for puzzles list

function openConnection() {
    $command = "bash secrets.sh";
    $password = trim(shell_exec($command . " DB_PASSWORD"));
    $host = trim(shell_exec($command . " DB_HOST"));
    $username = trim(shell_exec($command . " DB_USER"));
    $databaseName = trim(shell_exec($command . " DB_DATABASENAME"));
    $connection = new mysqli($host, $username, $password, $databaseName);
    return $connection;
}

function getUserPuzzle($puzzleid, $userId, $fetchPuzData) {
    $connection = openConnection();

    // FIXME: want to include $userId but they may not have a save state, in which case we'd want to use null
    if ($fetchPuzData) {
        // puzData and saveState
        $statement = $connection->prepare('SELECT `data`, userPuzzleSaves.saveData, userPuzzleSaves.completed, userPuzzleSaves.updated FROM `puzzles` LEFT JOIN `userPuzzleSaves` ON puzzles.puzzleId = userPuzzleSaves.puzzleId WHERE puzzles.puzzleId = ?');
    } else {
        // saveState only
        $statement = $connection->prepare('SELECT userPuzzleSaves.saveData, userPuzzleSaves.completed, userPuzzleSaves.updated FROM `puzzles` LEFT JOIN `userPuzzleSaves` ON puzzles.puzzleId = userPuzzleSaves.puzzleId WHERE puzzles.puzzleId = ?');
    }
    $statement->bind_param("i", $puzzleid);

    $statement->execute();
    $result = $statement->get_result();
    $row = $result->fetch_assoc();
    $statement->close();
    $connection->close();

    return $row;
}

function getPuzzle($puzzleid) {
    $connection = openConnection();
    if ($puzzleid != -1) {
        $statement = $connection->prepare('SELECT `data` FROM `puzzles` WHERE puzzleId = ?');
        $statement->bind_param("i", $puzzleid);
    } else {
        $statement = $connection->prepare('SELECT * FROM `puzzles` ORDER BY `puzzleId` DESC LIMIT 1');
    }

    $statement->execute();
    $result = $statement->get_result();
    $row = $result->fetch_assoc();
    $statement->close();
    $connection->close();
    return $row['data'];
}

function getAllPuzzles($userId) {

    // BIG QUERY: nodejs
    $data = NULL;
    $nodeResponse = shell_exec('node --eval \'(async()=>console.log(JSON.stringify(await require("./db").PuzzlesList(false, true, '. $userId .'))))()\' 2>&1');
    if ($nodeResponse) {
        $nodeJSON = json_decode($nodeResponse);
        if ($nodeJSON) {
            $data = $nodeJSON;
        }
    }

    /*
    if (!$data) {
        $connection = openConnection();
        $result = $connection->query('SELECT * FROM `puzzleList`');
        $data = [];
        if ($result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
        }
        $connection->close();
    }
     */

    $jsonResponse = json_encode($data);
    return $jsonResponse;
}

function saveUserState($userId, $puzzleId, $state, $completed) {
    $connection = openConnection();
    $statement = $connection->prepare('INSERT INTO `userPuzzleSaves` (userId, puzzleId, saveData, completed) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `saveData` = VALUES(saveData), `completed` = VALUES(completed)');
    $statement->bind_param("iisi", $userId, $puzzleId, $state, $completed);
    $statement->execute();
    $statement->close();
    $connection->close();
}

function getUserSaveState($userId, $puzzleId) {
    $connection = openConnection();
    $statement = $connection->prepare('SELECT `saveData` FROM `userPuzzleSaves` WHERE puzzleId = ? AND userId = ?');
    $statement->bind_param("ii", $puzzleId, $userId);
    $statement->execute();
    $result = $statement->get_result();
    $saveData = null;
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $saveData = $row['saveData'];
    }
    $statement->close();
    $connection->close();
    return $saveData;
}
