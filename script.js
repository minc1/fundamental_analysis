document.addEventListener('DOMContentLoaded', function() {
    const tickerInput = document.getElementById('ticker');
    const loadButton = document.getElementById('loadData');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingTicker = document.getElementById('loadingTicker');
    const errorMessage = document.getElementById('errorMessage');
    const dataContainer = document.getElementById('dataContainer');
    const companyHeader = document.getElementById('companyHeader');
    const tableContainer = document.getElementById('tableContainer');
    
    let financialChart = null;
    
    loadButton.addEventListener('click', loadFinancialData);
    tickerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadFinancialData();
        }
    });
    
    async function loadFinancialData() {
        const ticker = tickerInput.value.trim().toUpperCase();
        
        if (!ticker) {
            showError('Please enter a ticker symbol');
            return;
        }
        
        // Show loading indicator
        loadingTicker.textContent = ticker;
        loadingIndicator.style.display = 'block';
        errorMessage.style.display = 'none';
        dataContainer.style.display = 'none';
        
        try {
            // Fetch data from your server
            const [incomeData, cashFlowData, balanceSheetData] = await Promise.all([
                fetchData(`${ticker}/income_statement_annual.json`),
                fetchData(`${ticker}/cash_flow_statement_annual.json`),
                fetchData(`${ticker}/balance_sheet_statement_annual.json`)
            ]);
            
            // Process and display the data
            displayFinancialData(ticker, incomeData, cashFlowData, balanceSheetData);
            
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            
        } catch (error) {
            loadingIndicator.style.display = 'none';
            showError(error.message);
            console.error('Error loading financial data:', error);
        }
    }
    
    async function fetchData(path) {
        const response = await fetch(`DATA/${path}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch data for ${path.split('/')[0]}`);
        }
        return response.json();
    }
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    
    function displayFinancialData(ticker, incomeData, cashFlowData, balanceSheetData) {
        // Chronological order: oldest first
        incomeData.sort((a, b) => a.calendarYear - b.calendarYear);
        cashFlowData.sort((a, b) => a.calendarYear - b.calendarYear);
        balanceSheetData.sort((a, b) => a.calendarYear - b.calendarYear);
        // Sort data by calendar year (newest first)
        incomeData.sort((a, b) => b.calendarYear - a.calendarYear);
        cashFlowData.sort((a, b) => b.calendarYear - a.calendarYear);
        balanceSheetData.sort((a, b) => b.calendarYear - a.calendarYear);
        
        // Update header
        companyHeader.textContent = `${ticker} - Annual Financial Data`;
        
        // Prepare data for chart
        const years = incomeData.map(item => item.calendarYear);
        const revenue = incomeData.map(item => item.revenue);
        const netIncome = incomeData.map(item => item.netIncome);
        const operatingCashFlow = cashFlowData.map(item => item.operatingCashFlow);
        const totalDebt = balanceSheetData.map(item => item.totalDebt);
        const freeCashFlow = cashFlowData.map(item => item.freeCashFlow);
        // New metrics
        const roe = incomeData.map(item => {
            // ROE = Net Income / Total Equity
            const bs = balanceSheetData.find(b => b.calendarYear === item.calendarYear);
            return (bs && bs.totalEquity) ? (item.netIncome / bs.totalEquity) * 100 : null;
        });
        const debtToEquity = balanceSheetData.map(item => {
            if (item.totalEquity && item.totalEquity !== 0) {
                return item.totalDebt / item.totalEquity;
            }
            return null;
        });
        const eps = incomeData.map(item => item.eps);
        
        // Create or update chart
        const ctx = document.getElementById('financialChart').getContext('2d');
        
        if (financialChart) {
            financialChart.destroy();
        }
        
        financialChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Revenue (USD)',
                        data: revenue,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        borderWidth: 2,
                        tension: 0.1
                    },
                    {
                        label: 'Net Income (USD)',
                        data: netIncome,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        borderWidth: 2,
                        tension: 0.1
                    },
                    {
                        label: 'Operating Cash Flow (USD)',
                        data: operatingCashFlow,
                        borderColor: 'rgba(153, 102, 255, 1)',
                        backgroundColor: 'rgba(153, 102, 255, 0.1)',
                        borderWidth: 2,
                        tension: 0.1
                    },
                    {
                        label: 'Total Debt (USD)',
                        data: totalDebt,
                        borderColor: 'rgba(255, 159, 64, 1)',
                        backgroundColor: 'rgba(255, 159, 64, 0.1)',
                        borderWidth: 2,
                        tension: 0.1
                    },
                    {
                        label: 'Free Cash Flow (USD)',
                        data: freeCashFlow,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        tension: 0.1
                    },
                    {
                        label: 'ROE (%)',
                        data: roe,
                        borderColor: 'rgba(46, 204, 113, 1)',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        borderWidth: 2,
                        tension: 0.1,
                        yAxisID: 'y2',
                    },
                    {
                        label: 'Debt/Equity',
                        data: debtToEquity,
                        borderColor: 'rgba(241, 196, 15, 1)',
                        backgroundColor: 'rgba(241, 196, 15, 0.1)',
                        borderWidth: 2,
                        tension: 0.1,
                        yAxisID: 'y3',
                    },
                    {
                        label: 'EPS',
                        data: eps,
                        borderColor: 'rgba(52, 73, 94, 1)',
                        backgroundColor: 'rgba(52, 73, 94, 0.1)',
                        borderWidth: 2,
                        tension: 0.1,
                        yAxisID: 'y4',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return Number.isInteger(value) ? value : Math.round(value);
                            }
                        },
                        title: { display: true, text: 'USD (Whole Numbers)' }
                    },
                    y2: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { callback: v => v + '%', stepSize: 10 },
                        title: { display: true, text: 'ROE (%)' },
                        display: false
                    },
                    y3: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { stepSize: 0.5 },
                        title: { display: true, text: 'Debt/Equity' },
                        display: false
                    },
                    y4: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'EPS' },
                        display: false
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
                                if (context.dataset.label === 'ROE (%)') {
                                    label += (context.raw !== null ? context.raw.toFixed(2) + '%' : 'N/A');
                                } else if (context.dataset.label === 'Debt/Equity') {
                                    label += (context.raw !== null ? context.raw.toFixed(2) : 'N/A');
                                } else if (context.dataset.label === 'EPS') {
                                    label += (context.raw !== null ? context.raw.toFixed(2) : 'N/A');
                                } else {
                                    label += formatCurrency(context.raw);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
        
        // Create table with all data
        let tableHTML = `
            <table class="financial-table">
                <thead>
                    <tr>
                        <th>Year</th>
                        <th>Revenue</th>
                        <th>Net Income</th>
                        <th>Gross Profit</th>
                        <th>Operating Cash Flow</th>
                        <th>Free Cash Flow</th>
                        <th>Total Debt</th>
                        <th>EPS</th>
                        <th>ROE (%)</th>
                        <th>Debt/Equity</th>
                        <th>Net Margin (%)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (let i = 0; i < incomeData.length; i++) {
            const yearData = incomeData[i];
            const cashFlowYearData = cashFlowData.find(item => item.calendarYear === yearData.calendarYear);
            const balanceSheetYearData = balanceSheetData.find(item => item.calendarYear === yearData.calendarYear);
            const roe = (balanceSheetYearData && balanceSheetYearData.totalEquity) ? (yearData.netIncome / balanceSheetYearData.totalEquity) * 100 : null;
            const debtToEquity = (balanceSheetYearData && balanceSheetYearData.totalEquity && balanceSheetYearData.totalEquity !== 0) ? (balanceSheetYearData.totalDebt / balanceSheetYearData.totalEquity) : null;
            const netMargin = (yearData.revenue && yearData.netIncome) ? (yearData.netIncome / yearData.revenue) * 100 : null;
            
            tableHTML += `
                <tr class="table-row-${i % 2}">
                    <td>${yearData.calendarYear}</td>
                    <td>${formatCurrency(yearData.revenue)}</td>
                    <td class="${yearData.netIncome >= 0 ? 'positive' : 'negative'}">${formatCurrency(yearData.netIncome)}</td>
                    <td>${formatCurrency(yearData.grossProfit)}</td>
                    <td>${cashFlowYearData ? formatCurrency(cashFlowYearData.operatingCashFlow) : 'N/A'}</td>
                    <td>${cashFlowYearData ? formatCurrency(cashFlowYearData.freeCashFlow) : 'N/A'}</td>
                    <td>${balanceSheetYearData ? formatCurrency(balanceSheetYearData.totalDebt) : 'N/A'}</td>
                    <td class="${yearData.eps >= 0 ? 'positive' : 'negative'}">${formatNumber(yearData.eps)}</td>
                    <td>${roe !== null ? roe.toFixed(2) + '%' : 'N/A'}</td>
                    <td>${debtToEquity !== null ? debtToEquity.toFixed(2) : 'N/A'}</td>
                    <td>${netMargin !== null ? netMargin.toFixed(2) + '%' : 'N/A'}</td>
                </tr>
            `;
        }
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        tableContainer.innerHTML = tableHTML;
        
        // Show the data container
        dataContainer.style.display = 'block';
        
        for (let i = 0; i < incomeData.length; i++) {
            const yearData = incomeData[i];
            const cashFlowYearData = cashFlowData.find(item => item.calendarYear === yearData.calendarYear);
            const balanceSheetYearData = balanceSheetData.find(item => item.calendarYear === yearData.calendarYear);
            
            tableHTML += `
                <tr>
                    <td>${yearData.calendarYear}</td>
                    <td>${formatCurrency(yearData.revenue)}</td>
                    <td class="${yearData.netIncome >= 0 ? 'positive' : 'negative'}">${formatCurrency(yearData.netIncome)}</td>
                    <td>${formatCurrency(yearData.grossProfit)}</td>
                    <td>${cashFlowYearData ? formatCurrency(cashFlowYearData.operatingCashFlow) : 'N/A'}</td>
                    <td>${cashFlowYearData ? formatCurrency(cashFlowYearData.freeCashFlow) : 'N/A'}</td>
                    <td>${balanceSheetYearData ? formatCurrency(balanceSheetYearData.totalDebt) : 'N/A'}</td>
                    <td class="${yearData.eps >= 0 ? 'positive' : 'negative'}">${formatNumber(yearData.eps)}</td>
                </tr>
            `;
        }
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        tableContainer.innerHTML = tableHTML;
        
        // Show the data container
        dataContainer.style.display = 'block';
    }
    
    function formatCurrency(value) {
        if (value === undefined || value === null) return 'N/A';
        
        const absValue = Math.abs(value);
        if (absValue >= 1000000000) {
            return `$${(value / 1000000000).toFixed(2)}B`;
        } else if (absValue >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        } else if (absValue >= 1000) {
            return `$${(value / 1000).toFixed(2)}K`;
        }
        return `$${value.toFixed(2)}`;
    }
    
    function formatNumber(value) {
        if (value === undefined || value === null) return 'N/A';
        return value.toFixed(2);
    }
});