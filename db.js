const child_process = require('child_process');
const util = require('util');
const mysql = require('mysql2/promise');
const should = require('should');
const LZString = require('lz-string');

let dbPassword = child_process.execSync('secrets.sh dreamhost-db', { encoding: 'utf8' }).trim();
let connection = null;
let dbQuery = null;

async function Connect() {
    if (connection) {
        throw new Error("Reconnecting when we already have a connection");
    }

    connection = await mysql.createConnection({
        host: 'mysql.jbud.me',
        user: 'jbudone',
        password: dbPassword,
        database: 'jbud_crossword'
    });

    if (!connection) {
        throw new Error("Failed to make connection");
    }

    // dbQuery = util.promisify(connection.query).bind(connection);
    dbQuery = async function(...args) {
        [results] = await connection.query(...args);
        return results;
    };
}

async function Disconnect() {
    if (!connection) {
        throw new Error("Already disconnected");
    }

    await connection.end();
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
    constructor({ puzzleId, data, sourceData } = {}) {
        this.puzzleId = puzzleId || null;
        this.data = data || null;
        this.sourceData = sourceData || null;

        should(this.puzzleId).be.above(0);
        should(this.data).be.type('string');
        should(this.sourceData).be.type('string');
    }
}

async function PuzzleListBatchAddEmptyPuzzles(addData) {
    await Connect();

    let insertListToPuzzles = [];
    let insertListToPuzzleList = [];

    for (let i = 0; i < addData.length; ++i) {
        let item = addData[i];
        insertListToPuzzles.push([item.puzzleId]);
        insertListToPuzzleList.push(

            //{puzzleId: item.puzzleId, editor: item.editor, author: item.author, date: item.date }
            [item.puzzleId, item.editor, item.author, item.date]
        );
    }

    console.log(addData);

    let success = false;
    await connection.beginTransaction();
    try {
        let res = await dbQuery('INSERT INTO `puzzles` (puzzleId) VALUES ?', [insertListToPuzzles]);
        if (!res) {
            throw "Failed to insert to puzzles";
        }


        res = await dbQuery('INSERT INTO `puzzleList` (puzzleId, editor, author, date) VALUES ?', [insertListToPuzzleList]);
        if (!res) {
            throw "Failed to insert to puzzleList";
        }

        await connection.commit();
        success = true;
        InvalidateCacheQuery(CACHE_PUZZLESQUERY_NAME);
    } catch(e) {
        console.log(e);
        await connection.rollback();
    }

    await Disconnect();
    return success;
};

async function SetPuzzleSource(puzzleId, source) {
    await Connect();

    update = [source, puzzleId];
    let result = await dbQuery('UPDATE `puzzles` SET `sourceData` = ? WHERE `puzzleId` = ? LIMIT 1', update);

    InvalidateCacheQuery(CACHE_PUZZLESQUERY_NAME);

    await Disconnect();
    return result && result.changedRows == 1;
};

async function SetPuzzleData(puzzleId, data) {
    await Connect();

    update = [data, puzzleId];
    let result = await dbQuery('UPDATE `puzzles` SET `data` = ? WHERE `puzzleId` = ? LIMIT 1', update);

    InvalidateCacheQuery(CACHE_PUZZLESQUERY_NAME);

    await Disconnect();
    return result && result.changedRows == 1;
};

async function InvalidateCacheQuery(name) {
    if (name == CACHE_PUZZLESQUERY_NAME) {
        await dbQuery('DELETE FROM `bigquery_mv` WHERE name = ? LIMIT 1', name);
    }
}

async function CacheQuery(name, value) {
    if (name == CACHE_PUZZLESQUERY_NAME) {
        const jsonStr = JSON.stringify(value);
        const cacheValue = LZString.compressToBase64(jsonStr);
        await dbQuery('INSERT INTO `bigquery_mv` (name, value) VALUES (?) ON DUPLICATE KEY UPDATE value=VALUES(value)', [[name, cacheValue]]);
    }
}

