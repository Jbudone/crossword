// Get .puz
// curl 'https://www.nytimes.com/svc/crosswords/v6/puzzle/22555.json' --compressed -H 'Cookie: NYT-S=XXXXXXXXX'

// Puzzle list
// https://www.nytimes.com/svc/crosswords/v3/puzzles.json
// {"status":"OK","results":[{"author":"Rose Conlon","editor":"Will
// Shortz","format_type":"Normal","print_date":"2025-02-22","publish_type":"Daily","puzzle_id":22555,"title":"","version":0,"percent_filled":0,"solved":false,"star":null}, ...]}


const https = require("node:https");
const fs = require('fs');
const zlib = require('zlib');
const ai = require('./ai');
const puzParser = require('./puzzleParser_NYT');
const child_process = require('child_process');
const db = require('./db');
const LZString = require('lz-string');

const DraftLog = require('draftlog');
DraftLog(console);

let nytCookie = child_process.execSync('secrets.sh nyt-cookie', { encoding: 'utf8' }).trim();

let allPuzzlesMap = null;
let allPuzzles = [];
let allPuzzlesByDateMap = null;

const EARLIEST_FETCH_DATE = (new Date("2020-01-01"));
const LATEST_FETCH_DATE = (new Date(Date.now()));


const getDateFormatISO8601 = (date) => {
    return (new Date(date)).toJSON().substr(0, 10); // 2025-05-18
};

async function sleep(time) {
    return new Promise((resolve) => { setTimeout(resolve, time); });
};


async function handleRequests(requests) {

    // handle each request (get puzzles, get sources, parse) in order
    for (let i = 0; i < requests.length; ++i) {
        const request = requests[i];
        if (request instanceof RequestFetchPuzzlesList) {
            await request.handle();
        } else if (request instanceof RequestFetchPuzzles) {
            await request.handle();
        } else if (request instanceof RequestBuildPuzzles) {
            await request.handle();
        } else {
            throw new Error(`Unhandled request type: ${typeof request}`);
        }
    }

};

const REQUEST_OPTIONS_SAVETODB = 0b0001

const ONE_DAY = 1000 * 60 * 60 * 24;

class RequestFetchPuzzlesList {
    constructor({ startDate, endDate, options } = {}) {
        this.startDate = startDate || EARLIEST_FETCH_DATE;
        this.endDate = endDate || LATEST_FETCH_DATE;
        this.options = options || REQUEST_OPTIONS_SAVETODB;

        should(this.endDate).be.greaterThanOrEqual(this.startDate);
        should(this.endDate).be.lessThanOrEqual(LATEST_FETCH_DATE);
        should(this.startDate).be.greaterThanOrEqual(EARLIEST_FETCH_DATE);
    }

    async handle() {
        // https://www.nytimes.com/svc/crosswords/v3/puzzles.json?date_start=2025-02-01&date_end=2025-02-30
        console.log(this);

        // batch fetches by 2 weeks
        let batchedDates = [];
        const beginDate = this.startDate;
        let endDate = new Date(this.endDate);
        let startDate = new Date(this.endDate);
        while (true) {
            startDate.setDate(startDate.getDate() - 14);
            if (startDate < beginDate) {
                startDate = new Date(beginDate);
                const dateRange = endDate.valueOf() - startDate.valueOf();
                if (dateRange <= ONE_DAY) {
                    break;
                }
            }

            batchedDates.push({ startDate: new Date(startDate), endDate: new Date(endDate) });
            endDate = new Date(startDate);
        };

        console.log(batchedDates);
        console.log('Loaded Puzzles List');
        for (let i = 0; i < batchedDates.length; ++i) {
            const success = await this.handleDateBatch(batchedDates[i]);
            if (!success) {
                break;
            }

            await sleep(5000);
        }
    };

