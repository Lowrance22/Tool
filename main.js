const weatherSvc = new Weather();
const AREA = "优雷卡丰水之地";
let currentMatches = [];

const pad = (n) => String(n).padStart(2, '0');
const fmtLT = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const getET = (d) => Math.floor(((d.getTime() / 1000) / 175) % 24);
function formatDateTime(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function toggleDC() {
    const active = document.getElementById("enableDC")?.checked;
    if (!active) return;
    document.getElementById("dcInput").style.display = active ? "block" : "none";
    document.getElementById("filterBar").style.display = active ? "flex" : "none";
    if (window.innerWidth >= 1100) document.getElementById("debugPanel").style.display = active ? "block" : "none";
    if(active) updateDebug();
}

function updateDebug() {
    const dcInput = document.getElementById("dcInput");
    if(!dcInput) return;
    dcParser.parse(dcInput.value);
    const data = dcParser.getDebugData();
    let html = "";
    const keys = Object.keys(data);
    if(keys.length === 0) html = "找不到日期 (格式範例: 3/7)";
    else {
        keys.forEach(date => {
            html += `<div class="debug-item"><strong>${date}</strong><br>`;
            data[date].forEach(t => { html += ` └ ${t.raw} (分鐘: ${t.start}-${t.end})<br>`; });
            html += `</div>`;
        });
    }
    document.getElementById("debugContent").innerHTML = html;
}

function setFilter(mode, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.sequence-card').forEach(card => {
        if (mode === 'all') card.style.display = 'block';
        else if (mode === 'conflict') card.style.display = card.classList.contains('is-conflict') ? 'block' : 'none';
        else if (mode === 'safe') card.style.display = card.classList.contains('is-safe') ? 'block' : 'none';
    });
}

function processSequence(seq) {
    let totalSnow = 0, totalNone = 0, rounds = [];
    const roundNames = ['第一', '第二', '第三'];
    seq.forEach((group, i) => {
        const d16 = new Date(group.data[0][0]), d08 = new Date(group.data[2][0]);
        const w16 = group.data[0][1], w00 = group.data[1][1];
        const is16Snow = (w16 === "小雪"), is00Snow = (w00 === "小雪");
        let start, end, monster;
        if (is16Snow && is00Snow) monster = "牛龍鬼";
        else if (is16Snow) monster = "牛龍鬼>龍鬼";
        else if (is00Snow) monster = "龍鬼>牛龍鬼";
        else monster = "龍鬼";
        if (is16Snow) { start = d16; monster = "牛蜥>" + monster; } else { start = new Date(d16.getTime() + 6 * 60000); }
        if (i < (seq.length - 1) && is00Snow) { end = d08; monster += ">牛蜥"; } else { end = new Date(d08.getTime() - 6 * 60000); }
        if (is16Snow || is00Snow) totalSnow++; else totalNone++;
        rounds.push({ name: roundNames[i], start: fmtLT(start), end: fmtLT(end), collect: i === 0 ? fmtLT(new Date(start.getTime() - 20 * 60000)) : "", monster });
    });
    const dStart = new Date(seq[0].data[0][0]);
    let carType = (totalSnow === seq.length) ? (seq.length === 3 ? "三變異車" : "雙變異車") : (totalNone === seq.length ? "雙變異車" : "混合變異車");
    return { fullDate: `${dStart.getFullYear()}/${dStart.getMonth()+1}/${dStart.getDate()}`, shortDate: `${dStart.getMonth()+1}/${dStart.getDate()}`, fullRange: `${rounds[0].start}-${rounds[rounds.length-1].end}`, carType, rounds };
}

function copyAction(idx, type, btn) {
    const d = processSequence(currentMatches[idx]);
    let text = "";
    if (type === 'title') {
        text = `${d.shortDate} ${d.fullRange}  晚上${d.carType}，白天封印投票`;
    } else {
        let table = "";
        d.rounds.forEach((r, i) => {
            const colText = (i === 0) ? r.collect : "     "; 
            table += `| ${r.name}輪晚 | ${r.start}   ${r.end}      ${colText} ${r.monster}\n`;
        });
        text = `${d.shortDate} ${d.fullRange}  晚上${d.carType}，白天封印投票\n日期：${d.shortDate}\n時間：${d.fullRange}\n組成：1坦+7鐮刀\n\n坦克需求：\n豪傑的記憶\n文理浴血\n滿補正7石\n\n鐮刀需求 :\n重騎兵的記憶\n文理雙面刃\n滿補正7石\n\n要求：\n※ 準時於集合時間集合\n※ 至少提前15~20分鐘登島//(準備變異車所需)\n※ 期間不打任何NM(包括KC/蟹蟹/馬王/刻托)\n\n水島夜晚時間表  (大約)\n-------------------------------\n| 輪次  |     開始    結束      集合 (LT)\n${table}-------------------------------\n人員組成\n坦１：\n刀１：\n刀２：\n刀３：\n刀４：\n刀５：\n刀６：\n刀７：\n\n※ 如果隊伍人數有缺將會由支援人員頂上\n※ 如果有人跟車途中離開後想回來，會成為候補支援`;
    }
    navigator.clipboard.writeText(text).then(() => {
        const old = btn.innerText; btn.innerText = "已複製!";
        setTimeout(() => { btn.innerText = old; }, 1200);
    });
}

