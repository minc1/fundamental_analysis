document.addEventListener('DOMContentLoaded', () => {
    // Show current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    const $ = id => document.getElementById(id);
    const tickerInput       = $('ticker');
    const loadButton        = $('loadData');
    const loadingIndicator  = $('loadingIndicator');
    const loadingTicker     = $('loadingTicker');
    const errorMessage      = $('errorMessage');
    const dataContainer     = $('dataContainer');
    const companyHeader     = $('companyHeader');
    const incomeTable       = $('incomeTable');
    const balanceSheetTable = $('balanceSheetTable');
    const cashFlowTable     = $('cashFlowTable');
    const metricYearEls     = [...document.querySelectorAll('.metric-year')];
    const metricEls = {
        revenue:      $('revenue'),
        netIncome:    $('netIncome'),
        debtEquity:   $('debtEquity'),
        freeCashFlow: $('freeCashFlow'),
        eps:          $('eps'),
    };

    // Central chart config & formatters
    class ChartManager {
        constructor() {
            const css = getComputedStyle(document.documentElement);
            this.palette = [
                css.getPropertyValue('--chart-navy').trim() || '#1c2541',
                css.getPropertyValue('--chart-gold').trim() || '#c5a47e',
                css.getPropertyValue('--chart-gray').trim() || '#6c757d',
                css.getPropertyValue('--chart-pastel-gold').trim() || '#f3e1bb'
            ];
            this.gridColor = '#6c757d33';
            // Cache these for speed
            this.intl0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
            this.intl2 = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        }
        baseOptions(minVal) {
            return {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: {
                            display: true,
                            drawBorder: false,
                            lineWidth: 1,
                            // now draws at every tick
                            color: this.gridColor
                        },
                        suggestedMin: minVal,
                        ticks: {
                            callback: v => this.currency(v, true),
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const prefix = ctx.dataset.label ? ctx.dataset.label + ': ' : '';
                                return prefix + this.currency(ctx.raw);
                            }
                        }
                    }
                },
                elements: { line: { tension: 0.4 } }
            };
        }
        currency(v, abbr = false) {
            if (v == null || isNaN(v)) return 'N/A';
            const abs = Math.abs(v);
            let div = 1, suffix = '';
            if (abs >= 1e9) { div = 1e9; suffix = 'B'; }
            else if (abs >= 1e6) { div = 1e6; suffix = 'M'; }
            else if (abbr && abs >= 1e3) { div = 1e3; suffix = 'K'; }
            return '$' + this.intl0.format(v / div) + suffix;
        }
        formatDecimal(v) {
            if (v == null || isNaN(v)) return 'N/A';
            return this.intl2.format(v);
        }
    }

    const chartMgr = new ChartManager();
    const charts   = {};

    // Build or fetch legend container under a chart-header
    function ensureLegend(containerElem) {
        let legend = containerElem.querySelector('.chart-legend');
        if (!legend) {
            legend = document.createElement('div');
            legend.className = 'chart-legend';
            containerElem.appendChild(legend);
        }
        return legend;
    }

    // DOM-based legend for efficiency & clean event binding
    function buildLegend(chart, legendContainer) {
        legendContainer.innerHTML = '';
        const frag = document.createDocumentFragment();
        chart.data.datasets.forEach((ds, i) => {
            const item = document.createElement('div');
            item.className = 'chart-legend-item';
            item.dataset.index = i;

            const dot = document.createElement('span');
            dot.className = 'chart-legend-color';
            dot.style.background = ds.borderColor;
            item.appendChild(dot);

            item.appendChild(document.createTextNode(ds.label));
            item.addEventListener('click', () => {
                chart.toggleDataVisibility(i);
                item.classList.toggle('disabled');
                chart.update();
            });
            frag.appendChild(item);
        });
        legendContainer.appendChild(frag);
    }

    // Single‐pass min/max and chart instantiation
    function createLineChart({ canvasId, labels, datasets }) {
        if (charts[canvasId]) charts[canvasId].destroy();
        const styled = datasets.map((ds, i) => ({
            label:           ds.label,
            data:            ds.data,
            borderColor:     chartMgr.palette[i] || chartMgr.palette[0],
            backgroundColor: chartMgr.palette[i] || chartMgr.palette[0],
            borderWidth:     i === 0 ? 3 : 2,
            tension:         0.4,
            yAxisID:         'y',
            pointRadius:     3,
            pointHoverRadius:5
        }));

        let maxAbs = 0, minVal = Infinity;
        styled.forEach(d => {
            d.data.forEach(v => {
                const a = Math.abs(v);
                if (a > maxAbs) maxAbs = a;
                if (v < minVal)  minVal = v;
            });
        });
        const suggestedMin = Math.min(minVal, -(maxAbs * 0.05));

        const ctx = $(canvasId).getContext('2d');
        const chart = new Chart(ctx, {
            type:    'line',
            data:    { labels, datasets: styled },
            options: chartMgr.baseOptions(suggestedMin)
        });
        charts[canvasId] = chart;

        const header    = ctx.canvas.closest('.chart-container').querySelector('.chart-header');
        const legendDiv = ensureLegend(header);
        buildLegend(chart, legendDiv);
    }

    function calcDE(bal) {
        if (!bal || bal.totalDebt == null || !bal.totalEquity) return 'N/A';
        return chartMgr.formatDecimal(bal.totalDebt / bal.totalEquity);
    }
    function fmtCur(v) { return chartMgr.currency(v); }

    loadButton.addEventListener('click', loadData);
    tickerInput.addEventListener('keypress', e => { if (e.key === 'Enter') loadData(); });

    async function loadData() {
        const ticker = tickerInput.value.trim().toUpperCase();
        if (!ticker) {
            showError('Please enter a valid ticker symbol');
            return;
        }
        // prevent duplicate fetches
        loadButton.disabled = tickerInput.disabled = true;

        loadingTicker.textContent   = ticker;
        loadingIndicator.style.display = 'flex';
        errorMessage.style.display     = 'none';
        dataContainer.style.display    = 'none';

        try {
            const [inc, cf, bs] = await Promise.all([
                fetchJSON(`${ticker}/income_statement_annual.json`),
                fetchJSON(`${ticker}/cash_flow_statement_annual.json`),
                fetchJSON(`${ticker}/balance_sheet_statement_annual.json`)
            ]);
            displayData(ticker, inc, cf, bs);
        } catch (err) {
            showError(`Error loading data for ${ticker}: ${err.message}`);
        } finally {
            loadingIndicator.style.display = 'none';
            loadButton.disabled = tickerInput.disabled = false;
        }
    }

    async function fetchJSON(path) {
        const res = await fetch(`DATA/${path}`);
        if (!res.ok) throw new Error(`Data not found for ${path.split('/')[0]}`);
        return res.json();
    }

    function displayData(ticker, income, cash, balance) {
        income.sort((a,b) => a.calendarYear - b.calendarYear);
        cash.sort((a,b)   => a.calendarYear - b.calendarYear);
        balance.sort((a,b)=> a.calendarYear - b.calendarYear);

        companyHeader.textContent = `${ticker} Financial Analysis`;
        const latest     = income.at(-1) || {};
        const latestCash = cash.at(-1)   || {};
        const latestBal  = balance.at(-1)|| {};

        metricYearEls.forEach(el => { el.textContent = latest.calendarYear || 'N/A'; });
        metricEls.revenue.textContent      = fmtCur(latest.revenue);
        metricEls.netIncome.textContent    = fmtCur(latest.netIncome);
        metricEls.freeCashFlow.textContent = fmtCur(latestCash.freeCashFlow);
        metricEls.debtEquity.textContent   = calcDE(latestBal);
        metricEls.eps.textContent          = chartMgr.formatDecimal(latest.epsdiluted ?? latest.eps);

        buildCharts(income, cash);
        buildTables(income, cash, balance);

        dataContainer.style.display = 'block';
    }

    function buildCharts(income, cash) {
        const years = income.map(i => i.calendarYear);
        createLineChart({
            canvasId: 'revenueChart',
            labels:   years,
            datasets: [{ label: 'Revenue', data: income.map(i => i.revenue) }]
        });
        createLineChart({
            canvasId: 'metricsChart',
            labels:   years,
            datasets: [
                { label: 'Net Income',           data: income.map(i => i.netIncome) },
                { label: 'Operating Cash Flow',  data: cash.map(i => i.operatingCashFlow) },
                { label: 'Free Cash Flow',       data: cash.map(i => i.freeCashFlow) }
            ]
        });
    }

    function buildTables(inc, cf, bs) {
        incomeTable.innerHTML = createTable(
            ['Year','Revenue','Gross Profit','Net Income','Diluted EPS','Operating Income'],
            inc.map(r => {
                const epsVal = r.epsdiluted ?? r.eps;
                return [
                    r.calendarYear,
                    { value: fmtCur(r.revenue), raw: r.revenue, highlight: 'revenue' },
                    fmtCur(r.grossProfit),
                    { value: fmtCur(r.netIncome), raw: r.netIncome, highlight: 'netIncome' },
                    epsVal != null ? chartMgr.formatDecimal(epsVal) : 'N/A',
                    fmtCur(r.operatingIncome)
                ];
            }).reverse()
        );

        balanceSheetTable.innerHTML = createTable(
            ['Year','Total Assets','Total Debt','Total Equity','Cash','Current Assets'],
            bs.map(r => [
                r.calendarYear,
                fmtCur(r.totalAssets),
                { value: fmtCur(r.totalDebt), raw: r.totalDebt, highlight: 'totalDebt' },
                { value: fmtCur(r.totalEquity), raw: r.totalEquity, highlight: 'totalEquity' },
                fmtCur(r.cashAndCashEquivalents),
                fmtCur(r.totalCurrentAssets)
            ]).reverse()
        );

        cashFlowTable.innerHTML = createTable(
            ['Year','Operating CF','Investing CF','Financing CF','Free CF','Net Change'],
            cf.map(r => [
                r.calendarYear,
                { value: fmtCur(r.operatingCashFlow), raw: r.operatingCashFlow, highlight: 'operatingCF' },
                fmtCur(r.netCashUsedForInvestingActivites),
                fmtCur(r.netCashUsedProvidedByFinancingActivities),
                { value: fmtCur(r.freeCashFlow), raw: r.freeCashFlow, highlight: 'freeCF' },
                fmtCur(r.netChangeInCash)
            ]).reverse()
        );
    }

    function createTable(headers, rows) {
        const head = headers.map(h => `<th>${h}</th>`).join('');
        const body = rows.map(r => {
            const cells = r.map((c,i) => {
                if (i === 0) return `<td>${c ?? 'N/A'}</td>`;
                if (c && typeof c === 'object' && 'value' in c) {
                    const cls = [];
                    if (typeof c.raw === 'number') {
                        cls.push(c.raw >= 0 ? 'positive-value' : 'negative-value');
                        if (c.highlight) {
                            // reuse existing highlight logic
                            if (c.highlight === 'revenue' && c.raw > 0) cls.push('highlight-positive');
                            else if (c.highlight === 'netIncome') cls.push(c.raw >= 0 ? 'highlight-positive' : 'highlight-negative');
                            else if (c.highlight === 'totalDebt' && c.raw > 0) cls.push('highlight-negative');
                            else if (c.highlight === 'totalEquity') cls.push(c.raw >= 0 ? 'highlight-positive' : 'highlight-negative');
                            else if ((c.highlight === 'operatingCF' || c.highlight === 'freeCF')) {
                                cls.push(c.raw >= 0 ? 'highlight-positive' : 'highlight-negative');
                            }
                        }
                    }
                    return `<td><span class="${cls.join(' ')}">${c.value}</span></td>`;
                }
                return `<td>${c ?? 'N/A'}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        return `
            <table class="financial-table">
                <thead><tr>${head}</tr></thead>
                <tbody>${body}</tbody>
            </table>
        `;
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
    }
});