    async handleDateBatch(dateRange) {
        // Fetch list -> add to db -> wait -> repeat; on fail bail

        const results = await this.fetchPuzzlesForBatch(dateRange.startDate, dateRange.endDate);
        if (!results) {
            return false;
        }

        let resultsToAdd = [];
        for (let i = 0; i < results.length; ++i) {
            const result = results[i];
            // does result already exist?

            // author: 'Dylan Schiff',
            // editor: 'Will Shortz',
            // format_type: 'Normal',
            // print_date: '2025-05-25',
            // publish_type: 'Daily',
            // puzzle_id: 22781,
            // title: 'Travel Bug',
            // version: 0,
            // percent_filled: 0,
            // solved: false,
            // star: null

            const date = result.print_date;
            if (allPuzzlesByDateMap[date]) {
                continue;
            }

            resultsToAdd.push({
                puzzleId: result.puzzle_id,
                date: result.print_date,
                editor: result.editor,
                author: result.author,
                sourceData: 0,
                parsedData: 0
            });
            console.log(`New puzzle: ${date}`);
        }

        if (resultsToAdd.length == 0) {
            return true;
        }

        let success = await this.addToPuzzlesListDB(resultsToAdd);
        if (!success) {
            return false;
        }

        for (let i = 0; i < results.length; ++i) {
            let result = results[i];
            allPuzzlesMap[result.puzzle_id] = result;
            allPuzzlesByDateMap[result.print_date] = result;
        }

        return true;
    };

    async fetchPuzzlesForBatch(startDate, endDate) {

        const startDateURI = getDateFormatISO8601(startDate),
            endDateURI = getDateFormatISO8601(endDate);

        const uri = `https://www.nytimes.com/svc/crosswords/v3/puzzles.json?date_start=${startDateURI}&date_end=${endDateURI}`;
        const getPromise = new Promise((resolve) => {
            https.get(uri, function(res) {

                if (res.statusCode !== 200) {
                    console.error(`Failed on uri: ${uri}`);
                    res.resume();
                    process.exit(-1);
                    resolve(false);
                    return;
                }

                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(rawData);

                        if (parsedData.status !== 'OK') {
                            console.error('Bad status response!');
                            console.log(rawData);
                            console.error(`Failed on uri: ${uri}`);
                            process.exit(-1);
                            resolve(false);
                        } else {
                            resolve(parsedData.results);
                        }
                    } catch (e) {
                        console.error(e.message);
                        resolve(false);
                    }
                });
            }).on('error', (e) => {
                console.error(`Got error: ${e.message}`);
                resolve(false);
            });
        });

        return getPromise;
    };

    async addToPuzzlesListDB(results) {
        return await db.PuzzleListBatchAddEmptyPuzzles(results);
    };
}

const SLEEP_BETWEEN_PUZZLE_FETCHES = 5000;

class RequestFetchPuzzles {
    constructor({ puzzleIds } = {}) {
        this.puzzleIds = puzzleIds;

        should(this.puzzleIds.length).be.greaterThan(0);
    }

    async handle() {

        for (let i = 0; i < this.puzzleIds.length; ++i) {

            if (i != 0) {
                // wait before next
                await sleep(SLEEP_BETWEEN_PUZZLE_FETCHES);
            }

            // Fetch puzzle
            const puzzleId = this.puzzleIds[i];
            const puzzleIndexData = allPuzzlesMap[puzzleId];
            const puzzle = await this.handleSinglePuzzle(puzzleId);
            if (!puzzle) {
                return false;
            }

            // Compress
            const puzStr = JSON.stringify(puzzle);
            const puzCompressed = LZString.compressToBase64(puzStr);
            if (!puzCompressed) {
                return false;
            }

            // Add to db
            let success = await db.SetPuzzleSource(puzzleId, puzCompressed);
            if (!success) {
                return false;
            }

            const DOUBLE_CHECK = true;
            let confirmed = false;
            if (DOUBLE_CHECK) {
                let fetchPuzzleResults = await db.PuzzleData(puzzleId);
                if (!fetchPuzzleResults) {
                    console.log(`Could not fetch puzzle from db: ${puzzleId}`);
                    process.exit(-1);
                }

                const puzzleInDb = fetchPuzzleResults[0];

                let puzDataCompressed = puzzleInDb.sourceData.toString('utf8');
                let puzDataDecompressed = lzstring.decompressfrombase64(puzdatacompressed);
                let puzdatajson = json.parse(puzdatadecompressed);
                let puzdataid = puzdatajson.id;
                if (puzdataid != puzzleId) {
                    console.error("fetched wrong puzzle!");
                    console.log(puzdatajson);
                    process.exit(-1);
                }
                confirmed = true;
            }

            // update puzzleslist
            console.log(`added puzzle: ${puzzleId}  ${confirmed ? "(verified)" : ""}`);
            allpuzzlesmap[puzzleId].sourcedata = 1;
        }

        const totalpuzzles = object.values(allpuzzlesmap).length;
        const totalmissingsourcepuzzles = object.values(allpuzzlesmap).filter((p) => p.sourcedata === 0).length;
        console.log(`progress: added ${this.puzzleids.length}, ${totalpuzzles - totalmissingsourcepuzzles} / ${totalpuzzles}`);
    }

