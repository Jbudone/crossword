var fs = require('fs');

function getPuzFilePreprocessed(file) {
    try {
        let f = fs.readFileSync(file, 'utf8');
        return f;
    } catch(e) {
        return false;
    }
}

function main(json) {
    let puzzleid = parseInt(json.puzzleid, 10);
    let puzTitle = `nyt${puzzleid}`;
    let puzProcessedFile = `data/${puzTitle}.processed.json`;
    
    let puzData = getPuzFilePreprocessed(puzProcessedFile);
    return puzData;
}

const args = process.argv;
const inputJson = JSON.parse(args[2]);
const puzData = main(inputJson);
console.log(puzData);