function searchWeather() {
    const sTime = new Date(document.getElementById("timeStart").value);
    const eTime = new Date(document.getElementById("timeEnd").value);
    const targetR = parseInt(document.getElementById("targetRounds").value);
    const filters = { 
        p: +document.getElementById("pCount").value, 
        h: +document.getElementById("hCount").value, 
        n: +document.getElementById("nCount").value,
        minSnow: +document.getElementById("minSnowCount").value
    };
    const isWorkerMode = document.getElementById("workerMode").checked;

    document.getElementById("results").innerHTML = "<p style='text-align:center'>穿越時空分析中...</p>";
    
    setTimeout(() => {
        const totalToFetch = Math.ceil((eTime - sTime) / (175 * 1000)) + 500;
        const weatherList = weatherSvc.getMultipleWeathers(AREA, totalToFetch, sTime.getTime());
        currentMatches = [];
        
        for (let i = 0; i < weatherList.length - (targetR * 3); i++) {
            const seqStartRaw = new Date(weatherList[i][0]);
            if (getET(seqStartRaw) !== 16) continue;

            // 社畜模式
            if (isWorkerMode) {
                const day = seqStartRaw.getDay(); 
                const hour = seqStartRaw.getHours();
                let isFriendly = false;
                if (day >= 1 && day <= 4) { if (hour >= 19 && hour < 22) isFriendly = true; }
                else if (day === 5) { if (hour >= 19) isFriendly = true; }
                else if (day === 6) { isFriendly = true; }
                else if (day === 0) { if (hour < 22) isFriendly = true; }
                if (!isFriendly) continue;
            }

            let seq = [], c = { p: 0, h: 0, n: 0 }, nightSnowTotal = 0;
            for (let g = 0; g < targetR; g++) {
                const b = i + (g * 3);
                const w16 = weatherList[b][1];  // ET16:00
                const w00 = weatherList[b+1][1]; // ET00:00
                
                // 累加夜晚雪數：只看 16 與 00
                if (w16 === "小雪") nightSnowTotal++;
                if (w00 === "小雪") nightSnowTotal++;

                // 判斷變異組數邏輯
                if (w16 === "小雪" && w00 === "小雪") c.p++; 
                else if (w16 === "小雪" || w00 === "小雪") c.h++; 
                else c.n++;
                
                seq.push({ data: [weatherList[b], weatherList[b+1], weatherList[b+2]] });
            }

            // 同時檢查 變異組數需求 與 夜晚雪數需求
            if (c.p >= filters.p && c.h >= filters.h && c.n >= filters.n && nightSnowTotal >= filters.minSnow) {
                const seqStart = new Date(seq[0].data[0][0]);
                if (seqStart <= eTime) currentMatches.push(seq);
            }
        }

        let html = "";
        currentMatches.forEach((seq, idx) => {
            const info = processSequence(seq);
            let dcClass = "", dcLabel = "";
            html += `<div class="sequence-card ${dcClass}"><div class="card-header"><h3>${info.fullDate} <span>(${info.fullRange})</span>${dcLabel}</h3><div><button class="copy-btn" onclick="copyAction(${idx}, 'title', this)">複製標題</button><button class="copy-btn" onclick="copyAction(${idx}, 'content', this)">複製模板</button></div></div><div class="night-grid">`;
            seq.forEach((round, ri) => {
                html += `<div class="round-row"><div class="round-label">第 ${ri+1} 輪</div>`;
                round.data.forEach(item => {
                    const dt = new Date(item[0]), isS = item[1] === '小雪';
                    html += `<div class="weather-box ${isS?'snow':''}"><strong>(ET${getET(dt).toString().padStart(2,'0')}00)</strong><span class="lt-val">${fmtLT(dt)}</span><span class="ws-val">${item[1]}</span></div>`;
                });
                html += `</div>`;
            });
            html += `</div></div>`;
        });
        document.getElementById("results").innerHTML = html || "<p style='text-align:center'>找不到結果</p>";
    }, 100);
}

window.onload = () => {
    const n = new Date(); const f = new Date(); f.setDate(n.getDate() + 30);
    document.getElementById("timeStart").value = formatDateTime(n);
    document.getElementById("timeEnd").value = formatDateTime(f);
};
