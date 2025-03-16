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

let nytCookie = child_process.execSync('secrets.sh nyt-cookie', { encoding: 'utf8' }).trim();

function getPuzzlesFile() {
    if (!fs.existsSync('puzzles.json')) {
        return {
            'NYT': []
        };
    }

    let f = fs.readFileSync('puzzles.json', 'utf8');
    let json = JSON.parse(f);
    return json;
}

function savePuzzlesFile(json) {
    let jsonStr = JSON.stringify(json);
    fs.writeFileSync('puzzles.json', jsonStr);
}

const allPuzzlesMap = { };
const allPuzzles = getPuzzlesFile();

for (let i = 0; i < allPuzzles.NYT.length; ++i) {
    let existingPuzzle = allPuzzles.NYT[i];
    allPuzzlesMap[existingPuzzle.puzzle_id] = true;
}


const processNewPuzzles = (newPuzzles) => {

    console.log('Downloading Puzzle Files');
    let finishedLoop = false;
    let promisesCompleted = 0;
    let allPromises = [];
    for (let i = 0; i < newPuzzles.length; ++i) {
        const newPuzzle = newPuzzles[i];
        let puzzleid = newPuzzle.puzzle_id;
        if (allPuzzlesMap[newPuzzle.puzzle_id]) {

            // Do we still have the data file?
            let puzTitle = `nyt${puzzleid}`;
            let puzRawFile = `data/${puzTitle}.json`;
            if (fs.existsSync(puzRawFile)) continue;
        }

        let promise = new Promise((resolve, reject) => {

            const options = {
                hostname: 'www.nytimes.com',
                port: 443,
                path: `/svc/crosswords/v6/puzzle/${puzzleid}.json`,
                method: 'GET',
                gzip: true,
                headers: {
                    'Cookie': nytCookie,
                    'Accept': '*/*', // Accept any content type
                    'Accept-Encoding': 'gzip, deflate, br', // Handle compressed responses
                    'User-Agent': 'curl/7.64.1', // Mimic a curl User-Agent
                },
            };

            // curl 'https://www.nytimes.com/svc/crosswords/v6/puzzle/22555.json' --compressed -H 'Cookie: NYT-S=XXXXXXXXXX'
            https.get(options, function(res) {
                if (res.statusCode !== 200) {
                    console.error('Failed to url fetch');
                    console.log(res);
                    res.resume();
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
                        // new puzzle
                        allPuzzlesMap[puzzleid] = true;
                        allPuzzles.NYT.push(newPuzzle);
                        let filePath = `data/nyt${puzzleid}.json`;
                        fs.writeFileSync(filePath, rawData);
                        console.log(filePath);

                        promisesCompleted++;
                        if (finishedLoop) {
                            console.log(`${promisesCompleted} / ${allPromises.length}`);
                        }

                        resolve();
                    } catch (e) {
                        console.error(e.message);
                    }
                });
            }).on('error', (e) => {
                console.error(`Got error: ${e.message}`);
            });
        });

        allPromises.push(promise);
    }
    finishedLoop = true;

    Promise.all(allPromises).then(() => {
        savePuzzlesFile(allPuzzles);
        processPuzzleFiles(allPuzzles.NYT);
    });
};


console.log('Loaded Puzzles List');
var req = https.get('https://www.nytimes.com/svc/crosswords/v3/puzzles.json', function(res) {

    if (res.statusCode !== 200) {
        console.error(error.message);
        // Consume response data to free up memory
        res.resume();
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
            } else {
                processNewPuzzles(parsedData.results);
            }
        } catch (e) {
            console.error(e.message);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});





function getPuzFile(file) {
    let f = fs.readFileSync(file, 'utf8');

    let json = JSON.parse(f);
    let puzData = puzParser.parsePuzzle(json);
    return puzData;
}

