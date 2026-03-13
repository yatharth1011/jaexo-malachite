const fs = require('fs');
const path = require('path');

// --- CONFIG: Point to your realprep folder ---
const DATA_DIR = 'D:/Yatharth Files/Study/JEEADV/realprep/';

// --- Stage 1: Build the TDX Engine in pure JS ---
const PC_PRIORITY = ['Solid State', 'Surface Chemistry', 'Equivalent Concept', 'Electrochemistry', 'Thermodynamics', 'Ionic Equilibrium', 'Chemical Equilibrium', 'Liquid Solution', 'Chemical Kinetics', 'Gaseous State', 'Atomic Structure', 'Mole Concept', 'Thermochemistry'];
const IOC_PRIORITY = ['p-block Elements', 'Coordination Compounds', 'Chemical Bonding (Advanced)', 'd- and f-block Elements', 'Salt Analysis', 'Chemical Bonding (Basic)', 'Metallurgy', 'Periodic Properties', 's-block Elements', 'Hydrogen and Its Compounds', 'Environmental Chemistry', 'Quantum Numbers'];
const YELLOW_PRIORITY = ['Permutations and Combinations', 'Probability', 'Complex Numbers', 'Matrices', 'Quadratic Equations', 'Sequence and Progression', 'Binomial Theorem', 'Logarithm'];
const ORG_CHAPTERS = ["Alkyl Halides", "Carbonyl Compounds - I", "Carbonyl Compounds - II", "Carboxylic Acids, Amines and their Derivatives", "Aromatic Compounds"];
let TDX_SYLLABUS = [];

function parseCSV(filename, strategy, priority_list, subjTag, target_chapters, ignore_sections) {
    const fullPath = path.join(DATA_DIR, filename);
    if(!fs.existsSync(fullPath)) { console.log('⚠️ Skipping ' + filename); return; }
    let content = fs.readFileSync(fullPath, 'utf-8');
    let lines = content.split(/\r?\n/);
    let current_chapter = 'Full Syllabus';
    
    lines.forEach((line, row_idx) => {
        if(!line.trim()) return;
        let cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || line.split(',');
        cols = cols.map(s => s.replace(/(^"|"$)/g, '').trim());
        
        if(cols.length < 3) return;
        let [col0, col1, col2] = cols;
        if(['', 'Particular', 'Book', 'Done', 'Particulars'].includes(col0) || col0.includes('Unnamed')) return;
        
        if(!/\d/.test(col1) && !/\d/.test(col2)) {
            current_chapter = col0;
            return;
        }
        
        if(target_chapters && !target_chapters.includes(current_chapter)) return;
        if(ignore_sections && ignore_sections.some(ign => col0.toLowerCase().includes(ign.toLowerCase()))) return;
        
        let done = parseFloat(col1) || 0;
        let total = parseFloat(col2) || 0;
        let rem = Math.max(0, total - done);
        
        if(rem > 0) {
            let p_val = priority_list ? (priority_list.indexOf(current_chapter) > -1 ? priority_list.indexOf(current_chapter) : 99) : 99;
            TDX_SYLLABUS.push({
                id: `${subjTag}_${row_idx}`, subject: subjTag, chapter: current_chapter, section: col0,
                total: total, done_initial: done, strategy: strategy, priority: p_val
            });
        }
    });
}
console.log('Reading CSVs from: ' + DATA_DIR);
parseCSV('Organic Chemistry.csv', 'Even/Odd', null, 'OC', ORG_CHAPTERS);
parseCSV('Math (Yellow Book).csv', 'Even/Odd', YELLOW_PRIORITY, 'MATH');
parseCSV('Math (Sameer Bansal).csv', 'Even/Odd', null, 'MATH');
parseCSV('Math (Pink Book).csv', 'ALL', null, 'MATH');
parseCSV('Physical Chemistry.csv', 'Even/Odd', PC_PRIORITY, 'PC', null, ['Section A']);
parseCSV('Inorganic Chemistry.csv', 'Even/Odd', IOC_PRIORITY, 'IOC', null, ['Level 1']);
parseCSV('Physics.csv', 'ALL', null, 'PHY');


// --- Stage 2: Prepare the code blocks for injection ---

