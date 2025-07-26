let allPuzzles = [];

class CalendarDate {
    constructor() {
        this.year = 0;
        this.month = 0;
        this.daysInMonth = 0;
    };

    setDate(year, month) {
        if (month >= 12) {
            const yearInc = parseInt(month / 12, 10);
            year += yearInc;
            month %= 12;
        } else if (month < 0) {
            let monthNeg = month * -1;
            const yearDec = parseInt(monthNeg / 12, 10) + 1;
            year -= yearDec;
            monthNeg %= 12;
            month = 12 - monthNeg;
        }

        this.year = year;
        this.month = month;
        this.daysInMonth = this.getDaysInMonth();
    };

    getDaysInMonth() {
        const monthDate = new Date(this.year, this.month, 1);
        let monthDatesYear = monthDate.getFullYear();
        let monthDatesMonth = monthDate.getMonth();

        // inc to next month
        monthDatesMonth++;
        if (monthDatesMonth == 13) {
            monthDatesMonth = 1;
            monthDatesYear++;
        }

        let d = new Date(monthDatesYear, monthDatesMonth, 1); // beginning of next month
        d.setDate(d.getDate() - 1); // end of this month
        return d.getDate();
    };

    getDayOfWeek(day) {
        const d = new Date(this.year, this.month, day);
        return d.getDay();
    };

    getDayOfWeekName(day) {
        const DAYS_OF_WEEK = [ "SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT" ];
        const dayOfWeek = this.getDayOfWeek(day);
        return DAYS_OF_WEEK[dayOfWeek];
    };

    getMonthName() {
        const MONTHS_OF_YEAR = [ "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC" ];
        return MONTHS_OF_YEAR[this.month];
    };

    addMonth() {
        this.setDate(this.year, this.month + 1);
    };

    subMonth() {
        this.setDate(this.year, this.month - 1);
    };
};

class CalendarGrid {
    constructor(gridEl, calDate) {
        this.gridEl = gridEl;
        this.gridEls = [];
        this.clearCalendar();

        this.calDate = calDate;
        this.buildGrid();
    };

    rebuild() {
        this.clearCalendar();
        this.buildGrid();
    };

    clearCalendar() {
        for (let i = 0; i < this.gridEls.length; ++i) {
            this.gridEls[i].remove();
        }

        this.gridEls = [];
    };

    buildGrid() {
        let firstDayOfWeek = this.calDate.getDayOfWeek(1);
        for (let i = 0; i < firstDayOfWeek; ++i) {
            const DAYS_OF_WEEK = [ "SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT" ];

            const gridCellEl = document.createElement('div');
            gridCellEl.className = 'calendar-grid-date';
            gridCellEl.textContent = "-";
            gridCellEl.setAttribute('cal-day-type', 0);
            this.gridEl.appendChild(gridCellEl);
            this.gridEls.push(gridCellEl);
        }

        for (let i = 1; i <= this.calDate.daysInMonth; ++i) {
            let dayOfWeek = this.calDate.getDayOfWeekName(i);

            const gridCellEl = document.createElement('div');
            gridCellEl.className = 'calendar-grid-date';
            gridCellEl.textContent = i;
            gridCellEl.setAttribute('cal-day-type', 1);
            gridCellEl.setAttribute('cal-day-date', i);
            this.gridEl.appendChild(gridCellEl);
            this.gridEls.push(gridCellEl);
        }
    };
};

class CalendarObj {
    constructor(gridEl, headerEl) {

        const curDate = new Date();
        this.calDate = new CalendarDate();
        this.calDate.setDate(curDate.getFullYear(), curDate.getMonth());

        this.grid = new CalendarGrid(gridEl, this.calDate);
        this.headerEl = headerEl;
        this.monthEl = document.getElementById('calendar-header-current', headerEl);

        this.leftEl = document.getElementById('calendar-header-left', headerEl);
        this.rightEl = document.getElementById('calendar-header-right', headerEl);

        const that = this;
        this.leftEl.addEventListener('click', function() { that.subMonth(); });
        this.rightEl.addEventListener('click', function() { that.addMonth(); });

        this.updateDisplay();
    }

    addMonth() {
        this.calDate.addMonth();
        this.grid.rebuild();
        this.updateDisplay();
    };

    subMonth() {
        this.calDate.subMonth();
        this.grid.rebuild();
        this.updateDisplay();
    };

    linkPuzzles() {

        const puzzles = allPuzzles.filter((p) => {
            const date = new Date(p.date);
            return date.getFullYear() == this.calDate.year && date.getMonth() == this.calDate.month;
        });

        const allDayCells = document.querySelectorAll(`[cal-day-type="1"]`);
        for (let i = 0; i < allDayCells.length; ++i) {
            const cell = allDayCells[i];
            cell.classList.add('cell-noentry');
        }

        for (let i = 0; i < puzzles.length; ++i) {
            const puzzle = puzzles[i];
            const date = new Date(puzzle.date);
            const cell = document.querySelector(`[cal-day-date="${date.getDate()}"]`);

            cell.classList.remove('cell-noentry');
            if (puzzle.completed == 1) {
                cell.classList.add('cell-completed');
            }

            if (puzzle.parsedData == 0) {
                cell.classList.add('cell-noparse');
            }

            if (puzzle.sourceData == 0) {
                cell.classList.add('cell-nosource');
            }

            cell.onclick = () => {
                window.location = `index.php?puzzleid=${puzzle.puzzleId}`;
            };
        }
    };

    updateDisplay() {
        let curMonth = this.calDate.getMonthName();
        let curYear = this.calDate.year;
        this.monthEl.innerText = `${curMonth} ${curYear}`;
        this.linkPuzzles();
    };
};

async function getPuzzles() {

    const params = new URLSearchParams({ userId: 1 });
    let uri = `getUserPuzzles.php?${params}`;
    await fetch(uri, {
        method: 'GET'
    }).then(response => response.text())
      .then((res) => {
          allPuzzles = JSON.parse(res);
      });

    return allPuzzles;
};

async function initialLoad() {

    allPuzzles = await getPuzzles();

    const curDate = new Date();
    const calDate = new CalendarDate();
    calDate.setDate(curDate.getFullYear(), curDate.getMonth());
    for (let i = 1; i <= calDate.daysInMonth; ++i) {
        let thisDate = new Date(curDate.getFullYear(), curDate.getMonth(), i);
        let dayOfWeek = calDate.getDayOfWeekName(i);
    }

    const calGridEl = document.getElementById('calendar-grid');
    const calHeaderEl = document.getElementById('calendar-header');
    //const calGrid = new CalendarGrid(calGridEl);
    const calObj = new CalendarObj(calGridEl, calHeaderEl);
};

document.addEventListener('DOMContentLoaded', async function() {

    initialLoad();
});
