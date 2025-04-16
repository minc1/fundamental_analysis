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
    // Updated DOM elements for key metrics
    const revenueEl = document.getElementById('revenue');
    const netIncomeEl = document.getElementById('netIncome');
    const debtEquityEl = document.getElementById('debtEquity');
    const freeCashFlowEl = document.getElementById('freeCashFlow');
    // Chart and table elements remain the same
    const chartLegend = document.getElementById('chartLegend');
    const incomeTable = document.getElementById('incomeTable');
    const balanceSheetTable = document.getElementById('balanceSheetTable');
    const cashFlowTable = document.getElementById('cashFlowTable');

    let financialChart = null;
    const chartColors = [
        '#1c2541', // Navy - Revenue (var(--navy))
        '#c5a47e', // Gold - Net Income (var(--gold))
        '#f3e1bb', // Pastel Gold - Operating Cash Flow (var(--pastel-gold))
        '#6c757d', // Gray - Total Debt (var(--gray-color))
        '#212529'  // Dark - Free Cash Flow (var(--dark-color))
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

        // Show loading state
        loadingTicker.textContent = ticker;
        loadingIndicator.style.display = 'flex';
        errorMessage.style.display = 'none';
        dataContainer.style.display = 'none';

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
        // Sort data by calendar year (oldest first for chart)
        incomeData.sort((a, b) => a.calendarYear - b.calendarYear);
        cashFlowData.sort((a, b) => a.calendarYear - b.calendarYear);
        balanceSheetData.sort((a, b) => a.calendarYear - b.calendarYear);

        // Update company header
        companyHeader.textContent = `${ticker} Financial Analysis`;

        // Get latest year's data
        const latestIncome = incomeData[incomeData.length - 1];
        const latestCashFlow = cashFlowData[cashFlowData.length - 1];
        const latestBalanceSheet = balanceSheetData[balanceSheetData.length - 1];

        // --- Display Key Metrics (using direct data) ---

        // Revenue (Latest Year)
        revenueEl.textContent = formatCurrency(latestIncome.revenue);

        // Net Income (Latest Year)
        netIncomeEl.textContent = formatCurrency(latestIncome.netIncome);

        // Debt/Equity Ratio (Latest Year)
        // Check if totalEquity is positive to avoid division by zero or meaningless ratios
        if (latestBalanceSheet.totalEquity && latestBalanceSheet.totalEquity > 0) {
            const debtEquityRatio = (latestBalanceSheet.totalDebt / latestBalanceSheet.totalEquity);
            debtEquityEl.textContent = debtEquityRatio.toFixed(2);
        } else {
            // Handle cases where equity is zero, negative, or undefined
            debtEquityEl.textContent = 'N/A';
        }

        // Free Cash Flow (Latest Year)
        freeCashFlowEl.textContent = formatCurrency(latestCashFlow.freeCashFlow);

        // --- End Key Metrics ---

        // Create financial chart
        createFinancialChart(incomeData, cashFlowData, balanceSheetData);

        // Create tables
        createFinancialTables(incomeData, cashFlowData, balanceSheetData);

        // Create chart legend
        createChartLegend();

        // Show the data container
        dataContainer.style.display = 'block';
    }

    // Create the financial chart
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
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        },
                        grid: {
                            drawOnChartArea: true
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += formatCurrency(context.raw);
                                return label;
                            }
                        }
                    },
                    legend: {
                        display: false // Using custom legend
                    }
                }
            }
        });
    }

    // Create financial tables
    function createFinancialTables(incomeData, cashFlowData, balanceSheetData) {
        // Income Statement Table
        incomeTable.innerHTML = createTableHTML(
            ['Year', 'Revenue', 'Gross Profit', 'Net Income', 'EPS', 'Operating Income'],
            incomeData.map(item => [
                item.calendarYear,
                formatCurrency(item.revenue),
                formatCurrency(item.grossProfit),
                formatCurrency(item.netIncome),
                item.eps !== undefined ? item.eps : 'N/A', // Handle potential undefined EPS
                formatCurrency(item.operatingIncome)
            ]).reverse() // Display latest year first in table
        );

        // Balance Sheet Table
        balanceSheetTable.innerHTML = createTableHTML(
            ['Year', 'Total Assets', 'Total Debt', 'Total Equity', 'Cash', 'Current Assets'],
            balanceSheetData.map(item => [
                item.calendarYear,
                formatCurrency(item.totalAssets),
                formatCurrency(item.totalDebt),
                formatCurrency(item.totalEquity),
                formatCurrency(item.cashAndCashEquivalents),
                formatCurrency(item.totalCurrentAssets)
            ]).reverse() // Display latest year first in table
        );

        // Cash Flow Table
        cashFlowTable.innerHTML = createTableHTML(
            ['Year', 'Operating CF', 'Investing CF', 'Financing CF', 'Free CF', 'Net Change'],
            cashFlowData.map(item => [
                item.calendarYear,
                formatCurrency(item.operatingCashFlow),
                formatCurrency(item.netCashUsedForInvestingActivites),
                formatCurrency(item.netCashUsedProvidedByFinancingActivities),
                formatCurrency(item.freeCashFlow),
                formatCurrency(item.netChangeInCash)
            ]).reverse() // Display latest year first in table
        );
    }

    // Helper function to create table HTML
    function createTableHTML(headers, rows) {
        const headerHTML = headers.map(h => `<th>${h}</th>`).join('');

        const rowHTML = rows.map(row => {
            // Ensure row is an array before mapping
            if (!Array.isArray(row)) {
                console.error("Expected row data to be an array, but received:", row);
                return ''; // Skip this row or handle appropriately
            }
            const cells = row.map(cell => `<td>${cell !== undefined && cell !== null ? cell : 'N/A'}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        // Check if there are rows to display
        if (!rowHTML) {
            return '<p>No data available to display.</p>';
        }

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
        // Check if it's already formatted (like EPS which might be a simple number)
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
            // Optional: Add K for thousands if desired
            // suffix = 'K';
            // divisor = 1000;
        }

        // Use Intl.NumberFormat for better localization and formatting
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD', // Assuming USD, adjust if needed
            minimumFractionDigits: divisor === 1 ? 0 : 2, // No decimals for raw numbers, 2 for B/M/K
            maximumFractionDigits: divisor === 1 ? 0 : 2
        });

        // Format the divided value, then manually append the suffix if needed
        let formattedValue = formatter.format(value / divisor);

        // Remove the currency symbol added by Intl.NumberFormat if we add a suffix
        if (suffix) {
             formattedValue = formattedValue.replace('$', ''); // Adjust if currency symbol is different
             return `$${formattedValue}${suffix}`;
        } else {
            return formattedValue; // Return the fully formatted value with currency symbol
        }
    }


    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    // Initial setup calls if any (e.g., pre-load default ticker?)
    // Currently none needed based on the flow.
});