    async handleSinglePuzzle(puzzleId) {

        // curl 'https://www.nytimes.com/svc/crosswords/v6/puzzle/22555.json' --compressed -H 'Cookie: NYT-S=XXXXXXXXXX'
        const uri = `/svc/crosswords/v6/puzzle/${puzzleId}.json`;
        const options = {
            hostname: 'www.nytimes.com',
            port: 443,
            path: uri,
            method: 'GET',
            gzip: true,
            headers: {
                'Cookie': nytCookie,
                'Accept': '*/*', // Accept any content type
                'Accept-Encoding': 'gzip, deflate, br', // Handle compressed responses
                'User-Agent': 'curl/7.64.1', // Mimic a curl User-Agent
            },
        };

        const getPromise = new Promise((resolve) => {
            https.get(options, function(res) {
                if (res.statusCode !== 200) {
                    console.error(`Failed on uri: ${uri}`);
                    console.log(res);
                    res.resume();
                    process.exit(-1);
                    resolve(false);
                    return;
                }

                // Check the 'content-encoding' header to determine the compression type
                const encoding = res.headers['content-encoding'];
                if (encoding === 'gzip') {
                    res = res.pipe(zlib.createGunzip()); // Decompress gzip
                } else if (encoding === 'deflate') {
                    res = res.pipe(zlib.createInflate()); // Decompress deflate
                } else if (encoding === 'br') {
                    res = res.pipe(zlib.createBrotliDecompress()); // Decompress Brotli
                }

                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(rawData);
                        const parsedPuzzle = puzParser.parsePuzzle(jsonData);

                        resolve(parsedPuzzle);
                    } catch (e) {
                        console.error(e.message);
                        resolve(false);
                    }
                });
            }).on('error', (e) => {
                console.error(`Got error: ${e.message}`);
                resolve(false);
            });
        });

        return getPromise;
    }
}

const SLEEP_BETWEEN_PUZZLE_AIFILLS = 2000;

class RequestBuildPuzzles {
    constructor({ puzzleIds } = {}) {
        this.puzzleIds = puzzleIds;

        should(this.puzzleIds.length).be.greaterThan(0);

        this.consoleLogs = {
            buffers: [
                console.draft(""),
                console.draft(""),
                console.draft(""),
                console.draft(""),
                console.draft(""),
                console.draft(""),
                console.draft(""),
                console.draft(""),
                console.draft(""),
                console.draft(""),
                console.draft(""),
                console.draft(""),
            ],

            status: console.draft(""),
            progressPuzzle: console.draft(""),
            progressList: console.draft(""),

            bufferLogs: [],
        };
    }

    draftLog(log) {
        this.consoleLogs.bufferLogs.push(log.substr(0, 128).replaceAll('\n', '').replaceAll('\r', ''));
        if (this.consoleLogs.bufferLogs.length > this.consoleLogs.buffers.length) {
            this.consoleLogs.bufferLogs.splice(0, (this.consoleLogs.buffers.length - this.consoleLogs.bufferLogs.length + 1));
        }

        for (let i = this.consoleLogs.bufferLogs.length - 1, y = this.consoleLogs.buffers.length - 1; i >= 0 && y >= 0; --i, --y) {
            const log = this.consoleLogs.bufferLogs[i];
            const buffer = this.consoleLogs.buffers[y];
            buffer(log);
        }
    }

