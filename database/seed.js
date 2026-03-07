const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// We'll output a JSON file that acts as our "Database" for the frontend to consume
const OUT_DIR = path.join(__dirname, '..', 'client', 'src', 'data');
const OUT_FILE = path.join(OUT_DIR, 'seed_db.json');

const EXCEL_FILE = 'Plan_Treningowy_claude.xlsx';

function parseExcel() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  const db = {
    phases: [],
    workouts: [],
    exercises: {},
    logs: [] // historical sets
  };

  const phaseSheets = ['Faza 1 (Tydz. 1-4)', 'Faza 2 (Tydz. 5-6)', 'Faza 3 (Tydz. 7-10)'];

  phaseSheets.forEach((sheetName, phaseIdx) => {
    if (!workbook.Sheets[sheetName]) return;
    
    console.log(`Parsing ${sheetName}...`);
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    const phaseId = `phase_${phaseIdx + 1}`;
    db.phases.push({ id: phaseId, name: sheetName });

    let currentWorkout = null;

    // Scan rows to find workouts and exercises
    for (let r = 0; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || !row.length) continue;

      const firstCell = String(row[0] || '').trim();
      
      // Attempt to identify a workout header (e.g. "Trening A – Pełne Ciało")
      if (firstCell.startsWith('Trening')) {
        currentWorkout = {
          id: `w_${db.workouts.length + 1}`,
          phaseId: phaseId,
          name: firstCell,
          exercises: []
        };
        db.workouts.push(currentWorkout);
        continue;
      }

      // If we have a current workout, attempt to parse an exercise row
      if (currentWorkout && firstCell && row.length > 1 && String(row[1]).includes('x')) {
        const targetStr = String(row[1]); // e.g., "3x8-10"
        const targetParts = targetStr.split('x');
        const targetSets = parseInt(targetParts[0]) || 3;
        const targetReps = targetParts[1] || "";
        
        let exId = Object.keys(db.exercises).find(k => db.exercises[k].name === firstCell);
        if (!exId) {
          exId = `ex_${Object.keys(db.exercises).length + 1}`;
          db.exercises[exId] = { id: exId, name: firstCell };
        }

        const exerciseDef = {
          exerciseId: exId,
          targetSets,
          targetReps
        };
        
        // Extract historical set data across the weeks (columns 2 through 20+)
        // This is a simplified extraction; an actual implementation would map exact columns
        // to specific weeks and sets.
        const historyCols = row.slice(2);
        const history = [];
        for (let c = 0; c < historyCols.length; c += 2) {
            const reps = historyCols[c];
            const weight = historyCols[c+1];
            if (reps && weight && !isNaN(parseInt(reps))) {
                history.push({ reps: parseInt(reps), weight: parseFloat(weight) });
            }
        }
        
        exerciseDef.history = history.length > 0 ? history : undefined;
        currentWorkout.exercises.push(exerciseDef);
      }
    }
  });

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(db, null, 2));
  console.log(`Successfully parsed configuration into ${OUT_FILE}`);
}

try {
  parseExcel();
} catch (e) {
  console.error("Failed to parse", e);
}