// BLOCK 1: TDX React Component and Engine Logic
const TDX_COMPONENT_AND_ENGINE = `
// ==========================================
// IN-APP TDX ENGINE & INTERFACE
// ==========================================
const TDX_ENGINE = {
    START_DATE: new Date("2026-03-14T00:00:00"),
    TOTAL_DAYS: 37,
    MAX_CAPACITY: 150,
    DATE_WEIGHTS: {"2026-03-14":0.4,"2026-03-15":0,"2026-03-17":0.4,"2026-03-19":0,"2026-03-20":0.4,"2026-03-22":0,"2026-03-24":0.4,"2026-03-25":0.5,"2026-03-26":0,"2026-03-27":0.5,"2026-03-28":0.5,"2026-03-29":0,"2026-03-30":0.5,"2026-03-31":0.5,"2026-04-02":0.5,"2026-04-03":0.5,"2026-04-04":0.5,"2026-04-05":0.5,"2026-04-06":0.5,"2026-04-07":0.5,"2026-04-08":0.5,"2026-04-09":0.5,"2026-04-13":0,"2026-04-15":0,"2026-04-17":0},
    SYLLABUS: ${JSON.stringify(TDX_SYLLABUS)},

    generateMasterSchedule: function(currentDayIdx, tdxProgress) {
        let queues = {};
        let total_targeted_qs = 0;
        let total_raw_qs = 0;

        this.SYLLABUS.forEach(item => {
            let done_now = item.done_initial + (tdxProgress[item.id] || 0);
            let rem = Math.max(0, item.total - done_now);
            if (rem > 0) {
                let max_qs = item.strategy === 'Even/Odd' ? Math.floor((rem + 1) / 2) : rem;
                if (max_qs > 0) {
                    if (!queues[item.subject]) queues[item.subject] = [];
                    queues[item.subject].push({ ...item, rem_raw: rem, target_qs: max_qs, qs: max_qs });
                    total_targeted_qs += max_qs;
                    total_raw_qs += rem;
                }
            }
        });
        for(let subj in queues) queues[subj].sort((a,b) => a.priority - b.priority);

        let total_effective_days_left = 0;
        for(let i = currentDayIdx; i < this.TOTAL_DAYS; i++) {
            let dObj = new Date(this.START_DATE.getTime() + i * 86400000);
            let dStr = getLocalKey(dObj);
            total_effective_days_left += (this.DATE_WEIGHTS[dStr] !== undefined ? this.DATE_WEIGHTS[dStr] : 1.0);
        }
        let total_capacity = total_effective_days_left * this.MAX_CAPACITY;

        if(total_targeted_qs > 0) {
            if (total_capacity < total_targeted_qs) { // Compress
                const ratio = total_capacity / total_targeted_qs;
                for (let q of Object.values(queues)) q.forEach(t => t.qs = Math.max(1, Math.ceil(t.target_qs * ratio)));
            } else if (total_capacity > total_targeted_qs) { // Expand
                const ratio = Math.min(1.0, (total_capacity - total_targeted_qs) / Math.max(1, total_raw_qs - total_targeted_qs));
                for (let q of Object.values(queues)) q.forEach(t => t.qs = Math.max(1, t.target_qs + Math.floor((t.rem_raw - t.target_qs) * ratio)));
            }
        }
        
        let schedules = {};
        for (let subj in queues) {
            schedules[subj] = this.distributeTasks(JSON.parse(JSON.stringify(queues[subj])), currentDayIdx);
        }
        return schedules;
    },
    
    distributeTasks: function(queue, startDay) {
        let schedule = {};
        let weights = {};
        for(let d = startDay; d < this.TOTAL_DAYS; d++) {
             let dObj = new Date(this.START_DATE.getTime() + d * 86400000);
             weights[d] = this.DATE_WEIGHTS[getLocalKey(dObj)] ?? 1.0;
        }
        const total_weight = Object.values(weights).reduce((s,v) => s+v, 0);
        if(total_weight === 0) return schedule;

        let total_qs = queue.reduce((s,t) => s+t.qs, 0);
        let running_target = 0; let allocated_total = 0; let q_idx = 0;
        let current_task = queue[q_idx];

        for (let day = startDay; day < this.TOTAL_DAYS; day++) {
            if (weights[day] === 0) continue;
            running_target += (total_qs / total_weight) * weights[day];
            let target_today = Math.round(running_target) - allocated_total;
            let qs_today = 0;
            schedule[day] = [];
            
            while (qs_today < target_today && current_task) {
                let needed = target_today - qs_today;
                if (current_task.qs <= needed) {
                    schedule[day].push({...current_task});
                    qs_today += current_task.qs; allocated_total += current_task.qs;
                    q_idx++; current_task = queue[q_idx];
                } else {
                    schedule[day].push({...current_task, qs: needed});
                    current_task.qs -= needed; qs_today += needed; allocated_total += needed;
                }
            }
        }
        return schedule;
    },

    displayDay: function(schedules, dayIdx) {
        let output = "";
        const current_date = new Date(this.START_DATE.getTime() + dayIdx * 86400000);
        const weight = this.DATE_WEIGHTS[getLocalKey(current_date)] ?? 1.0;
        let day_type = "🔥 FULL STUDY DAY";
        if (weight === 0.0) day_type = "💀 HEAVY TEST DAY (RECOVERY & ANALYSIS ONLY)";
        else if (weight === 0.4) day_type = "⚖️ CLASS + TEST DAY (PARTIAL STUDY)";
        else if (weight === 0.5) day_type = "⚙️ SINGLE TEST/SPEED RUN DAY (HALF STUDY)";

        output += "=".repeat(70) + "\\n";
        output += \` 📅 DATE: \${current_date.toLocaleDateString('en-GB', {day:'2-digit', month:'long', year:'numeric'})} (DAY \${dayIdx+1}/\${this.TOTAL_DAYS})\\n\`;
        output += \` 🚦 DAY TYPE: \${day_type}\\n\`;
        output += "=".repeat(70) + "\\n";
        
        let total_qs_today = 0;
        const subjectOrder = ["OC", "MATH", "PC", "IOC", "PHY"];
        for (const subj of subjectOrder) {
            const days_list = schedules[subj];
            if (!days_list) continue;
            const todays_tasks = days_list[dayIdx] || [];
            if(todays_tasks.length > 0) {
                const subjectNameMap = {"OC": "🧪 ORGANIC (SKM)", "MATH": "🧮 MATHS", "PC": "⚗️ PHYSICAL CHEM", "IOC": "🧬 INORGANIC CHEM", "PHY": "🧲 PHYSICS (GQB)"};
                output += \`\\n\${subjectNameMap[subj] || subj}\\n\`;
                let subj_qs = 0;
                for (const task of todays_tasks) {
                    const eff_ratio = task.qs > 0 ? Math.ceil(task.rem_raw / task.qs) : 1;
                    const strat_str = eff_ratio > 1 ? \`1 in \${eff_ratio}\` : "ALL";
                    output += \`   ➤ [\${strat_str}] \${task.chapter} - \${task.section} : \${task.qs} Qs (Rem: \${task.rem_raw})\\n\`;
                    subj_qs += task.qs;
                }
                output += \`   (Subject Target: ~\${subj_qs} Qs)\\n\`;
                total_qs_today += subj_qs;
            }
        }
        output += "-".repeat(70) + "\\n";
        output += \` 🎯 TOTAL COMBAT Qs ASSIGNED TODAY: \${total_qs_today}\\n\`;
        output += "-".repeat(70) + "\\n";
        return output;
    }
};

const TDXInterface = ({ db, onClose, onPushTasks }) => {
    const today = new Date();
    const todayIdx = Math.max(0, Math.floor((today - TDX_ENGINE.START_DATE) / (1000 * 60 * 60 * 24)));
    const [viewingDay, setViewingDay] = React.useState(todayIdx);
    
    const schedules = React.useMemo(() => {
        return TDX_ENGINE.generateMasterSchedule(todayIdx, db.tdx_progress || {});
    }, [db.tdx_progress]);

    const displayText = TDX_ENGINE.displayDay(schedules, viewingDay);
    
    const handlePush = () => {
        const targetDate = new Date(TDX_ENGINE.START_DATE.getTime() + viewingDay * 86400000);
        let malachiteTasks = [];
        const subjectOrder = ["OC", "MATH", "PC", "IOC", "PHY"];
        for (const subj of subjectOrder) {
            const days_list = schedules[subj];
            if (!days_list) continue;
            (days_list[viewingDay] || []).forEach(task => {
                const eff_ratio = task.qs > 0 ? Math.ceil(task.rem_raw / task.qs) : 1;
                const stratStr = eff_ratio > 1 ? \`[1 in \${eff_ratio}]\` : \`[ALL]\`;
                malachiteTasks.push({
                    id: Math.random(),
                    text: \`\${stratStr} \${task.chapter} - \${task.section} (Rem:\${task.rem_raw})\`,
                    tag: subj,
                    mode: 'training',
                    done: false,
                    problems: task.qs,
                    section_id: task.id // CRITICAL link for progress tracking
                });
            });
        }
        if (malachiteTasks.length === 0) {
             malachiteTasks.push({ id: Math.random(), text: 'HEAVY TEST DAY (Analysis)', tag: 'TEST', mode: 'offline', done: false });
        }
        onPushTasks(malachiteTasks, targetDate);
        onClose();
    };

    return (
        <div className="overlay" style={{background: '#050505', display:'block', overflowY:'auto'}}>
            <pre style={{fontFamily: 'var(--f-main)', whiteSpace:'pre-wrap', width:'100%', maxWidth:'800px', margin:'20px auto', padding:'15px', fontSize:'0.8rem', color:'#ccc'}}>
                {displayText}
            </pre>
            <div style={{position:'fixed', bottom:0, left:0, width:'100%', background:'#111', borderTop:'1px solid #333', padding:'10px', display:'flex', gap:'10px', justifyContent:'center'}}>
                <button className="deck-btn" onClick={() => setViewingDay(v => Math.max(0, v - 1))}>⬅️ PREV</button>
                <button className="deck-btn" onClick={() => setViewingDay(v => Math.min(TDX_ENGINE.TOTAL_DAYS - 1, v + 1))}>NEXT ➡️</button>
                <button className="deck-btn" style={{borderColor:'var(--accent)', color:'var(--accent)'}} onClick={handlePush}>PUSH TO MALACHITE</button>
                <button className="deck-btn danger" onClick={onClose}>EXIT</button>
            </div>
        </div>
    );
};
`;

