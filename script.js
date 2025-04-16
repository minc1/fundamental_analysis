document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // DOM elements
    const tickerInput = document.getElementById('ticker');
    const loadButton = document.getElementById('loadData');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingTicker = document.getElementById('loadingTicker');
    const errorMessage = document.getElementById('errorMessage');
    const dataContainer = document.getElementById('dataContainer');
    const companyHeader = document.getElementById('companyHeader');
    const revenueEl = document.getElementById('revenue');
    const netIncomeEl = document.getElementById('netIncome');
    const debtEquityEl = document.getElementById('debtEquity');
    const freeCashFlowEl = document.getElementById('freeCashFlow');
    const chartLegend = document.getElementById('chartLegend');
    const incomeTable = document.getElementById('incomeTable');
    const balanceSheetTable = document.getElementById('balanceSheetTable');
    const cashFlowTable = document.getElementById('cashFlowTable');

    let financialChart = null;
    const chartColors = [
        '#1c2541', // Navy
        '#c5a47e', // Gold
        '#f3e1bb', // Pastel Gold
        '#6c757d', // Gray
        '#212529'  // Dark
    ];

    // Event listeners
    loadButton.addEventListener('click', loadFinancialData);
    tickerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') loadFinancialData();
    });

    // Create chart legend
    function createChartLegend() {
        const labels = [
            'Revenue',
            'Net Income',
            'Operating Cash Flow',
            'Total Debt',
            'Free Cash Flow'
        ];

        chartLegend.innerHTML = labels.map((label, i) => `
            <div class="chart-legend-item">
                <span class="chart-legend-color" style="background-color: ${chartColors[i]}"></span>
                ${label}
            </div>
        `).join('');
    }

    // Main function to load financial data
    async function loadFinancialData() {
        const ticker = tickerInput.value.trim().toUpperCase();

        if (!ticker) {
            showError('Please enter a valid ticker symbol');
            return;
        }

        loadingTicker.textContent = ticker;
        loadingIndicator.style.display = 'flex';
        errorMessage.style.display = 'none';
        dataContainer.style.display = 'none';
        tickerInput.removeAttribute('aria-invalid');

        try {
            const [incomeData, cashFlowData, balanceSheetData] = await Promise.all([
                fetchData(`${ticker}/income_statement_annual.json`),
                fetchData(`${ticker}/cash_flow_statement_annual.json`),
                fetchData(`${ticker}/balance_sheet_statement_annual.json`)
            ]);

            processFinancialData(ticker, incomeData, cashFlowData, balanceSheetData);

        } catch (error) {
            showError(`Error loading data for ${ticker}: ${error.message}`);
            console.error('Error loading financial data:', error);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // Fetch data from DATA folder
    async function fetchData(path) {
        const response = await fetch(`DATA/${path}`);
        if (!response.ok) {
            throw new Error(`Data not found for ${path.split('/')[0]}`);
        }
        return response.json();
    }

    // Process and display the financial data
    function processFinancialData(ticker, incomeData, cashFlowData, balanceSheetData) {
        incomeData.sort((a, b) => a.calendarYear - b.calendarYear);
        cashFlowData.sort((a, b) => a.calendarYear - b.calendarYear);
        balanceSheetData.sort((a, b) => a.calendarYear - b.calendarYear);

        companyHeader.textContent = `${ticker} Financial Analysis`;

        const latestIncome = incomeData[incomeData.length - 1];
        const latestCashFlow = cashFlowData[cashFlowData.length - 1];
        const latestBalanceSheet = balanceSheetData[balanceSheetData.length - 1];

        revenueEl.textContent = formatCurrency(latestIncome.revenue);
        netIncomeEl.textContent = formatCurrency(latestIncome.netIncome);

        if (latestBalanceSheet.totalEquity && latestBalanceSheet.totalEquity > 0) {
            const debtEquityRatio = (latestBalanceSheet.totalDebt / latestBalanceSheet.totalEquity);
            debtEquityEl.textContent = debtEquityRatio.toFixed(2);
        } else {
            debtEquityEl.textContent = 'N/A';
        }

        freeCashFlowEl.textContent = formatCurrency(latestCashFlow.freeCashFlow);

        createFinancialChart(incomeData, cashFlowData, balanceSheetData);
        createFinancialTables(incomeData, cashFlowData, balanceSheetData);
        createChartLegend();
        dataContainer.style.display = 'block';
    }

    // Create the financial chart with intelligent scaling
    function createFinancialChart(incomeData, cashFlowData, balanceSheetData) {
        const years = incomeData.map(item => item.calendarYear);
        const datasets = [
            {
                label: 'Revenue',
                data: incomeData.map(item => item.revenue),
                borderColor: chartColors[0],
                backgroundColor: 'rgba(28, 37, 65, 0.1)',
                pointBackgroundColor: chartColors[0],
                pointBorderColor: chartColors[0],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            },
            {
                label: 'Net Income',
                data: incomeData.map(item => item.netIncome),
                borderColor: chartColors[1],
                backgroundColor: 'rgba(197, 164, 126, 0.1)',
                pointBackgroundColor: chartColors[1],
                pointBorderColor: chartColors[1],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            },
            {
                label: 'Operating Cash Flow',
                data: cashFlowData.map(item => item.operatingCashFlow),
                borderColor: chartColors[2],
                backgroundColor: 'rgba(243, 225, 187, 0.1)',
                pointBackgroundColor: chartColors[2],
                pointBorderColor: chartColors[2],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            },
            {
                label: 'Total Debt',
                data: balanceSheetData.map(item => item.totalDebt),
                borderColor: chartColors[3],
                backgroundColor: 'rgba(108, 117, 125, 0.1)',
                pointBackgroundColor: chartColors[3],
                pointBorderColor: chartColors[3],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            },
            {
                label: 'Free Cash Flow',
                data: cashFlowData.map(item => item.freeCashFlow),
                borderColor: chartColors[4],
                backgroundColor: 'rgba(33, 37, 41, 0.1)',
                pointBackgroundColor: chartColors[4],
                pointBorderColor: chartColors[4],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            }
        ];

        const ctx = document.getElementById('financialChart').getContext('2d');

        // Calculate min/max values for scaling
        const allValues = [
            ...incomeData.map(item => item.revenue),
            ...incomeData.map(item => item.netIncome),
            ...cashFlowData.map(item => item.operatingCashFlow),
            ...balanceSheetData.map(item => item.totalDebt),
            ...cashFlowData.map(item => item.freeCashFlow)
        ].filter(val => val !== undefined && val !== null);

        const maxValue = Math.max(...allValues);
        const minValue = Math.min(...allValues);
        const range = maxValue - minValue;

        // Determine scale steps based on data range
        let stepSize;
        if (range >= 1000000000) {
            stepSize = 500000000;
        } else if (range >= 100000000) {
            stepSize = 100000000;
        } else if (range >= 10000000) {
            stepSize = 10000000;
        } else {
            stepSize = 1000000;
        }

        if (financialChart) {
            financialChart.destroy();
        }

        financialChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: Math.min(0, minValue - (0.1 * range)), // Allow negative values
                        max: maxValue + (0.1 * range),
                        ticks: {
                            callback: formatCurrency,
                            stepSize: stepSize,
                            autoSkip: true,
                            maxTicksLimit: 8
                        },
                        grid: {
                            drawOnChartArea: true,
                            color: function(context) {
                                return context.tick.value === 0 ?
                                    'rgba(0, 0, 0, 0.5)' : // Black dotted line for zero
                                    'rgba(0, 0, 0, 0.05)'; // Light gray for other grid lines
                            },
                            borderDash: function(context) {
                                return context.tick.value === 0 ? [5, 5] : [];
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            padding: 10
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                label += formatCurrency(context.raw);
                                return label;
                            }
                        }
                    },
                    legend: {
                        display: false
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'xy'
                        },
                        zoom: {
                            wheel: {
                                enabled: true
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'xy'
                        }
                    }
                }
            }
        });
    }

    // Create financial tables
    function createFinancialTables(incomeData, cashFlowData, balanceSheetData) {
        incomeTable.innerHTML = createTableHTML(
            ['Year', 'Revenue', 'Gross Profit', 'Net Income', 'EPS', 'Operating Income'],
            incomeData.map(item => [
                item.calendarYear,
                formatCurrency(item.revenue),
                formatCurrency(item.grossProfit),
                formatCurrency(item.netIncome),
                item.eps !== undefined ? item.eps : 'N/A',
                formatCurrency(item.operatingIncome)
            ])
        );

        balanceSheetTable.innerHTML = createTableHTML(
            ['Year', 'Total Assets', 'Total Debt', 'Total Equity', 'Cash', 'Current Assets'],
            balanceSheetData.map(item => [
                item.calendarYear,
                formatCurrency(item.totalAssets),
                formatCurrency(item.totalDebt),
                formatCurrency(item.totalEquity),
                formatCurrency(item.cashAndCashEquivalents),
                formatCurrency(item.totalCurrentAssets)
            ])
        );

        cashFlowTable.innerHTML = createTableHTML(
            ['Year', 'Operating CF', 'Investing CF', 'Financing CF', 'Free CF', 'Net Change'],
            cashFlowData.map(item => [
                item.calendarYear,
                formatCurrency(item.operatingCashFlow),
                formatCurrency(item.netCashUsedForInvestingActivites),
                formatCurrency(item.netCashUsedProvidedByFinancingActivities),
                formatCurrency(item.freeCashFlow),
                formatCurrency(item.netChangeInCash)
            ])
        );
    }

    // Helper function to create table HTML
    function createTableHTML(headers, rows) {
        const headerHTML = headers.map(h => `<th>${h}</th>`).join('');
        const rowHTML = rows.map(row => {
            if (!Array.isArray(row)) {
                console.error("Expected row data to be an array, but received:", row);
                return '';
            }
            const cells = row.map(cell => `<td>${cell !== undefined && cell !== null ? cell : 'N/A'}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        if (!rowHTML) return '<p>No data available to display.</p>';

        return `
            <table>
                <thead><tr>${headerHTML}</tr></thead>
                <tbody>${rowHTML}</tbody>
            </table>
        `;
    }

    // Helper function to format currency values
    function formatCurrency(value) {
        if (value === undefined || value === null) return 'N/A';
        if (typeof value !== 'number') return value;

        const absValue = Math.abs(value);
        let suffix = '';
        let divisor = 1;

        if (absValue >= 1000000000) {
            suffix = 'B';
            divisor = 1000000000;
        } else if (absValue >= 1000000) {
            suffix = 'M';
            divisor = 1000000;
        } else if (absValue >= 1000) {
            suffix = 'K';
            divisor = 1000;
        }

        let minimumFractionDigits = 0;
        let maximumFractionDigits = 0;

        if (absValue/divisor < 10) {
            minimumFractionDigits = 2;
            maximumFractionDigits = 2;
        } else if (absValue/divisor < 100) {
            minimumFractionDigits = 1;
            maximumFractionDigits = 1;
        }

        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits,
            maximumFractionDigits
        });

        let formattedValue = formatter.format(value / divisor);

        if (suffix) {
            formattedValue = formattedValue.replace('$', '');
            return `$${formattedValue}${suffix}`;
        }
        return formattedValue;
    }

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.setAttribute('role', 'alert');
        tickerInput.focus();
        tickerInput.setAttribute('aria-invalid', 'true');

        setTimeout(() => {
            errorMessage.style.display = 'none';
            tickerInput.removeAttribute('aria-invalid');
        }, 5000);
    }
});