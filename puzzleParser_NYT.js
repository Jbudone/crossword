
function parsePuzzle(json) {
    //const json = JSON.parse(buffer);


    const width = json.body[0].dimensions.width;
    const height = json.body[0].dimensions.height;
    const title = json.title;
    const author = json.constructors.join(' and ');
    const editor = json.editor;
    const copyright = json.copyright;
    const puzzleId = json.id;
    const publicationDate = json.publicationDate;

    const solution = []; // [row0, row1, ...]
    const state = [];
    let solutionRow = []; // [cell0, cell1, ...]
    let stateRow = [];
    const cluesGrid = Array(height).fill(0).map(() => Array(width).fill(0).map(() => ([-1, -1])));
    for (let i = 0; i < json.body[0].cells.length;) {
        const cell = json.body[0].cells[i];
        let blankSpot = !('answer' in cell);

        const cellSolution = (blankSpot ? '.' : cell.answer);
        const cellState = (blankSpot ? '.' : '-');
        solutionRow.push(cellSolution);
        stateRow.push(cellState);

        const row = parseInt(i / width),
            col = i % width;

        if (!blankSpot) {
            if (cell.clues.length === 0) {
                // blank cell?
            } else if (cell.clues.length != 2) {
                debugger; // FIXME: What does this mean to only have 1 clue??
            } else {
                //cell.clues[0,1] is idx into clues, which contain a label to match cell/clue
                const acrossClueIdx = cell.clues[0],
                    downClueIdx = cell.clues[1];

                const acrossClue = json.body[0].clues[acrossClueIdx],
                    downClue = json.body[0].clues[downClueIdx];

                cluesGrid[row][col][0] = parseInt(acrossClue.label, 10) - 1; // labels start at 1
                cluesGrid[row][col][1] = parseInt(downClue.label, 10) - 1; // labels start at 1
            }
        }


        ++i;
        if (i % width === 0) {
            solution.push(solutionRow);
            state.push(stateRow);
            solutionRow = [];
            stateRow = [];
        }
    }

    let wordStarts = {};
    const cluesFlat = { across: {}, down: {} };
    for (let i = 0; i < json.body[0].clues.length; ++i) {
        const clue = json.body[0].clues[i];
        const clueIdx = parseInt(clue.label, 10) - 1; // annoyingly they start at idx 1
        const clueText = clue.text[0].plain;
        if (clue.text.length != 1) {
            // what does it mean to have multiple clues?
            debugger;
        }

        let clueList = null;
        if (clue.direction === 'Across') {
            clueList = cluesFlat.across;
        } else {
            clueList = cluesFlat.down;
        }

        if (clueList[clueIdx]) {
            // we hve the same clue multiple times?
            debugger;
        }

        let clueSolution = "";
        for (let cellIdx = 0; cellIdx < clue.cells.length; ++cellIdx) {
            const cellId = clue.cells[cellIdx],
                cellY = parseInt(cellId / width, 10),
                cellX = cellId % width;

            const cellSolution = solution[cellY][cellX];
            clueSolution += cellSolution;
        }

        clueList[clueIdx] = {
            text: clueText,
            cells: clue.cells,
            solution: clueSolution
        };
    }


    return {
        width,
        height,
        title: title,
        author: author,
        editor: editor,
        publicationDate: publicationDate,
        copyright: copyright,
        id: puzzleId,
        solution: solution,
        state: state,
        cluesGrid: cluesGrid,
        cluesFlat: cluesFlat,
    };
}

module.exports = {
    parsePuzzle
};