// BLOCK 2: Modifications for the main App component
const APP_MODS = {
    state: `const [showTdx, setShowTdx] = React.useState(false);`,
    button: `<button className="deck-btn" style={{flex:1}} onClick={()=>setShowTdx(true)}>TDX PLANNER</button>`,
    render: `{showTdx && <TDXInterface db={DB} onClose={()=>setShowTdx(false)} onPushTasks={(tasks, date) => { setDate(date); saveTasks(tasks); }} />}`,
    push_logic: `
            if (body.section_id) { 
                DB.tdx_progress = DB.tdx_progress || {}; 
                const q_done = body.type === 'training' ? (body.correct || 0) : (body.questions || 0);
                DB.tdx_progress[body.section_id] = (DB.tdx_progress[body.section_id] || 0) + q_done; 
            }
    `
};

// --- Stage 3: Perform the surgical injection ---
let html = fs.readFileSync('jaexo-malachite.html', 'utf-8');

// Inject the TDX Component + Engine
html = html.replace(
    '// ==========================================        // HYBRID 2026 SCHEDULE (LEGEND + PYQ)        // ==========================================',
    TDX_COMPONENT_AND_ENGINE
);

// Inject App State
html = html.replace(
    'const [summaryOpen, setSummaryOpen] = React.useState(false);',
    'const [summaryOpen, setSummaryOpen] = React.useState(false);\\n            ' + APP_MODS.state
);

// Inject Command Deck Button
html = html.replace(
    '<button className="deck-btn" style={{flex:1}} onClick={()=>setSummaryOpen(true)}>MISSION REPORT</button>',
    '<button className="deck-btn" style={{flex:1}} onClick={()=>setSummaryOpen(true)}>MISSION REPORT</button>\\n                            ' + APP_MODS.button
);

// Inject Conditional Render
html = html.replace(
    '{summaryOpen && <MissionReport',
    APP_MODS.render + '\\n\\n                    {summaryOpen && <MissionReport'
);

// Inject TDX progress logging logic
if (!html.includes('DB.tdx_progress')) {
    html = html.replace(
        "delete DB.active_task;", 
        APP_MODS.push_logic + "delete DB.active_task;"
    );
}

fs.writeFileSync('jaexo-malachite.html', html);
console.log("✅ TDX Interface successfully injected into Malachite!");