async function GetCachedQuery(name) {
    if (name == CACHE_PUZZLESQUERY_NAME) {
        const res = await dbQuery('SELECT `value` FROM `bigquery_mv` WHERE name = ? LIMIT 1', name);
        if (!res || res.length == 0) return false;

        const cache = res[0].value;
        const decompressedVal = LZString.decompressFromBase64(cache);
        const value = JSON.parse(decompressedVal);
        if (!value || value.length == 0) return false;

        return value;
    }
}

const CACHE_PUZZLESQUERY_NAME = 'PuzzleList';
const PUZZLESQUERY = 'SELECT puzzleList.*, CASE WHEN puzzles.data IS NOT NULL THEN 1 ELSE 0 END AS parsedData, CASE WHEN puzzles.sourceData IS NOT NULL THEN 1 ELSE 0 END AS sourceData FROM puzzleList JOIN puzzles ON puzzleList.puzzleId=puzzles.puzzleId';

async function PuzzlesList(addOrUpdateData, useCache) {
    await Connect();
    let res = null;
    if (!addOrUpdateData) {

        if (useCache) {
            res = await GetCachedQuery(CACHE_PUZZLESQUERY_NAME);
            if (!res) {
                await InvalidateCacheQuery(CACHE_PUZZLESQUERY_NAME);
            }
        }

        if (!res) {
            res = await dbQuery(PUZZLESQUERY);
            if (res && res.length > 0) {
                await CacheQuery(CACHE_PUZZLESQUERY_NAME, res);
            }
        }
    } else {
        should(addOrUpdateData).be.an.instanceOf(PuzzlesListItem);
        const upsert = {
            puzzleId: addOrUpdateData.puzzleId,
            editor: addOrUpdateData.editor,
            author: addOrUpdateData.author,

            ...(addOrUpdateData.date && { date: addOrUpdateData.date })
        };

        res = await dbQuery('REPLACE INTO `puzzleList` SET ?', upsert);
        await InvalidateCacheQuery(CACHE_PUZZLESQUERY_NAME);
    }
    await Disconnect();

    return res;
};

async function PuzzleData(puzzleId, addOrUpdateData) {
    await Connect();
    if (!addOrUpdateData) {
        var res = await dbQuery('SELECT * FROM `puzzles` WHERE `puzzleId` = ?', [puzzleId]);
    } else {
        should(addOrUpdateData).be.an.instanceOf(PuzzleDataItem);
        const upsert = {
            puzzleId: addOrUpdateData.puzzleId,
            data: addOrUpdateData.data,
            sourceData: addOrUpdateData.sourceData
        };

        //var res = await dbQuery('REPLACE INTO `puzzles` SET ? WHERE `puzzleId` = ?', upsert, puzzleId);
        //var res = await dbQuery('INSERT INTO `puzzles` (puzzleId, data) VALUES (?) ON DUPLICATE KEY UPDATE data=VALUES(data)', [upsert]);
        //var res = await dbQuery('REPLACE INTO `puzzles` SET ?', upsert);
        var res = await dbQuery('INSERT INTO `puzzles` (puzzleId, data, sourceData) VALUES (?) ON DUPLICATE KEY UPDATE data=VALUES(data)', [[upsert.puzzleId, upsert.data, upsert.sourceData]]);
        //connection.query('INSERT INTO `puzzles` (puzzleId, data) VALUES (?)', [[upsert.puzzleId, upsert.data]], function(err, res, fields) {
        InvalidateCacheQuery(CACHE_PUZZLESQUERY_NAME);
        console.log(res);
    }
    await Disconnect();
    return res;
};

async function Main() {
    const puzzle = new PuzzleDataItem({ puzzleId: 1, data: "{\"taco\":\"beef\"}", sourceData: "{\"taco\":\"beef\"}" });
    await PuzzleData(puzzle.puzzleId, puzzle);
    await PuzzlesList(new PuzzlesListItem({ puzzleId: 1 }));
};

//Main();

module.exports = {
    PuzzlesListItem, PuzzleDataItem,
    PuzzlesList, PuzzleData,
    PuzzleListBatchAddEmptyPuzzles,
    SetPuzzleSource, SetPuzzleData
};
