const child_process = require('child_process');
const util = require('util');
const mysql = require('mysql');
const should = require('should');

let dbPassword = child_process.execSync('secrets.sh dreamhost-db', { encoding: 'utf8' }).trim();
let connection = null;
let dbQuery = null;

function Connect() {
    connection = mysql.createConnection({
        host: 'mysql.jbud.me',
        user: 'jbudone',
        password: dbPassword,
        database: 'jbud_crossword'
    });

    connection.connect();
    dbQuery = util.promisify(connection.query).bind(connection);
}

function Disconnect() {
    connection.end();
    connection = null;
    dbQuery = null;
}



//connection.query('SHOW TABLES', function(err, res, fields) {
//    if (err) throw err;
//    console.log(res);
//});



// FIXME:
//  - select puzzles list; add/update to list
//  - get puzzle
//  - add/update puzzle
//  - add puzzle to puzzles
//  - add/update puzzle_user_save

class PuzzlesListItem {
    constructor({ puzzleId, editor, author, date } = {}) {
        this.puzzleId = puzzleId || null;
        this.editor = editor || "";
        this.author = author || "";
        this.date = date || null;

        should(this.puzzleId).be.above(0);
        should(this.editor).be.type('string');
        should(this.author).be.type('string');
    }
}

class PuzzleDataItem {
    constructor({ puzzleId, data } = {}) {
        this.puzzleId = puzzleId || null;
        this.data = data || null;

        should(this.puzzleId).be.above(0);
        should(this.data).be.type('string');
    }
}

async function PuzzlesList(addOrUpdateData) {
    Connect();
    let res;
    if (!addOrUpdateData) {
        res = await dbQuery('SELECT * FROM `puzzleList`');
    } else {
        should(addOrUpdateData).be.an.instanceOf(PuzzlesListItem);
        const upsert = {
            puzzleId: addOrUpdateData.puzzleId,
            editor: addOrUpdateData.editor,
            author: addOrUpdateData.author,

            ...(addOrUpdateData.date && { date: addOrUpdateData.date })
        };

        res = await dbQuery('REPLACE INTO `puzzleList` SET ?', upsert);
    }
    Disconnect();
    return res;
};

async function PuzzleData(puzzleId, addOrUpdateData) {
    Connect();
    if (!addOrUpdateData) {
        var res = await dbQuery('SELECT * FROM `puzzles` WHERE `puzzleId` = ?', [puzzleId]);
        console.log(res);
    } else {
        should(addOrUpdateData).be.an.instanceOf(PuzzleDataItem);
        const upsert = {
            puzzleId: addOrUpdateData.puzzleId,
            data: addOrUpdateData.data
        };

        //var res = await dbQuery('REPLACE INTO `puzzles` SET ? WHERE `puzzleId` = ?', upsert, puzzleId);
        //var res = await dbQuery('INSERT INTO `puzzles` (puzzleId, data) VALUES (?) ON DUPLICATE KEY UPDATE data=VALUES(data)', [upsert]);
        //var res = await dbQuery('REPLACE INTO `puzzles` SET ?', upsert);
        var res = await dbQuery('INSERT INTO `puzzles` (puzzleId, data) VALUES (?) ON DUPLICATE KEY UPDATE data=VALUES(data)', [[upsert.puzzleId, upsert.data]]);
        //connection.query('INSERT INTO `puzzles` (puzzleId, data) VALUES (?)', [[upsert.puzzleId, upsert.data]], function(err, res, fields) {
        console.log(res);
    }
    Disconnect();
};

async function Main() {
    const puzzle = new PuzzleDataItem({ puzzleId: 1, data: "{\"taco\":\"beef\"}" });
    await PuzzleData(puzzle.puzzleId, puzzle);
    await PuzzlesList(new PuzzlesListItem({ puzzleId: 1 }));
};

//Main();

module.exports = {
    PuzzlesListItem, PuzzleDataItem,
    PuzzlesList, PuzzleData
};