    progressBar(progress, total) {
        const perc = progress / total;
        const totPips = 50;
        const numPips = parseInt(perc * totPips);
        return '[' + '='.repeat(numPips) + ' '.repeat(totPips - numPips) + '] ' + progress + '/' + total;
    }

    progressPuzzle(progress, total, status) {
        const log = this.progressBar(progress, total) +  ' puzzle clues';
        this.consoleLogs.progressPuzzle(log);
        this.consoleLogs.status(status);
    }

    progressList(progress, total) {
        const log = this.progressBar(progress, total) +  ' puzzles';
        this.consoleLogs.progressList(log);
    }


    async handle() {

        this.progressList(0, this.puzzleIds.length);
        for (let i = 0; i < this.puzzleIds.length; ++i) {

            if (i != 0) {
                // wait before next
                await sleep(SLEEP_BETWEEN_PUZZLE_AIFILLS);
            }

            // Fetch puzzle
            const puzzleId = this.puzzleIds[i];
            const puzzleIndexData = allPuzzlesMap[puzzleId];
            const puzzleDate = getDateFormatISO8601(puzzleIndexData.date);
            const puzzle = await this.handleSinglePuzzle(puzzleId);
            if (!puzzle) {
                return false;
            }

            // Compress
            const puzStr = JSON.stringify(puzzle);
            const puzCompressed = LZString.compressToBase64(puzStr);
            if (!puzCompressed) {
                return false;
            }

            // Add to db
            let success = await db.SetPuzzleData(puzzleId, puzCompressed);
            if (!success) {
                return false;
            }

            const DOUBLE_CHECK = true;
            let confirmed = false;
            if (DOUBLE_CHECK) {
                let builtPuzzleResults = await db.PuzzleData(puzzleId);
                if (!builtPuzzleResults) {
                    console.log(`Could not fetch puzzle from db: ${puzzleId}`);
                    process.exit(-1);
                }

                const puzzleInDb = builtPuzzleResults[0];

                let puzDataCompressed = puzzleInDb.data.toString('utf8');
                let puzDataDecompressed = LZString.decompressFromBase64(puzDataCompressed);
                let puzDataJSON = JSON.parse(puzDataDecompressed);
                let puzDataID = puzDataJSON.id;
                if (puzDataID != puzzleId) {
                    console.error("BUILT WRONG PUZZLE!");
                    console.log(puzDataJSON);
                    process.exit(-1);
                }
                confirmed = true;
            }

            // Update puzzlesList
            console.log(`Built puzzle: ${puzzleId}  ${confirmed ? "(verified)" : ""} -- ${puzzleDate}`);
            allPuzzlesMap[puzzleId].parsedData = 1;

            this.progressList(i + 1, this.puzzleIds.length);
        }

        const totalPuzzles = Object.values(allPuzzlesMap).length;
        const totalMissingDataPuzzles = Object.values(allPuzzlesMap).filter((p) => p.parsedData === 0).length;
        console.log(`Progress: Built ${this.puzzleIds.length}, ${totalPuzzles - totalMissingDataPuzzles} / ${totalPuzzles}`);
    }

    async handleSinglePuzzle(puzzleId) {

        const getPromise = new Promise(async (resolve) => {

            // get source data
            const res = await db.PuzzleData(puzzleId);
            const dbPuzzle = res[0];
            const puzzleSourceCompressed = dbPuzzle.sourceData.toString('utf8');
            const puzzleSourceDecompressed = LZString.decompressFromBase64(puzzleSourceCompressed);
            const puzzleSource = JSON.parse(puzzleSourceDecompressed);

            // build puzzle w/ AI
            // NOTE: this is weird but puzzleSource is mutated and then returned here
            const puzzleBuilt = await this.adjustCluesWithAI(puzzleSource);
            resolve(puzzleBuilt);
        });

        return getPromise;
    }

