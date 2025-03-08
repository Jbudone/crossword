<?php
function getPuzzle($puzzleid) {
    $inputJson = json_encode(['puzzleid' => $puzzleid]);
    $escapedJson = escapeshellarg($inputJson);

    $command = "node controller.js $escapedJson";
    $response = shell_exec($command);
    //$response = json_decode($outputJson, true);

    return $response;
    //header('Content-Type: application/json');
    //return json_encode($response);
}

function getAllPuzzles() {
    $f = file_get_contents('puzzles.json');
    return $f;
}
