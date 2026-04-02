const BASE_URL = 'http://openapi.seoul.go.kr:8088';
const SERVICE_NAME = 'tbLnOpendataRtmsV';
const API_KEY = '61656e5a47646f6537336b64774647';
const DEFAULT_ITEMS_PER_PAGE = 10;
const FILTERED_ITEMS_PER_PAGE = 500; // Increased for better graphing
const PROXY_URL = 'https://api.allorigins.win/raw?url='; // Use HTTPS Proxy to avoid Mixed Content

let currentPage = 1;

// Helper to fetch through proxy
async function fetchWithProxy(url) {
    const proxiedUrl = `${PROXY_URL}${encodeURIComponent(url)}`;
    const response = await fetch(proxiedUrl);
    return response;
}
let currentSearchFilters = {
    cggNm: '',
    stdgNm: '',
    bldgUsg: '아파트',
    areaRange: '',
    bldgNm: ''
};

let priceChart = null;

// DOM Elements
const searchForm = document.getElementById('searchForm');
const resultBody = document.getElementById('resultBody');
const resultInfo = document.getElementById('resultInfo');
const totalCountBadge = document.getElementById('totalCount');
const paginationNav = document.getElementById('paginationNav');
const pagination = document.getElementById('pagination');
const loading = document.getElementById('loading');
const graphSection = document.getElementById('graphSection');
const cggNmSelect = document.getElementById('cggNm');
const stdgNmSelect = document.getElementById('stdgNm');
const bldgNmSelect = document.getElementById('bldgNm');

// Event Listeners
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentPage = 1;
    updateFilters();
    fetchRealPriceData();
});

cggNmSelect.addEventListener('change', () => {
    const selectedDistrict = cggNmSelect.value;
    updateNeighborhoodOptions(selectedDistrict);
    // Reset building names
    updateBuildingOptions([]);
});

stdgNmSelect.addEventListener('change', () => {
    const district = cggNmSelect.value;
    const neighborhood = stdgNmSelect.value;
    if (district && neighborhood) {
        fetchBuildingNames(district, neighborhood);
    } else {
        updateBuildingOptions([]);
    }
});

function updateNeighborhoodOptions(district) {
    stdgNmSelect.innerHTML = '<option value="">전체</option>';
    
    if (district && SEOUL_DISTRICTS[district]) {
        SEOUL_DISTRICTS[district].forEach(neighborhood => {
            const option = document.createElement('option');
            option.value = neighborhood;
            option.textContent = neighborhood;
            stdgNmSelect.appendChild(option);
        });
    } else {
        stdgNmSelect.innerHTML = '<option value="">자치구 선택</option>';
        updateBuildingOptions([]);
    }
}

async function fetchBuildingNames(district, neighborhood) {
    bldgNmSelect.innerHTML = '<option value="">데이터 로딩 중...</option>';
    bldgNmSelect.disabled = true;

    const startIndex = 1;
    const endIndex = 1000; 
    
    const url = `${BASE_URL}/${API_KEY}/json/${SERVICE_NAME}/${startIndex}/${endIndex}/ / /${encodeURIComponent(district)}`;
    
    try {
        const response = await fetchWithProxy(url);
        const data = await response.json();
        
        if (data[SERVICE_NAME] && data[SERVICE_NAME].row) {
            const filteredRows = data[SERVICE_NAME].row.filter(r => r.STDG_NM === neighborhood);
            const uniqueBldgs = [...new Set(filteredRows.map(r => r.BLDG_NM))].sort();
            updateBuildingOptions(uniqueBldgs);
        } else {
            updateBuildingOptions([]);
        }
    } catch (error) {
        console.error('Fetch building names error:', error);
        updateBuildingOptions([]);
    } finally {
        bldgNmSelect.disabled = false;
    }
}

function updateBuildingOptions(buildings) {
    if (buildings.length === 0) {
        bldgNmSelect.innerHTML = '<option value="">법정동 선택</option>';
        return;
    }

    let html = '<option value="">전체</option>';
    buildings.forEach(bldg => {
        if (bldg) {
            html += `<option value="${bldg}">${bldg}</option>`;
        }
    });
    bldgNmSelect.innerHTML = html;
}