    adjustCluesWithAI(puzData) {

        let puzzleTitle = `Puzzle ${puzData.id}:  ${puzData.publicationDate}`;
        let cluesFlat = puzData.cluesFlat;
        return new Promise(async (resolve, reject) => {
            const BatchSolveSize = 1;
            const AIPromptWordCount = "This string has all spaces removed. If its a single word then return the word, otherwise return the words separated by a single space. Your response should be ONLY the word or words, without any preface or extra characters:";
            //const AIPromptClueNew = "Given a clue and solution, provide both a better though still interesting clue and an easier clue. Do NOT provide the solution, and ONLY provide the clues themselves in your response, without any labels or prefixes.";
            const AIPromptClueNew = "Given a clue and solution, please provide a better though still interesting clue without providing the solution. Your response should only be the revised solution, without any preface";
            const AIPromptClueNewEasy = "Given a clue and solution, provide a hint in the form of either a word rhyme, emoji description, or some other extremely easy hint";
            const AIPromptExplanation = "Given a clue to a word and its solution, provide a fun fact or interesting related information";
            const ClueBatchesToSolve = [];
            [cluesFlat.across, cluesFlat.down].forEach((clueFlat) => {
                let newBatch = true;
                let curClueBatch = null;
                for (let clueIdx in clueFlat) {
                    if (newBatch) {
                        let clueBatchSolve = {};
                        clueBatchSolve.cluesJson = [];
                        clueBatchSolve.cluesIdx = clueIdx;
                        ClueBatchesToSolve.push(clueBatchSolve);
                        newBatch = false;
                        curClueBatch = ClueBatchesToSolve[ClueBatchesToSolve.length - 1];
                    }

                    curClueBatch.cluesJson.push(clueFlat[clueIdx]);
                    if (curClueBatch.cluesJson.length >= BatchSolveSize) {
                        newBatch = true;
                    }
                }

                if (!newBatch) {
                    ClueBatchesToSolve.push(clueBatchSolve);
                }
            });

            this.progressPuzzle(0, ClueBatchesToSolve.length, puzzleTitle);
            for (let i = 0; i < ClueBatchesToSolve.length; ++i) {

                if (i != 0) await sleep(500);

                const clueBatchToSolve = ClueBatchesToSolve[i];
                const clue = clueBatchToSolve.cluesJson[0];

                let promptWordCount = `${AIPromptWordCount}\n${clue.solution}`;
                await ai.ask(promptWordCount).then((words) => {

                    let wordCount = words.trim().split(/\s+/).length;
                    //let wordCount = parseInt(response, 10);
                    clue.wordCount = wordCount;
                    clue.words = words.trim();
                });

                this.draftLog(`NYT Clue: ${clue.text}   -- ${clue.solution} -- "${clue.words}" ${clue.wordCount}`);

                let trimClue = (response) => {
                    if (response.indexOf(':') >= 0) {
                        response = response.substr(response.indexOf(':') + 1);
                    }

                    response = response.replaceAll('\n', ' ');

                    return response;
                };

                let promptClueNew = `${AIPromptClueNew}\nclue: ${clue.text}\nsolution: ${clue.words}`;
                await ai.ask(promptClueNew).then((response) => {
                    //if (response.indexOf('Clue:') >= 0) {
                    //    matchedResponse = [...response.matchAll(/([cC]lue:)\s*?(.*)$/g)];
                    //    if (matchedResponse && matchedResponse.length > 0 && matchedResponse[0] && matchedResponse[0].length > 0) {
                    //        response = matchedResponse[0][matchedResponse[0].length - 1];
                    //    }
                    //}

                    //response = response.trim();
                    //if (response[0] === '"') response = response.substr(1);
                    //if (response[response.length-1] === '"') response = response.substr(0, response.length-1);
                    //response = response.trim();

                    response = trimClue(response);
                    clue.textAI = response;
                });

                this.draftLog(`    GPT: ${clue.textAI}`);

                let promptClueNewEasy = `${AIPromptClueNewEasy}\nclue: ${clue.text}\nsolution: ${clue.words}`;
                await ai.ask(promptClueNewEasy).then((response) => {

                    response = trimClue(response);
                    clue.textAIEasy = response;
                });

                this.draftLog(`    GPTEasy: ${clue.textAIEasy}`);

                /*
            let promptClueNew = `${AIPromptClueNew}\nclue: ${clue.text}\nsolution: ${clue.solution}`;
            let promiseClueNew = ai.ask(promptClueNew).then((response) => {
                let multiResponse = response.split('\n');
                let clueA = multiResponse[0];
                let clueB = multiResponse[multiResponse.length-1];
                let clues = [clueA, clueB];

                for (let i = 0; i < clues.length; ++i) {

                    let clue = clues[i];
                    if (clue.indexOf('Clue:') >= 0) {
                        console.log(clue);
                        matchedResponse = [...clue.matchAll(/^.*([cC]lue:?)?\s*?(.*)$/g)];
                        if (matchedResponse && matchedResponse.length > 0 && matchedResponse[0] && matchedResponse[0].length > 0) {
                            clue = matchedResponse[0][matchedResponse[0].length - 1];
                        }
                    }


                    clue = clue.trim();
                    if (clue[0] === '"') clue = clue.substr(1);
                    if (clue[clue.length-1] === '"') clue = clue.substr(0, clue.length-1);
                    clue = clue.trim();

                    if (i == 0) clue.textAI = clue;
                    else if (i == 1) clue.textAIEasy = clue;
                }
            });
            */

                let promptExplanation = `${AIPromptExplanation}\nclue: ${clue.text}\nsolution: ${clue.words}`;
                await ai.ask(promptExplanation).then((response) => {
                    clue.explanation = response;
                });

                this.draftLog(`    Explanation: ${clue.explanation}`);
                this.progressPuzzle(i + 1, ClueBatchesToSolve.length, puzzleTitle);
            }

            resolve(puzData);
        });
    }

}