function adjustCluesWithAI(puzData) {

    let cluesFlat = puzData.cluesFlat;
    return new Promise((resolve, reject) => {
        const BatchSolveSize = 1;
        const AIPromptWordCount = "Based on the clue and the solution, determine how many words are in the solution. Double check your answer before answering, since the solution has hidden spaces between words. Only return the number of words as an integer\n";
        const AIPromptClueNew = "Given a clue and solution, please provide a better though still interesting clue without providing the solution";
        const AIPromptExplanation = "Given a clue and solution, explain the clue behind the answer. Also if applicable provide a fun fact or interesting related information";
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

        let allPromises = [];
        ClueBatchesToSolve.forEach((clueBatchToSolve) => {
            const clue = clueBatchToSolve.cluesJson[0];
            let promptWordCount = `${AIPromptWordCount}clue: ${clue.text}\nsolution: ${clue.solution}`;
            let promiseWords = ai.ask(promptWordCount).then((response) => {
                let responseNum = parseInt(response, 10);
                clue.wordCount = responseNum;
                //if (responseNum != 1) {
                //    clue.text += ` (AI words: ${response})`;
                //}
            });

            let promptClueNew = `${AIPromptClueNew}clue: ${clue.text}\nsolution: ${clue.solution}`;
            let promiseClueNew = ai.ask(promptClueNew).then((response) => {
                if (response.indexOf('Clue:') >= 0) {
                    console.log(response);
                    matchedResponse = [...response.matchAll(/^(Clue:?)?\s*?(.*)$/g)];
                    if (matchedResponse && matchedResponse.length > 0 && matchedResponse[0] && matchedResponse[0].length > 0) {
                        response = matchedResponse[0][matchedResponse[0].length - 1];
                    }
                }

                response = response.trim();
                if (response[0] === '"') response = response.substr(1);
                if (response[response.length-1] === '"') response = response.substr(0, response.length-1);
                response = response.trim();

                clue.textAI = response;
            });

            let promptExplanation = `${AIPromptExplanation}clue: ${clue.text}\nsolution: ${clue.solution}`;
            let promiseExplanation = ai.ask(promptExplanation).then((response) => {
                clue.explanation = response;
            });

            allPromises.push(promiseWords);
            allPromises.push(promiseClueNew);
            allPromises.push(promiseExplanation);
        });

        Promise.all(allPromises).then(() => {
            resolve(puzData);
        });
    });
}

const PromisesLoadingState = {
    started: false,
    completed: 0,
    total: 0
};

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

const processPuzzle = (puzRawFile, puzProcessedFile) => {

    if (rateLimited()) {
        setTimeout(() => { processPuzzle(puzRawFile, puzProcessedFile); }, 1000);
        return;
    }

    console.log(`OpenAI: ${puzRawFile}`);

    // Initial process of puzzleFile
    puzData = getPuzFile(puzRawFile);
    const promise = adjustCluesWithAI(puzData).then((json) => {

        // Save preprocessed file
        let m = JSON.stringify(json); // adjusted by ref in callee
        fs.writeFileSync(puzProcessedFile, m);

        PromisesLoadingState.completed++;
        if (PromisesLoadingState.started) {
            console.log(`${PromisesLoadingState.completed} / ${PromisesLoadingState.total}`);
        }
    });

    RateLimit.ops++;
}

const processPuzzleFiles = (puzzles) => {

    console.log('Processing Puzzle Files');

    RateLimit.started = (new Date()).getTime();

    PromisesLoadingState.started = false;
    PromisesLoadingState.completed = 0;
    const allPromises = [];
    for (let i = 0; i < puzzles.length; ++i) {

        let puzzleid = puzzles[i].puzzle_id;
        let puzTitle = `nyt${puzzleid}`;
        let puzRawFile = `data/${puzTitle}.json`;
        let puzProcessedFile = `data/${puzTitle}.processed.json`;

        if (fs.existsSync(puzProcessedFile)) {
            continue;
        }

        PromisesLoadingState.total++;

        // Check rate limiter, we may need to wait or openai will deny us
        processPuzzle(puzRawFile, puzProcessedFile);
    }

    PromisesLoadingState.started = true;
};
