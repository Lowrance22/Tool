/* DiscordParser.js - V5.4 Full Post-Space & Label Match */
class DiscordParser {
    constructor() { this.schedule = {}; }

    timeToMin(t) {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    }

    parse(rawText) {
        this.schedule = {};
        if (!rawText) return;

        // 1. 【核心修正】不僅清理標籤，還要優先提取所有 aria-label 的內容
        // 這是為了確保包在屬性裡的標題 (例如 aria-label="貼文 3/27...") 能被獨立出來
        const ariaLabels = [...rawText.matchAll(/aria-label="([^"]*)"/g)].map(m => m[1]);
        const cleanBody = rawText.replace(/<[^>]*>/g, '\n');
        
        // 將屬性內容與本文內容合併掃描
        const allTextLines = [...ariaLabels, ...cleanBody.split('\n')];

        // 2. 定義正則
        // postAnchor: 鎖定「貼文 」關鍵字（含一個或多個空格）
        const postAnchor = /貼文\s+/;
        // dateRegex: 支援 3/7, 03/07, 3月7日, 3.7, 3/27(五)
        const dateRegex = /(\d{1,2})[/\s月.](\d{1,2})/;
        const timeRegex = /(\d{1,2}:\d{2})\s*[~-]\s*(\d{1,2}:\d{2})/g;
        const currentYear = new Date().getFullYear();

        let lastDateKey = null;

        allTextLines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            // A. 如果這行出現「貼文 」
            if (postAnchor.test(trimmedLine)) {
                // 直接在同一行內找尋日期 (相容 3/27, 3月27日 等格式)
                const dMatch = trimmedLine.match(dateRegex);
                if (dMatch) {
                    const month = parseInt(dMatch[1]);
                    const day = parseInt(dMatch[2]);
                    lastDateKey = `${currentYear}/${month}/${day}`;
                    
                    if (!this.schedule[lastDateKey]) {
                        this.schedule[lastDateKey] = [];
                    }
                }
            }

            // B. 只要有定位日期，就開始抓取時間段
            // 注意：Discord 的標題列通常同時包含日期與時間 (如：貼文 3/27 ... 12:53~15:47)
            if (lastDateKey) {
                const tMatches = [...trimmedLine.matchAll(timeRegex)];
                tMatches.forEach(tm => {
                    const rangeStr = `${tm[1]}~${tm[2]}`;
                    
                    // 去重：避免標題與詳細內容重複抓取同一時段
                    const isDuplicate = this.schedule[lastDateKey].some(i => i.raw === rangeStr);
                    if (isDuplicate) return;

                    let start = this.timeToMin(tm[1]);
                    let end = this.timeToMin(tm[2]);

                    // 跨夜處理
                    if (end <= start) end += 1440;

                    this.schedule[lastDateKey].push({ start, end, raw: rangeStr });
                });
            }
        });

        // 3. 最後清理空資料
        Object.keys(this.schedule).forEach(key => {
            if (this.schedule[key].length === 0) delete this.schedule[key];
        });
    }

    hasConflict(fullDateKey, rangeStr) {
        if (!this.schedule[fullDateKey]) return false;
        let [rStart, rEnd] = rangeStr.split('-').map(t => this.timeToMin(t));
        if (rEnd <= rStart) rEnd += 1440;
        return this.schedule[fullDateKey].some(booked => rStart < booked.end && booked.start < rEnd);
    }

    getDebugData() { return this.schedule; }
}
