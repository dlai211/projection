
const LS_KEY = 'vacation-money-manager-v1';
let data = load() || [];

// ---- Helpers ----
function save() { localStorage.setItem(LS_KEY, JSON.stringify(data)); }
function load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }

function fmtDateISO(d){ return new Date(d).toISOString().slice(0,10); }
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }

function upsertRow(dt, item, price, category){
    if(!dt || !item || isNaN(price)) return;
    data.push({ date: fmtDateISO(dt), item: item.trim(), price: +price, category: (category||'').trim() });
    save();
    renderAll();
}

function removeAt(idx){ data.splice(idx,1); save(); renderAll(); }

function groupByDate(entries){
    const map = new Map();
    for(const e of entries){
    if(!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
    }
    return map; // date => [entries]
}

function computeStacks(entries, groupMode='item'){
    // returns { dates: [...], traces: [...], dayTotals: {...} }
    const byDate = groupByDate(entries);
    const dates = Array.from(byDate.keys()).sort();

    // unique groups (items or categories)
    const groups = new Set();
    for(const arr of byDate.values()){
    for(const e of arr){ groups.add(groupMode==='category' ? (e.category||'(uncat)') : e.item); }
    }
    const groupList = Array.from(groups);

    const dayTotals = {}; dates.forEach(d=> dayTotals[d] = 0);

    // build Y per group per date
    const traces = groupList.map(g=>{
    const y = dates.map(d=>{
        const items = byDate.get(d) || [];
        const subtotal = items
        .filter(e => (groupMode==='category' ? (e.category||'(uncat)') : e.item) === g)
        .reduce((acc,e)=>acc+e.price,0);
        dayTotals[d] += subtotal; // this will overcount if repeated per group; so reset later
        return subtotal || 0;
    });
    return { key:g, y };
    });

    // Correct dayTotals (recompute once properly)
    for(const d of dates){
    dayTotals[d] = sum((byDate.get(d)||[]).map(e=>e.price));
    }

    return { dates, traces, dayTotals, groupList };
}

function currency(n){
    return n.toLocaleString(undefined, { style:'currency', currency:'USD', maximumFractionDigits: 2 });
}

function renderChart(){
    const groupMode = document.getElementById('groupMode').value;
    const { dates, traces, dayTotals, groupList } = computeStacks(data, groupMode);

    const plotTraces = traces.map(t=>({
    type: 'bar',
    name: t.key,
    x: dates,
    y: t.y,
    text: t.y.map(v => v ? v.toFixed(2) : ''), // show numbers on each stacked segment
    textposition: 'inside',
    hovertemplate: `${groupMode==='item' ? 'Item' : 'Category'}: <b>%{fullData.name}</b><br>`+
                    `Date: %{x}<br>`+
                    `Price: <b>$%{y:.2f}</b><extra></extra>`
    }));

    // Daily total labels above bars via a scatter trace
    const totalText = dates.map(d=> dayTotals[d] ? currency(dayTotals[d]) : '');
    const totalTrace = {
    type: 'scatter', mode: 'text', name: 'Total',
    x: dates,
    y: dates.map(d=> dayTotals[d] || 0),
    text: totalText,
    textposition: 'top center',
    hoverinfo: 'skip',
    showlegend: false
    };

    const layout = {
    barmode: 'stack',
    xaxis: { title: 'Date', type: 'category', categoryorder: 'category ascending' },
    yaxis: { title: 'Price (USD)' },
    margin: { t: 24, r: 12, b: 48, l: 48 },
    bargap: 0.2,
    plot_bgcolor: '#0b1220',
    paper_bgcolor: '#111827',
    font: { color: '#e5e7eb' },
    };

    const config = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['select2d','lasso2d'] };
    Plotly.newPlot('chart', [...plotTraces, totalTrace], layout, config);

    // Totals badges (overall + by date)
    const overall = currency(sum(data.map(d=>d.price)));
    const badges = [`<span class="badge">Total (all): <b>${overall}</b></span>`]
    .concat(dates.map(d=> `<span class="badge">${d}: <b>${currency(dayTotals[d])}</b></span>`));
    document.getElementById('totalsBar').innerHTML = badges.join(' ');
}

