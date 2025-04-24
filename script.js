document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    
    // --- App State --- 
    // Encapsulated application state instead of using window.financialData
    const appState = {
        ticker: null,
        income: [],
        cashflow: [],
        balance: [],
        sortedIncome: [],
        sortedCashflow: [],
        sortedBalance: [],
        get latestIncome() { return this.sortedIncome[0] || {}; },
        get latestCashflow() { return this.sortedCashflow[0] || {}; },
        get latestBalance() { return this.sortedBalance[0] || {}; },
    };
    
    // Setup export button event listeners
    function setupExportButtons() {
        $$('.export-btn').forEach(btn => {
            // Pass appState to exportData (exportData itself will be refactored later)
            btn.addEventListener('click', () => exportData(btn.dataset.export, appState)); 
        });
    }
    
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
        const links = navLinks.querySelectorAll('.nav-link');
        links.forEach(link => link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
        }));
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
                elements: { line: { tension: 0.35 } }
            };
        }
    }
    const chartMgr = new ChartManager();
    const charts = {};
    // Plugin: ensure 'Net Income' points draw above other datasets
    const netIncomePointPlugin = {
        id: 'netIncomePointPlugin',
        afterDatasetsDraw(chart) {
            // find Net Income series and redraw its line and points on top
            const idx = chart.data.datasets.findIndex(ds => ds.label === 'Net Income');
            if (idx < 0) return;
            const meta = chart.getDatasetMeta(idx);
            // redraw line path above others
            meta.dataset.draw(chart.ctx);
            // redraw points above all
            meta.data.forEach(point => point.draw(chart.ctx));
        }
    };
    Chart.register(netIncomePointPlugin);
    function hexToRGBA(hex, alpha) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(h => h + h).join('');
        const r = parseInt(c.substr(0, 2), 16);
        const g = parseInt(c.substr(2, 2), 16);
        const b = parseInt(c.substr(4, 2), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    function createLineChart({ canvasId, labels, datasets }) {
        charts[canvasId]?.destroy();
        // Style datasets: primary (navy) most prominent with highest order and stronger fill
        const styled = datasets.map((ds, i) => {
            const baseColor = chartMgr.palette[i] || chartMgr.palette[0];
            const alpha = i === 0 ? 0.25 : 0.07;
            
            // Create gradient for all datasets
            let fill = {
                target: 'origin',
                above: (ctx) => {
                    const chart = ctx.chart;
                    const {ctx: context, chartArea} = chart;
                    if (!chartArea) return null;
                    
                    const gradient = context.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, hexToRGBA(baseColor, 0));
                    gradient.addColorStop(0.5, hexToRGBA(baseColor, 0.15));
                    gradient.addColorStop(1, hexToRGBA(baseColor, 0.3));
                    return gradient;
                },
                below: (ctx) => {
                    const chart = ctx.chart;
                    const {ctx: context, chartArea} = chart;
                    if (!chartArea) return null;
                    
                    const gradient = context.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, hexToRGBA('#d9534f', 0));
                    gradient.addColorStop(0.5, hexToRGBA('#d9534f', 0.15));
                    gradient.addColorStop(1, hexToRGBA('#d9534f', 0.3));
                    return gradient;
                }
            };
            
            return {
                ...ds,
                borderColor: baseColor,
                pointBackgroundColor: baseColor,
                borderWidth: i === 0 ? 3 : 2,
                yAxisID: 'y',
                pointRadius: 2,
                pointHoverRadius: 5,
                fill,
                order: datasets.length - i
            };
        });
        let maxAbs = 0, minVal = Infinity;
        styled.forEach(d => d.data.forEach(v => {
            const a = Math.abs(v);
            if (a > maxAbs) maxAbs = a;
            if (v < minVal) minVal = v;
        }));
        // If no metrics below zero, start y-axis at 0, else provide slight negative padding
        const yMin = minVal >= 0 ? 0 : Math.min(minVal, -maxAbs * 0.05);
        const ctx = $(canvasId).getContext('2d');
        const chart = new Chart(ctx, { type: 'line', data: { labels, datasets: styled }, options: chartMgr.baseOptions(yMin) });
        // Redraw primary (navy) dataset points on top of all lines
        chart.getDatasetMeta(0).data.forEach(point => point.draw(chart.ctx));
        charts[canvasId] = chart;
        const header = ctx.canvas.closest('.chart-container').querySelector('.chart-header');
        const legend = header.querySelector('.chart-legend') || header.appendChild(document.createElement('div'));
        legend.className = 'chart-legend';
        // Order legend items by dataset.order descending so primary (navy) is on the left
        const legendItems = styled.map((ds, i) => ({ ds, idx: i })).sort((a, b) => b.ds.order - a.ds.order);
        legend.innerHTML = legendItems.map(item => `<div class="chart-legend-item" data-index="${item.idx}"><span class="chart-legend-color" style="background:${item.ds.borderColor}"></span>${item.ds.label}</div>`).join('');
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
    function fmtCell(raw, key, formatter = currency, includeHtml = true) {
        if (raw == null || isNaN(raw)) return 'N/A';
        const val = formatter(raw);
        const rule = highlightRules[key];
        const cls = rule ? rule(raw) : '';
        return includeHtml && cls ? `<span class="value ${cls}">${val}</span>` : val;
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
        setState('loading', ticker); // Use new state manager
        try {
            const endpoints = ['income_statement_annual','cash_flow_statement_annual','balance_sheet_statement_annual'];
            const [inc, cf, bs] = await Promise.all(endpoints.map(e => fetchJSON(`DATA/${ticker}/${e}.json`)));
            updateAndDisplayData(ticker, inc, cf, bs); // Call new state update function
            setState('dataReady'); // Use new state manager
        } catch (err) {
            setState('error', `Failed to load data for ${ticker}. Please check the ticker symbol.`); // Use new state manager
        } finally {
            // UI state managed by setState
        }
    }
    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Data not found');
        return res.json();
    }
    
    // Updates appState and triggers UI updates
    function updateAndDisplayData(ticker, inc, cf, bs) {
        // Update raw data in state
        appState.ticker = ticker;
        appState.income = inc;
        appState.cashflow = cf;
        appState.balance = bs;
        
        // --- Single Sort (Descending: most recent year first) ---
        const sortByYearDesc = (a, b) => b.calendarYear - a.calendarYear;
        appState.sortedIncome = [...inc].sort(sortByYearDesc);
        appState.sortedCashflow = [...cf].sort(sortByYearDesc);
        appState.sortedBalance = [...bs].sort(sortByYearDesc);
        
        $('companyHeader').textContent = `${ticker} Financial Analysis`;
        
        // --- Update Metrics from State (using getters for latest based on descending sort) ---
        const latestIncome = appState.latestIncome;
        const latestCash = appState.latestCashflow;
        const latestBal = appState.latestBalance;
        
        metricYearEls.forEach(el => el.textContent = latestIncome.calendarYear || 'N/A');
        metricEls.revenue.textContent = currency(latestIncome.revenue);
        metricEls.netIncome.textContent = currency(latestIncome.netIncome);
        metricEls.freeCashFlow.textContent = currency(latestCash.freeCashFlow); // Use latestCashflow getter
        metricEls.debtEquity.textContent = latestBal.totalDebt && latestBal.totalEquity ? fmt2(latestBal.totalDebt / latestBal.totalEquity) : 'N/A';
        metricEls.eps.textContent = fmt2(latestIncome.epsdiluted || latestIncome.eps);
        
        // Call builders with sorted data from state
        buildTables(appState.sortedIncome, appState.sortedCashflow, appState.sortedBalance);
        buildCharts(appState.sortedIncome, appState.sortedCashflow); // buildCharts will be refactored next
        
        // Set SEC filing link from latest income statement
        const secLinkEl = $('secLink');
        if (latestIncome.finalLink) {
            secLinkEl.href = latestIncome.finalLink;
            secLinkEl.textContent = `View ${latestIncome.calendarYear || 'Latest'} SEC Filing`;
        } else {
            secLinkEl.href = '#';
            secLinkEl.textContent = 'SEC Filing Unavailable';
        }
        
        // Setup export buttons now data is ready
        setupExportButtons(); 
    }
    
    // Build tables using sorted data (most recent first)
    function buildTables(sortedIncome, sortedCashflow, sortedBalance) {
        // --- Data Transformation Functions ---
        // Returns { headers: [...], rows: [[...], [...]] }
        function getFormattedIncomeData(sortedInc, includeHtml = true) {
            const headers = ['Year','Revenue','Gross Profit','Net Income','Diluted EPS','Operating Income'];
            const rows = sortedInc.map(r => [
                r.calendarYear, 
                fmtCell(r.revenue,'revenue', currency, includeHtml), 
                currency(r.grossProfit), 
                fmtCell(r.netIncome,'netIncome', currency, includeHtml), 
                fmt2(r.epsdiluted || r.eps), 
                currency(r.operatingIncome)
            ]);
            return { headers, rows };
        }

        function getFormattedBalanceData(sortedBalance, includeHtml = true) {
            const headers = ['Year','Total Assets','Total Debt','Total Equity','Cash','Current Assets'];
            const rows = sortedBalance.map(r => [
                r.calendarYear, 
                currency(r.totalAssets), 
                fmtCell(r.totalDebt,'totalDebt', currency, includeHtml), 
                fmtCell(r.totalEquity,'totalEquity', currency, includeHtml), 
                currency(r.cashAndCashEquivalents), 
                currency(r.totalCurrentAssets)
            ]);
            return { headers, rows };
        }

        function getFormattedCashflowData(sortedCashflow, includeHtml = true) {
            const headers = ['Year','Operating CF','Investing CF','Financing CF','Free CF','Net Change'];
            const rows = sortedCashflow.map(r => [
                r.calendarYear, 
                fmtCell(r.operatingCashFlow,'operatingCF', currency, includeHtml), 
                currency(r.netCashUsedForInvestingActivites), 
                currency(r.netCashUsedProvidedByFinancingActivities), 
                fmtCell(r.freeCashFlow,'freeCF', currency, includeHtml), 
                currency(r.netChangeInCash)
            ]);
            return { headers, rows };
        }

        function getFormattedKeyMetricsData(sortedBalance, sortedIncome, sortedCashflow, includeHtml = true) {
            const headers = ['Year', 'Current Ratio', 'Interest Coverage', 'Return on Equity', 'Profit Margin', 'FCF/Revenue'];
            const rows = sortedBalance.map((r, i) => {
                const incomeData = sortedIncome[i] || {};
                const cashData = sortedCashflow[i] || {};
                
                const currentRatio = r.totalCurrentAssets && r.totalCurrentLiabilities ? 
                    r.totalCurrentAssets / r.totalCurrentLiabilities : null;
                const interestCoverage = incomeData.operatingIncome && incomeData.interestExpense && 
                                       incomeData.interestExpense !== 0 ? 
                    incomeData.operatingIncome / Math.abs(incomeData.interestExpense) : null;
                const returnOnEquity = incomeData.netIncome && r.totalStockholdersEquity ? 
                    incomeData.netIncome / r.totalStockholdersEquity : null;
                const profitMargin = incomeData.netIncome && incomeData.revenue ? 
                    incomeData.netIncome / incomeData.revenue : null;
                const fcfRevenue = cashData.freeCashFlow && incomeData.revenue ? 
                    cashData.freeCashFlow / incomeData.revenue : null;

                // Apply formatting (HTML not needed here as fmtCell handles it if includeHtml is true)
                const fmtRatio = v => v ? fmt2(v) : 'N/A';
                const fmtPercent = v => v ? fmt2(v * 100) + '%' : 'N/A';
                const fmtCoverage = v => v ? fmt2(v) + 'x' : 'N/A';

                return [
                    r.calendarYear,
                    fmtRatio(currentRatio),
                    fmtCoverage(interestCoverage),
                    fmtPercent(returnOnEquity),
                    fmtPercent(profitMargin),
                    fmtPercent(fcfRevenue)
                ];
            });
            return { headers, rows };
        }

        // --- Use Transformers to Build Tables ---
        const incomeData = getFormattedIncomeData(sortedIncome, true);
        incomeTableElm.innerHTML = tableHTML(incomeData.headers, incomeData.rows);

        const balanceData = getFormattedBalanceData(sortedBalance, true);
        balanceTableElm.innerHTML = tableHTML(balanceData.headers, balanceData.rows);

        const cashflowData = getFormattedCashflowData(sortedCashflow, true);
        cashTableElm.innerHTML = tableHTML(cashflowData.headers, cashflowData.rows);
        
        const keyMetricsTable = $('keyMetricsTable');
        if (keyMetricsTable) {
            const keyMetricsData = getFormattedKeyMetricsData(sortedBalance, sortedIncome, sortedCashflow, true);
            keyMetricsTable.innerHTML = tableHTML(keyMetricsData.headers, keyMetricsData.rows);
        }
    }
    
    // Build charts using sorted data (most recent first)
    function buildCharts(sortedInc, sortedCf) {
        // Charts expect data oldest to newest, so reverse the sorted (desc) data
        const reversedInc = [...sortedInc].reverse();
        const reversedCf = [...sortedCf].reverse();
        const years = reversedInc.map(i => i.calendarYear); 
        
        createLineChart({ 
            canvasId: 'revenueChart', 
            labels: years, 
            datasets: [{ label: 'Revenue', data: reversedInc.map(i => i.revenue) }] 
        });
        createLineChart({ 
            canvasId: 'metricsChart', 
            labels: years, 
            datasets: [
                { label: 'Net Income', data: reversedInc.map(i => i.netIncome) },
                { label: 'Operating Cash Flow', data: reversedCf.map(i => i.operatingCashFlow) },
                { label: 'Free Cash Flow', data: reversedCf.map(i => i.freeCashFlow) }
            ] 
        });
    }
    
    function tableHTML(headers, rows) {
        const thead = headers.map(h => `<th>${h}</th>`).join('');
        const tbody = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
        return `<table class="financial-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
    }
    
    // --- UI State Management ---
    function setState(state, payload = null) {
        // Reset all potentially active elements
        loadingElm.style.display = 'none';
        errorElm.style.display = 'none';
        dataSection.style.display = 'none';
        loadButton.disabled = tickerInput.disabled = false; 

        switch(state) {
            case 'initial':
                tickerInput.focus();
                break;
            case 'loading':
                loadingTicker.textContent = payload; // ticker symbol
                loadingElm.style.display = 'block'; 
                loadButton.disabled = tickerInput.disabled = true;
                break;
            case 'dataReady':
                dataSection.style.display = 'block';
                break;
            case 'error':
                errorElm.textContent = payload; // error message
                errorElm.style.display = 'block';
                break;
        }
    }
    
    // CSV Export functionality
    // Accepts state object - Will be refactored next
    function exportData(type, state) { 
        if (!state || !state.ticker || !state.sortedIncome.length) {
            console.warn('Export called with invalid state');
            return;
        }
        
        const ticker = state.ticker;
        let csvData = { headers: [], rows: [] };
        let filename;
        
        switch(type) {
            // Removed chart export cases as requested
                
            case 'income':
                csvData = getFormattedIncomeData(state.sortedIncome, false); // Request no HTML
                filename = `${ticker}_income_statement.csv`;
                break;
                
            case 'balance':
                csvData = getFormattedBalanceData(state.sortedBalance, false); // Request no HTML
                filename = `${ticker}_balance_sheet.csv`;
                break;
                
            case 'cashflow':
                csvData = getFormattedCashflowData(state.sortedCashflow, false); // Request no HTML
                filename = `${ticker}_cash_flow.csv`;
                break;
                
            case 'keymetrics':
                csvData = getFormattedKeyMetricsData(state.sortedBalance, state.sortedIncome, state.sortedCashflow, false); // Request no HTML
                filename = `${ticker}_key_metrics.csv`;
                break;
                
            default:
                return;
        }
        
        // Convert to CSV and download
        if (filename && csvData.headers.length > 0) {
            downloadCSV(csvData.headers, csvData.rows, filename);
        }
    }
    
    function downloadCSV(headers, data, filename) {
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        // Add data rows
        csvContent += data.map(row => 
            row.map(cell => 
                cell === null || cell === undefined ? '' : String(cell)
            ).join(',')
        ).join('\n');
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Initial state setup
    setState('initial');
});

function setupSearchPage() {
    const form = document.getElementById('searchForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const ticker = document.getElementById('searchTicker').value.trim().toUpperCase();
        if (!ticker) return;
        window.location.href = `analyzer.html?ticker=${encodeURIComponent(ticker)}`;
    });
}
document.addEventListener('DOMContentLoaded', setupSearchPage);

(function() {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('ticker');
    if (t) {
        const input = document.getElementById('ticker');
        if (input) {
            input.value = t;
            window.addEventListener('load', () => {
                document.getElementById('loadData')?.click();
            });
        }
    }
})();