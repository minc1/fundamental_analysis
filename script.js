window.addEventListener('load', () => document.body.classList.add('page-loaded'));
document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    const yearEl = $('currentYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    const revealObserver = new IntersectionObserver((entries, ob) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                ob.unobserve(e.target);
            }
        });
    }, { threshold: 0.12 });
    $$('.reveal').forEach(el => revealObserver.observe(el));
    const menuToggle = $('menuToggle');
    const navLinks = document.querySelector('.nav-links');
    if (menuToggle && navLinks) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', navLinks.classList.contains('open'));
        });
    }
    const tickerInput = $('ticker');
    if (!tickerInput) return;
    const metricsCfg = [
        { id: 'revenue', label: 'Revenue', key: 'revenue', highlight: 'revenue' },
        { id: 'netIncome', label: 'Net Income', key: 'netIncome', highlight: 'netIncome' },
        { id: 'debtEquity', label: 'Debt/Equity', key: 'debtEquity', ratio: true },
        { id: 'freeCashFlow', label: 'Free Cash Flow', key: 'freeCashFlow', highlight: 'freeCF' },
        { id: 'eps', label: 'Diluted EPS', key: 'eps', decimal: true }
    ];
    const metricEls = {};
    const metricYearEls = [];
    (() => {
        const frag = document.createDocumentFragment();
        metricsCfg.forEach(cfg => {
            const card = document.createElement('div');
            card.className = 'metric-card';
            card.innerHTML = `<span class="metric-label">${cfg.label} (<span class="metric-year"></span>)</span><span class="metric-value" id="${cfg.id}">-</span>`;
            frag.appendChild(card);
            metricEls[cfg.id] = card.querySelector(`#${cfg.id}`);
            metricYearEls.push(...card.querySelectorAll('.metric-year'));
        });
        $('metricsContainer').appendChild(frag);
    })();
    const intl0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    const intl2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function currency(v, abbr = false) {
        if (v == null || isNaN(v)) return 'N/A';
        const abs = Math.abs(v);
        let div = 1, suffix = '';
        if (abs >= 1e9) { div = 1e9; suffix = 'B'; }
        else if (abs >= 1e6) { div = 1e6; suffix = 'M'; }
        else if (abbr && abs >= 1e3) { div = 1e3; suffix = 'K'; }
        return '$' + intl0.format(v / div) + suffix;
    }
    const fmt2 = v => (v == null || isNaN(v) ? 'N/A' : intl2.format(v));
    class ChartManager {
        constructor() {
            const css = getComputedStyle(document.documentElement);
            this.palette = [
                css.getPropertyValue('--chart-navy').trim(),
                css.getPropertyValue('--chart-gold').trim(),
                css.getPropertyValue('--chart-gray').trim(),
                css.getPropertyValue('--chart-pastel-gold').trim()
            ];
            this.gridColor = '#6c757d33';
        }
        baseOptions(minVal) {
            return {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: this.gridColor, drawBorder: false },
                        suggestedMin: minVal,
                        ticks: { callback: v => currency(v, true), precision: 0 }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const p = ctx.dataset.label ? ctx.dataset.label + ': ' : '';
                                return p + currency(ctx.raw);
                            }
                        }
                    }
                },
                elements: { line: { tension: 0.4 } }
            };
        }
    }
    const chartMgr = new ChartManager();
    const charts = {};
    function createLineChart({ canvasId, labels, datasets }) {
        charts[canvasId]?.destroy();
        const styled = datasets.map((ds, i) => ({
            ...ds,
            borderColor: chartMgr.palette[i] || chartMgr.palette[0],
            backgroundColor: chartMgr.palette[i] || chartMgr.palette[0],
            borderWidth: i === 0 ? 3 : 2,
            yAxisID: 'y',
            pointRadius: 3,
            pointHoverRadius: 5
        }));
        let maxAbs = 0, minVal = Infinity;
        styled.forEach(d => d.data.forEach(v => {
            const a = Math.abs(v);
            if (a > maxAbs) maxAbs = a;
            if (v < minVal) minVal = v;
        }));
        const ctx = $(canvasId).getContext('2d');
        charts[canvasId] = new Chart(ctx, { type: 'line', data: { labels, datasets: styled }, options: chartMgr.baseOptions(Math.min(minVal, -maxAbs * 0.05)) });
        const header = ctx.canvas.closest('.chart-container').querySelector('.chart-header');
        const legend = header.querySelector('.chart-legend') || header.appendChild(document.createElement('div'));
        legend.className = 'chart-legend';
        legend.innerHTML = styled.map((ds, i) => `<div class="chart-legend-item" data-index="${i}"><span class="chart-legend-color" style="background:${ds.borderColor}"></span>${ds.label}</div>`).join('');
        legend.onclick = e => {
            const item = e.target.closest('.chart-legend-item');
            if (!item) return;
            const idx = +item.dataset.index;
            charts[canvasId].toggleDataVisibility(idx);
            item.classList.toggle('disabled');
            charts[canvasId].update();
        };
    }
    const highlightRules = {
        revenue: v => v > 0 ? 'highlight-positive' : '',
        netIncome: v => v >= 0 ? 'highlight-positive' : 'highlight-negative',
        totalDebt: v => v > 0 ? 'highlight-negative' : '',
        totalEquity: v => v >= 0 ? 'highlight-positive' : 'highlight-negative',
        operatingCF: v => v >= 0 ? 'highlight-positive' : 'highlight-negative',
        freeCF: v => v >= 0 ? 'highlight-positive' : 'highlight-negative'
    };
    function fmtCell(raw, key, formatter = currency) {
        if (raw == null || isNaN(raw)) return 'N/A';
        const baseCls = raw >= 0 ? 'positive-value' : 'negative-value';
        const hl = highlightRules[key]?.(raw) || '';
        return `<span class="${baseCls} ${hl}">${formatter(raw)}</span>`;
    }
    const loadButton = $('loadData');
    const loadingTicker = $('loadingTicker');
    const loadingElm = $('loadingIndicator');
    const dataSection = $('dataContainer');
    const errorElm = $('errorMessage');
    const incomeTableElm = $('incomeTable');
    const balanceTableElm = $('balanceSheetTable');
    const cashTableElm = $('cashFlowTable');
    loadButton.addEventListener('click', loadData);
    tickerInput.addEventListener('keypress', e => { if (e.key === 'Enter') loadData(); });
    async function loadData() {
        const ticker = tickerInput.value.trim().toUpperCase();
        if (!ticker) { showError('Please enter a valid ticker symbol'); return; }
        loadButton.disabled = tickerInput.disabled = true;
        loadingTicker.textContent = ticker;
        loadingElm.style.display = 'flex';
        errorElm.style.display = 'none';
        dataSection.style.display = 'none';
        try {
            const endpoints = ['income_statement_annual','cash_flow_statement_annual','balance_sheet_statement_annual'];
            const [inc, cf, bs] = await Promise.all(endpoints.map(e => fetchJSON(`DATA/${ticker}/${e}.json`)));
            displayData(ticker, inc, cf, bs);
        } catch (err) {
            showError(`Error loading data for ${ticker}: ${err.message}`);
        } finally {
            loadingElm.style.display = 'none';
            loadButton.disabled = tickerInput.disabled = false;
        }
    }
    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Data not found');
        return res.json();
    }
    function displayData(ticker, inc, cf, bs) {
        const sortByYear = (a, b) => a.calendarYear - b.calendarYear;
        [inc, cf, bs].forEach(arr => arr.sort(sortByYear));
        $('companyHeader').textContent = `${ticker} Financial Analysis`;
        const latest = inc.at(-1) || {};
        const latestCash = cf.at(-1) || {};
        const latestBal = bs.at(-1) || {};
        metricYearEls.forEach(el => el.textContent = latest.calendarYear || 'N/A');
        metricEls.revenue.textContent = currency(latest.revenue);
        metricEls.netIncome.textContent = currency(latest.netIncome);
        metricEls.freeCashFlow.textContent = currency(latestCash.freeCashFlow);
        metricEls.debtEquity.textContent = latestBal.totalDebt && latestBal.totalEquity ? fmt2(latestBal.totalDebt / latestBal.totalEquity) : 'N/A';
        metricEls.eps.textContent = fmt2(latest.epsdiluted || latest.eps);
        buildCharts(inc, cf);
        buildTables(inc, cf, bs);
        dataSection.style.display = 'block';
    }
    function buildCharts(inc, cf) {
        const years = inc.map(i => i.calendarYear);
        createLineChart({ canvasId: 'revenueChart', labels: years, datasets: [{ label: 'Revenue', data: inc.map(i => i.revenue) }] });
        createLineChart({ canvasId: 'metricsChart', labels: years, datasets: [{ label: 'Net Income', data: inc.map(i => i.netIncome) }, { label: 'Operating Cash Flow', data: cf.map(i => i.operatingCashFlow) }, { label: 'Free Cash Flow', data: cf.map(i => i.freeCashFlow) }] });
    }
    function tableHTML(headers, rows) {
        const thead = headers.map(h => `<th>${h}</th>`).join('');
        const tbody = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
        return `<table class="financial-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
    }
    function buildTables(inc, cf, bs) {
        const rev = [...inc].reverse();
        const rb = [...bs].reverse();
        const rc = [...cf].reverse();
        incomeTableElm.innerHTML = tableHTML(['Year','Revenue','Gross Profit','Net Income','Diluted EPS','Operating Income'], rev.map(r => [r.calendarYear, fmtCell(r.revenue,'revenue'), currency(r.grossProfit), fmtCell(r.netIncome,'netIncome'), fmt2(r.epsdiluted||r.eps), currency(r.operatingIncome)]));
        balanceTableElm.innerHTML = tableHTML(['Year','Total Assets','Total Debt','Total Equity','Cash','Current Assets'], rb.map(r => [r.calendarYear, currency(r.totalAssets), fmtCell(r.totalDebt,'totalDebt'), fmtCell(r.totalEquity,'totalEquity'), currency(r.cashAndCashEquivalents), currency(r.totalCurrentAssets)]));
        cashTableElm.innerHTML = tableHTML(['Year','Operating CF','Investing CF','Financing CF','Free CF','Net Change'], rc.map(r => [r.calendarYear, fmtCell(r.operatingCashFlow,'operatingCF'), currency(r.netCashUsedForInvestingActivites), currency(r.netCashUsedProvidedByFinancingActivities), fmtCell(r.freeCashFlow,'freeCF'), currency(r.netChangeInCash)]));
    }
    function showError(msg) {
        errorElm.textContent = msg;
        errorElm.style.display = 'block';
    }
});