function renderTable(){
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = '';
    data
    .map((e,i)=>({ ...e, idx:i }))
    .sort((a,b)=> a.date.localeCompare(b.date) || a.item.localeCompare(b.item))
    .forEach(({date,item,price,category,idx})=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td><input type="date" value="${date}" data-idx="${idx}" class="cell-date" style="width:100%; background:#0b1220; border:1px solid #334155; color:#e5e7eb; border-radius:8px; padding:6px 8px;"></td>
        <td><input type="text" value="${item.replace(/"/g,'&quot;')}" data-idx="${idx}" class="cell-item" style="width:100%; background:#0b1220; border:1px solid #334155; color:#e5e7eb; border-radius:8px; padding:6px 8px;"></td>
        <td><input type="text" value="${(category||'').replace(/"/g,'&quot;')}" data-idx="${idx}" class="cell-cat" style="width:100%; background:#0b1220; border:1px solid #334155; color:#e5e7eb; border-radius:8px; padding:6px 8px;"></td>
        <td><input type="number" step="0.01" min="0" value="${price}" data-idx="${idx}" class="cell-price" style="width:100%; background:#0b1220; border:1px solid #334155; color:#e5e7eb; border-radius:8px; padding:6px 8px;"></td>
        <td><button class="del" data-idx="${idx}">Del</button></td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('countSpan').textContent = `${data.length} item${data.length===1?'':'s'}`;

    // Wire inline editing
    tbody.querySelectorAll('.cell-date').forEach(el=> el.addEventListener('change', e=>{
    const i = +e.target.dataset.idx; data[i].date = fmtDateISO(e.target.value); save(); renderAll();
    }));
    tbody.querySelectorAll('.cell-item').forEach(el=> el.addEventListener('change', e=>{
    const i = +e.target.dataset.idx; data[i].item = e.target.value.trim(); save(); renderAll();
    }));
    tbody.querySelectorAll('.cell-cat').forEach(el=> el.addEventListener('change', e=>{
    const i = +e.target.dataset.idx; data[i].category = e.target.value.trim(); save(); renderAll();
    }));
    tbody.querySelectorAll('.cell-price').forEach(el=> el.addEventListener('change', e=>{
    const i = +e.target.dataset.idx; data[i].price = +e.target.value; save(); renderAll();
    }));
    tbody.querySelectorAll('.del').forEach(btn=> btn.addEventListener('click', e=> removeAt(+btn.dataset.idx)));
}

function renderAll(){ renderChart(); renderTable(); }

// ---- Export / Import ----
function exportConfig(){
    const blob = new Blob([JSON.stringify({ version:1, entries:data }, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'expenses-config.json'; a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 500);
}

async function importConfig(file){
    if(!file) return;
    const text = await file.text();
    try{
    const obj = JSON.parse(text);
    if(obj && Array.isArray(obj.entries)){
        data = obj.entries.map(e=> ({
        date: fmtDateISO(e.date),
        item: String(e.item||'').trim(),
        price: +e.price || 0,
        category: (e.category||'').trim()
        }));
        save();
        renderAll();
    } else { alert('Invalid config file.'); }
    }catch(err){ alert('Could not parse JSON config.'); }
}

// ---- Events ----
document.getElementById('btnAdd').addEventListener('click', ()=>{
    const d = document.getElementById('inDate').value;
    const it = document.getElementById('inItem').value;
    const p = document.getElementById('inPrice').value;
    const c = document.getElementById('inCategory').value;
    upsertRow(d, it, p, c);
    document.getElementById('inItem').value = '';
    document.getElementById('inPrice').value = '';
});

document.getElementById('groupMode').addEventListener('change', renderAll);

document.getElementById('btnExport').addEventListener('click', exportConfig);
document.getElementById('importFile').addEventListener('change', e=> importConfig(e.target.files[0]));

document.getElementById('btnClear').addEventListener('click', ()=>{
    if(confirm('Clear all items?')){ data = []; save(); renderAll(); }
});

// Init defaults
if(data.length === 0){
    const today = new Date();
    const iso = fmtDateISO(today);
    data = [
    { date: iso, item:'Coffee', price: 4.50, category:'Food' },
    { date: iso, item:'Metro', price: 2.75, category:'Transit' },
    { date: fmtDateISO(new Date(Date.now()-86400000)), item:'Museum', price: 18.00, category:'Activity' },
    ];
    save();
}

// First render
renderAll();