document.getElementById('resetBtn').addEventListener('click', () => {
    setTimeout(() => {
        currentPage = 1;
        updateFilters();
        updateNeighborhoodOptions(''); // Reset neighborhood select
        updateBuildingOptions([]); // Reset building select
        resultBody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">조회하기 버튼을 눌러 데이터를 불러오세요.</td></tr>`;
        resultInfo.classList.add('d-none');
        paginationNav.classList.add('d-none');
        if (priceChart) priceChart.destroy();
        graphSection.classList.add('d-none');
    }, 10);
});

function updateFilters() {
    currentSearchFilters = {
        cggNm: document.getElementById('cggNm').value,
        stdgNm: document.getElementById('stdgNm').value,
        bldgUsg: '아파트',
        areaRange: document.getElementById('areaRange').value,
        bldgNm: document.getElementById('bldgNm').value
    };
}

// Initial fetch on load
window.addEventListener('DOMContentLoaded', () => {
    // Set default view to Gangnam or empty
    fetchRealPriceData();
});

async function fetchRealPriceData() {
    const key = API_KEY;
    // If we have filters, we want more data for the graph
    const isFiltered = currentSearchFilters.cggNm || currentSearchFilters.stdgNm || currentSearchFilters.bldgNm || currentSearchFilters.areaRange;
    const limit = isFiltered ? FILTERED_ITEMS_PER_PAGE : DEFAULT_ITEMS_PER_PAGE;
    
    const startIndex = (currentPage - 1) * limit + 1;
    const endIndex = currentPage * limit;

    let url = `${BASE_URL}/${key}/json/${SERVICE_NAME}/${startIndex}/${endIndex}`;
    
    // Add optional parameters if they exist
    // Order: RCPT_YR/CGG_CD/CGG_NM/STDG_CD/LOTNO_SE/LOTNO_SE_NM/MNO/SNO/BLDG_NM/CTRT_DAY/BLDG_USG
    const params = [
        ' ', // RCPT_YR
        ' ', // CGG_CD
        currentSearchFilters.cggNm || ' ', 
        ' ', // STDG_CD
        ' ', // LOTNO_SE
        ' ', // LOTNO_SE_NM
        ' ', // MNO
        ' ', // SNO
        currentSearchFilters.bldgNm || ' ', // BLDG_NM (Position 11)
        ' ', // CTRT_DAY
        currentSearchFilters.bldgUsg || ' '  
    ];

    // Find the last index that is not a space to trim the URL
    let lastIndex = -1;
    for (let i = params.length - 1; i >= 0; i--) {
        if (params[i] !== ' ') {
            lastIndex = i;
            break;
        }
    }

    if (lastIndex !== -1) {
        const processedParams = params.slice(0, lastIndex + 1).map(p => encodeURIComponent(p));
        url += `/${processedParams.join('/')}`;
    }

    showLoading(true);
    
    try {
        console.log('Fetching URL through proxy:', url);
        const response = await fetchWithProxy(url);
        const text = await response.text();
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            if (text.includes('<RESULT>')) {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, "text/xml");
                const code = xmlDoc.getElementsByTagName("CODE")[0]?.textContent;
                const message = xmlDoc.getElementsByTagName("MESSAGE")[0]?.textContent;
                renderError(message || '데이터를 불러오는 중 오류가 발생했습니다.');
            } else {
                renderError('서버에서 올바르지 않은 응답을 보냈습니다.');
            }
            return;
        }

        if (data[SERVICE_NAME]) {
            const totalCount = data[SERVICE_NAME].list_total_count;
            let rows = data[SERVICE_NAME].row;
            
            // Client-side filtering for STDG_NM (Neighborhood)
            if (currentSearchFilters.stdgNm) {
                rows = rows.filter(row => row.STDG_NM.includes(currentSearchFilters.stdgNm));
            }

            // Client-side filtering for BLDG_NM (Building Name)
            if (currentSearchFilters.bldgNm) {
                const searchName = currentSearchFilters.bldgNm.trim();
                rows = rows.filter(row => (row.BLDG_NM || '').trim() === searchName);
            }

            // Client-side filtering for Area Range
            if (currentSearchFilters.areaRange) {
                rows = rows.filter(row => {
                    const area = parseFloat(row.ARCH_AREA);
                    if (currentSearchFilters.areaRange === 'small') return area <= 60;
                    if (currentSearchFilters.areaRange === 'medium') return area > 60 && area <= 85;
                    if (currentSearchFilters.areaRange === 'large') return area > 85;
                    return true;
                });
            }

            renderTable(rows);
            renderPagination(totalCount, currentPage, limit);
            renderChart(rows);

            totalCountBadge.textContent = `총 ${totalCount.toLocaleString()}건 (현재 ${rows.length}건 표시)`;
            resultInfo.classList.remove('d-none');
            paginationNav.classList.remove('d-none');
        } else if (data.RESULT && data.RESULT.CODE === 'INFO-200') {
            renderNoData();
            if (priceChart) priceChart.destroy();
            graphSection.classList.add('d-none');
        } else {
            renderError(data.RESULT ? data.RESULT.MESSAGE : '오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        renderError('서버와의 통신 중 오류가 발생했습니다.');
    } finally {
        showLoading(false);
    }
}