async function loadPuzzlesListFromDb() {
    allPuzzlesMap = { };
    allPuzzlesByDateMap = { };
    let existingPuzzles = await db.PuzzlesList();

    for (let i = 0; i < existingPuzzles.length; ++i) {
        const existingPuzzle = existingPuzzles[i];
        const date = getDateFormatISO8601(existingPuzzle.date);
        allPuzzlesMap[existingPuzzle.puzzleId] = existingPuzzle;
        allPuzzlesByDateMap[date] = existingPuzzle;
    }
};


async function main() {

    // initialize
    await loadPuzzlesListFromDb();

    let requests = [];

    //
    // Fetch puzzles list
    //
    //let endDate = (new Date());
    //endDate.setMonth(endDate.getMonth() - 12);
    //let startDate = (new Date());
    //startDate.setMonth(startDate.getMonth() - 60);
    //requests.push(new RequestFetchPuzzlesList({
    //    startDate, endDate
    //}));


    //
    // Fill unscraped puzzles
    //
    //let puzzlesToFill = [];
    //for (let puzzleId in allPuzzlesMap) {
    //    if (allPuzzlesMap[puzzleId].sourceData === 0) {
    //        puzzlesToFill.push(puzzleId);

    //        if (puzzlesToFill.length >= 250) {
    //            break;
    //        }
    //    }
    //}

    //if (puzzlesToFill.length == 0) {
    //    console.log("No puzzles with missing source");
    //    process.exit(0);
    //}

    //requests.push(new RequestFetchPuzzles({ puzzleIds: puzzlesToFill }));
    //await handleRequests(requests);



    //
    // Fill unbuilt puzzles
    //
    let puzzlesToBuild = Object.values(allPuzzlesMap).filter((p) => p.parsedData === 0).sort((a, b) => {
        const aDate = new Date(a.date);
        const bDate = new Date(b.date);
        return aDate.getTime() < bDate.getTime();
    }).reverse().splice(0, 10).map((p) => p.puzzleId);

    if (puzzlesToBuild.length == 0) {
        console.log("No puzzles with missing source");
        process.exit(0);
    }

    requests.push(new RequestBuildPuzzles({ puzzleIds: puzzlesToBuild }));

    await handleRequests(requests);
}

main();






const RateLimit = {
    started: 0,
    ops: 0
};

const RATE_LIMIT_OPS = 1 / (1000 * 60); // 1op/60s

const rateLimited = () => {
    const now = (new Date()).getTime();
    const totalTime = now - RateLimit.started;

    const avg = RateLimit.ops / totalTime;
    if (avg > RATE_LIMIT_OPS) {
        return true;
    }

    return false;
};