function renderChart(rows) {
    if (!rows || rows.length === 0) {
        graphSection.classList.add('d-none');
        return;
    }

    graphSection.classList.remove('d-none');

    // Filter for the last 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Prepare data: Sort by date
    const chartData = rows
        .map(row => ({
            x: formatDate(row.CTRT_DAY),
            y: parseInt(row.THING_AMT),
            name: row.BLDG_NM,
            dateObj: new Date(formatDate(row.CTRT_DAY))
        }))
        .filter(d => d.dateObj >= oneYearAgo) // Filter for last 1 year
        .sort((a, b) => a.dateObj - b.dateObj);

    if (chartData.length === 0) {
        graphSection.classList.add('d-none');
        return;
    }

    const ctx = document.getElementById('priceChart').getContext('2d');
    
    if (priceChart) {
        priceChart.destroy();
    }

    priceChart = new Chart(ctx, {
         type: 'line',
         data: {
             labels: chartData.map(d => d.x),
             datasets: [{
                 label: '실거래가 (만원) - 최근 1년',
                 data: chartData.map(d => d.y),
                 borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataPoint = chartData[context.dataIndex];
                            return `${dataPoint.name}: ${dataPoint.y.toLocaleString()}만원`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + '만';
                        }
                    }
                }
            }
        }
    });
}

function renderTable(rows) {
    if (!rows || rows.length === 0) {
        renderNoData();
        return;
    }

    resultBody.innerHTML = rows.map(row => `
        <tr>
            <td>${formatDate(row.CTRT_DAY)}</td>
            <td>${row.CGG_NM}</td>
            <td>${row.STDG_NM}</td>
            <td><strong>${row.BLDG_NM || '-'}</strong></td>
            <td class="text-end fw-bold">${Number(row.THING_AMT).toLocaleString()}</td>
            <td class="text-end">${row.ARCH_AREA}</td>
            <td>${row.FLR || '-'}</td>
            <td>${row.ARCH_YR || '-'}</td>
        </tr>
    `).join('');
}

function renderNoData() {
    resultBody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">해당하는 데이터가 없습니다.</td></tr>`;
    resultInfo.classList.add('d-none');
    paginationNav.classList.add('d-none');
}

function renderError(message) {
    resultBody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-danger"><i class="fas fa-exclamation-triangle me-2"></i>${message}</td></tr>`;
    resultInfo.classList.add('d-none');
    paginationNav.classList.add('d-none');
}

function renderPagination(totalCount, currentPage, limit) {
    const totalPages = Math.ceil(totalCount / limit);
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    let html = '';
    
    // Previous button
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">이전</a>
    </li>`;

    for (let i = startPage; i <= endPage; i++) {
        html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
            <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
        </li>`;
    }

    // Next button
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">다음</a>
    </li>`;

    pagination.innerHTML = html;
}

window.changePage = (page) => {
    currentPage = page;
    fetchRealPriceData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function showLoading(show) {
    if (show) {
        loading.classList.remove('d-none');
        resultBody.parentElement.parentElement.classList.add('opacity-50');
    } else {
        loading.classList.add('d-none');
        resultBody.parentElement.parentElement.classList.remove('opacity-50');
    }
}

function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

function getUsageBadgeClass(usage) {
    switch (usage) {
        case '아파트': return 'bg-primary';
        case '오피스텔': return 'bg-success';
        case '연립다세대': return 'bg-info text-dark';
        case '단독다가구': return 'bg-warning text-dark';
        default: return 'bg-secondary';
    }
}
