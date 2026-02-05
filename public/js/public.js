/**
 * Public Attendance View - Enhanced JavaScript
 * Handles live clock, countdown, filters, sorting, summary, highlights
 *
 * Features:
 * - Live clock with Indonesian date format
 * - Countdown timer to 09:15 cutoff time
 * - Auto-switch status BELUM HADIR → TIDAK HADIR at 09:15
 * - Filter buttons for status filtering
 * - Click-to-sort on table headers
 * - Real-time summary bar
 * - System status panel
 * - New entry detection and highlighting
 * - Auto-refresh attendance data every 5 seconds
 * - Warning banner with time-aware colors
 * - Attendance progress bar
 * - Student name search
 * - Status confidence icons
 * - Row aging indicator
 * - Freeze after cutoff
 */

// Configuration
const CONFIG = {
    REFRESH_INTERVAL: 5000,       // 5 seconds
    CLOCK_UPDATE_INTERVAL: 1000,  // 1 second
    CUTOFF_HOUR: 9,               // 09:15
    CUTOFF_MINUTE: 15,
    CUTOFF_SECOND: 0,
    WARNING_THRESHOLD_YELLOW: 10, // minutes
    WARNING_THRESHOLD_RED: 5,     // minutes
    START_HOUR: 5,                // 05:00 - start time for row aging
    START_MINUTE: 0
};

// State
let state = {
    currentFilter: 'all',
    currentSearch: '',
    sortColumn: null,
    sortDirection: 'asc',
    previousRowCount: 0,
    previousStatuses: new Map(),
    isFrozen: false,
    refreshIntervalId: null
};

/**
 * Format date in Indonesian locale
 * @param {Date} date - JavaScript Date object
 * @returns {string} Formatted date string
 */
function formatDateIndonesian(date) {
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    return date.toLocaleDateString('id-ID', options);
}

/**
 * Format time in 24-hour format
 * @param {Date} date - JavaScript Date object
 * @returns {string} Formatted time string (HH:MM:SS)
 */
function formatTime(date) {
    return date.toLocaleTimeString('id-ID', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Get current time as Date object
 * @returns {Date} Current date/time
 */
function getCurrentTime() {
    return new Date();
}

/**
 * Check if current time is past cutoff (09:15)
 * @returns {boolean} True if past cutoff
 */
function isPastCutoff() {
    const now = getCurrentTime();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const cutoffMinutes = CONFIG.CUTOFF_HOUR * 60 + CONFIG.CUTOFF_MINUTE;
    return currentMinutes > cutoffMinutes;
}

/**
 * Get time remaining until cutoff
 * @returns {object} Object with hours, minutes, seconds, and total seconds
 */
function getTimeUntilCutoff() {
    const now = getCurrentTime();
    const cutoff = new Date(now);
    cutoff.setHours(CONFIG.CUTOFF_HOUR, CONFIG.CUTOFF_MINUTE, CONFIG.CUTOFF_SECOND, 0);
    
    // If already past cutoff for today, return zeros
    if (now >= cutoff) {
        return { hours: 0, minutes: 0, seconds: 0, total: 0 };
    }
    
    const diff = cutoff - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds, total: diff };
}

/**
 * Format countdown time
 * @returns {string} Formatted countdown string
 */
function formatCountdown() {
    const time = getTimeUntilCutoff();
    if (time.total <= 0) {
        return '00:00:00';
    }
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}`;
}

/**
 * Update the live clock and date display
 */
function updateClock() {
    const now = getCurrentTime();
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');
    
    if (dateElement) {
        dateElement.textContent = formatDateIndonesian(now);
    }
    
    if (timeElement) {
        timeElement.textContent = formatTime(now);
    }
}

/**
 * Update countdown display
 */
function updateCountdown() {
    const countdownContainer = document.getElementById('countdown-container');
    const countdownTime = document.getElementById('countdown-time');
    const countdownStatus = document.getElementById('countdown-status');
    
    if (!countdownTime || !countdownStatus) return;
    
    const time = getTimeUntilCutoff();
    countdownTime.textContent = formatCountdown();
    
    if (time.total <= 0) {
        // Cutoff passed
        countdownContainer.classList.add('expired');
        countdownStatus.innerHTML = `
            <span class="status-badge badge-expired">
                <i class="fas fa-times-circle"></i> Waktu absensi telah berakhir
            </span>
        `;
    } else {
        // Still within cutoff time
        countdownContainer.classList.remove('expired');
        countdownStatus.innerHTML = `
            <span class="status-badge badge-active">
                <i class="fas fa-hourglass-half"></i> Sisa waktu absensi
            </span>
        `;
    }
}

/**
 * Update system status panel
 */
function updateSystemStatus() {
    const lastUpdate = document.getElementById('last-update');
    if (lastUpdate) {
        lastUpdate.textContent = formatTime(getCurrentTime());
    }
}

/**
 * Apply status badge classes to table cells
 */
function applyStatusBadges() {
    const statusCells = document.querySelectorAll('.status-cell');
    
    statusCells.forEach(cell => {
        const text = cell.textContent.trim().toUpperCase();
        
        // Remove existing badge classes
        cell.classList.remove('badge', 'badge-hadir', 'badge-terlambat', 'badge-belum-hadir', 'badge-tidak-hadir');
        
        // Apply appropriate badge class based on status
        if (text === 'HADIR') {
            cell.classList.add('badge', 'badge-hadir');
        } else if (text === 'TERLAMBAT') {
            cell.classList.add('badge', 'badge-terlambat');
        } else if (text === 'BELUM HADIR') {
            cell.classList.add('badge', 'badge-belum-hadir');
        } else if (text === 'TIDAK HADIR') {
            cell.classList.add('badge', 'badge-tidak-hadir');
        }
    });
}

/**
 * Auto-switch BELUM HADIR to TIDAK HADIR when time passes 09:15
 * This is client-side only, without backend reload
 */
function autoSwitchStatus() {
    const pastCutoff = isPastCutoff();
    const statusCells = document.querySelectorAll('.status-cell');
    
    statusCells.forEach(cell => {
        const text = cell.textContent.trim().toUpperCase();
        
        if (text === 'BELUM HADIR' && pastCutoff) {
            // Switch to TIDAK HADIR
            cell.textContent = 'TIDAK HADIR';
            cell.classList.remove('status-belum-hadir', 'badge-belum-hadir');
            cell.classList.add('status-tidak-hadir', 'badge', 'badge-tidak-hadir');
            
            // Update row data-status attribute
            const row = cell.closest('tr');
            if (row) {
                row.setAttribute('data-status', 'tidak-hadir');
            }
        }
    });
}

/**
 * Get all table rows
 * @returns {NodeList} Table body rows
 */
function getTableRows() {
    return document.querySelectorAll('#attendance-table-body tr');
}

/**
 * Count statuses from table rows
 * @returns {object} Object with status counts
 */
function countStatuses() {
    const rows = getTableRows();
    let counts = {
        total: rows.length,
        hadir: 0,
        terlambat: 0,
        belum: 0,
        tidak: 0
    };
    
    rows.forEach(row => {
        const status = row.getAttribute('data-status');
        if (status === 'hadir') counts.hadir++;
        else if (status === 'terlambat') counts.terlambat++;
        else if (status === 'belum-hadir') counts.belum++;
        else if (status === 'tidak-hadir') counts.tidak++;
    });
    
    return counts;
}

/**
 * Update summary bar with current counts
 */
function updateSummaryBar() {
    const counts = countStatuses();
    
    const totalEl = document.getElementById('summary-total');
    const hadirEl = document.getElementById('summary-hadir');
    const terlambatEl = document.getElementById('summary-terlambat');
    const tidakEl = document.getElementById('summary-tidak-hadir');
    
    if (totalEl) totalEl.textContent = counts.total;
    if (hadirEl) hadirEl.textContent = counts.hadir;
    if (terlambatEl) terlambatEl.textContent = counts.terlambat;
    if (tidakEl) tidakEl.textContent = counts.tidak + counts.belum;
    
    // Update filter counts
    document.getElementById('filter-count-all').textContent = counts.total;
    document.getElementById('filter-count-hadir').textContent = counts.hadir;
    document.getElementById('filter-count-terlambat').textContent = counts.terlambat;
    document.getElementById('filter-count-belum').textContent = counts.belum;
    document.getElementById('filter-count-tidak').textContent = counts.tidak;
}

/**
 * Apply filter to show/hide rows
 * @param {string} filter - Filter value ('all', 'hadir', 'terlambat', 'belum', 'tidak')
 */
function applyFilter(filter) {
    const rows = getTableRows();
    let visibleCount = 0;
    
    rows.forEach(row => {
        const status = row.getAttribute('data-status');
        let shouldShow = false;
        
        switch (filter) {
            case 'all':
                shouldShow = true;
                break;
            case 'hadir':
                shouldShow = status === 'hadir';
                break;
            case 'terlambat':
                shouldShow = status === 'terlambat';
                break;
            case 'belum':
                shouldShow = status === 'belum-hadir';
                break;
            case 'tidak':
                shouldShow = status === 'tidak-hadir';
                break;
        }
        
        if (shouldShow) {
            row.classList.remove('hidden');
            visibleCount++;
        } else {
            row.classList.add('hidden');
        }
    });
    
    // Show/hide no data message
    const noDataMsg = document.getElementById('no-data-message');
    if (noDataMsg) {
        noDataMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    }
    
    // Update summary for visible rows only
    updateFilteredSummary(filter);
}

/**
 * Update summary bar for filtered view
 * @param {string} filter - Current filter
 */
function updateFilteredSummary(filter) {
    const counts = countStatuses();
    
    // Recalculate based on visible rows only
    const rows = getTableRows();
    let visibleCounts = { total: 0, hadir: 0, terlambat: 0, tidak: 0 };
    
    rows.forEach(row => {
        if (!row.classList.contains('hidden')) {
            visibleCounts.total++;
            const status = row.getAttribute('data-status');
            if (status === 'hadir') visibleCounts.hadir++;
            else if (status === 'terlambat') visibleCounts.terlambat++;
            else if (status === 'tidak-hadir') visibleCounts.tidak++;
        }
    });
    
    const totalEl = document.getElementById('summary-total');
    const hadirEl = document.getElementById('summary-hadir');
    const terlambatEl = document.getElementById('summary-terlambat');
    const tidakEl = document.getElementById('summary-tidak-hadir');
    
    if (totalEl) totalEl.textContent = visibleCounts.total;
    if (hadirEl) hadirEl.textContent = visibleCounts.hadir;
    if (terlambatEl) terlambatEl.textContent = visibleCounts.terlambat;
    if (tidakEl) tidakEl.textContent = visibleCounts.tidak;
}

/**
 * Setup filter button event listeners
 */
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Apply filter
            const filter = btn.getAttribute('data-filter');
            state.currentFilter = filter;
            applyFilter(filter);
        });
    });
}

/**
 * Parse time string to comparable value
 * @param {string} timeStr - Time string (HH:MM:SS or HH:MM)
 * @returns {number} Minutes since midnight, or -1 for invalid
 */
function parseTimeToMinutes(timeStr) {
    if (!timeStr || timeStr === '-') return -1;
    
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return -1;
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parts[2] ? parseInt(parts[2], 10) : 0;
    
    if (isNaN(hours) || isNaN(minutes)) return -1;
    
    return hours * 60 + minutes + (seconds / 60);
}

/**
 * Get sort value for a row based on column
 * @param {HTMLElement} row - Table row
 * @param {string} column - Sort column name
 * @returns {*} Sort value
 */
function getRowSortValue(row, column) {
    switch (column) {
        case 'nama':
            return row.querySelector('.student-name').textContent.toLowerCase();
        case 'status':
            // Custom order: HADIR > TERLAMBAT > TIDAK HADIR > BELUM HADIR
            const statusCell = row.querySelector('.status-cell');
            const statusText = statusCell ? statusCell.textContent.trim().toUpperCase() : '';
            const statusOrder = { 'HADIR': 0, 'TERLAMBAT': 1, 'TIDAK HADIR': 2, 'BELUM HADIR': 3 };
            return statusOrder[statusText] || 4;
        case 'waktu':
            const waktuCell = row.querySelector('.waktu-cell');
            return parseTimeToMinutes(waktuCell ? waktuCell.textContent.trim() : '-');
        default:
            return null;
    }
}

/**
 * Sort table by column
 * @param {string} column - Column to sort by
 */
function sortTable(column) {
    const tbody = document.getElementById('attendance-table-body');
    const rows = Array.from(getTableRows());
    
    // Toggle sort direction if same column
    if (state.sortColumn === column) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortColumn = column;
        state.sortDirection = 'asc';
    }
    
    // Update sort indicators
    document.querySelectorAll('.sort-indicator').forEach(ind => {
        ind.classList.remove('asc', 'desc');
        ind.textContent = '';
    });
    const currentIndicator = document.getElementById(`sort-${column}`);
    if (currentIndicator) {
        currentIndicator.classList.add(state.sortDirection);
        currentIndicator.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
    }
    
    // Sort rows
    rows.sort((a, b) => {
        const valueA = getRowSortValue(a, column);
        const valueB = getRowSortValue(b, column);
        
        if (valueA === -1) return 1; // Empty time goes last
        if (valueB === -1) return -1;
        
        let result;
        if (typeof valueA === 'string') {
            result = valueA.localeCompare(valueB);
        } else {
            result = valueA - valueB;
        }
        
        return state.sortDirection === 'asc' ? result : -result;
    });
    
    // Re-append sorted rows
    rows.forEach(row => tbody.appendChild(row));
    
    // Re-apply filter to maintain visibility
    applyFilter(state.currentFilter);
}

/**
 * Setup sortable table headers
 */
function setupSorting() {
    const sortableHeaders = document.querySelectorAll('.attendance-table th.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-sort');
            sortTable(column);
        });
    });
}

/**
 * Detect new attendance entries
 * @returns {Array} Array of new row indices
 */
function detectNewEntries() {
    const rows = getTableRows();
    const newEntries = [];
    
    rows.forEach((row, index) => {
        const statusCell = row.querySelector('.status-cell');
        if (!statusCell) return;
        
        const status = statusCell.textContent.trim().toUpperCase();
        const key = `row-${index}`;
        
        // If this row is new (wasn't present before)
        if (index >= state.previousRowCount) {
            newEntries.push({ row, index, isNew: true });
        }
        // Or if status changed from BELUM HADIR to something else
        else if (state.previousStatuses.has(key)) {
            const prevStatus = state.previousStatuses.get(key);
            if (prevStatus !== status && prevStatus === 'BELUM HADIR' && status !== 'BELUM HADIR') {
                newEntries.push({ row, index, isNew: true });
            }
        }
        
        // Update stored status
        state.previousStatuses.set(key, status);
    });
    
    // Update row count
    state.previousRowCount = rows.length;
    
    return newEntries;
}

/**
 * Highlight new entries with animation
 * @param {Array} newEntries - Array of new entry objects
 */
function highlightNewEntries(newEntries) {
    newEntries.forEach(({ row, index }) => {
        // Add highlight class
        row.classList.add('new-entry');
        
        // Add RFID icon to status cell
        const statusCell = row.querySelector('.status-cell');
        if (statusCell) {
            const icon = document.createElement('span');
            icon.className = 'rfid-icon';
            icon.innerHTML = '<i class="fas fa-rss"></i>';
            statusCell.appendChild(icon);
        }
        
        // Remove highlight class after animation
        setTimeout(() => {
            row.classList.remove('new-entry');
        }, 3000);
    });
}

/**
 * Fetch and refresh attendance data
 */
async function refreshAttendanceData() {
    // Don't refresh if frozen
    if (state.isFrozen) return;

    try {
        const response = await fetch('/attendance');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();

        // Parse the HTML response
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Find the table body in the new content
        const newTableBody = doc.querySelector('#attendance-table-body');
        const currentTableBody = document.querySelector('#attendance-table-body');

        if (newTableBody && currentTableBody) {
            // Store current filter and sort state
            const currentFilter = state.currentFilter;
            const currentSort = { column: state.sortColumn, direction: state.sortDirection };
            const currentSearch = state.currentSearch;

            // Detect new entries before updating
            const newEntries = detectNewEntries();

            // Replace table body content
            currentTableBody.innerHTML = newTableBody.innerHTML;

            // Apply status badges
            applyStatusBadges();

            // Inject status icons
            injectStatusIcons();

            // Auto-switch status if past cutoff
            autoSwitchStatus();

            // Restore search
            state.currentSearch = currentSearch;
            const searchInput = document.getElementById('student-search');
            if (searchInput) {
                searchInput.value = currentSearch;
            }

            // Restore filter
            state.currentFilter = currentFilter;
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-filter') === currentFilter);
            });
            applyFilter(currentFilter);

            // Restore sort
            if (currentSort.column) {
                state.sortColumn = currentSort.column;
                state.sortDirection = currentSort.direction;
                sortTable(currentSort.column);
            }

            // Highlight new entries
            highlightNewEntries(newEntries);

            // Update summary bar
            updateSummaryBar();

            // Update progress bar
            updateProgressBar();

            // Update filter counts
            updateFilterCounts();

            // Update row aging
            updateRowAging();

            // Update warning mode
            updateWarningMode();

            // Update last refresh timestamp
            const refreshIndicator = document.getElementById('last-refresh');
            if (refreshIndicator) {
                refreshIndicator.innerHTML = `
                    <i class="fas fa-sync-alt"></i> Terakhir diperbarui: ${formatTime(getCurrentTime())}
                `;
            }

            // Update system status
            updateSystemStatus();
        }
    } catch (error) {
        console.error('Error refreshing attendance data:', error);
    }
}

/**
 * Update warning banner based on time remaining
 * Yellow: <10 minutes, Red blinking: <5 minutes, Ended: >09:15
 */
function updateWarningMode() {
    const warningBanner = document.getElementById('warning-banner');
    const warningText = document.getElementById('warning-text');
    const time = getTimeUntilCutoff();
    const totalMinutes = Math.floor(time.total / (1000 * 60));

    if (!warningBanner || !warningText) return;

    // Remove all classes first
    warningBanner.classList.remove('warning-yellow', 'warning-red', 'ended');

    if (time.total <= 0) {
        // Time has ended
        warningBanner.style.display = 'flex';
        warningBanner.classList.add('ended');
        warningText.textContent = 'Waktu absensi telah berakhir';
    } else if (totalMinutes < CONFIG.WARNING_THRESHOLD_RED) {
        // Less than 5 minutes - red blinking
        warningBanner.style.display = 'flex';
        warningBanner.classList.add('warning-red');
        const mins = time.minutes;
        const secs = time.seconds.toString().padStart(2, '0');
        warningText.textContent = `Merah! Sisa waktu: ${mins}:${secs} menit - Segera tap!`;
    } else if (totalMinutes < CONFIG.WARNING_THRESHOLD_YELLOW) {
        // Less than 10 minutes - yellow
        warningBanner.style.display = 'flex';
        warningBanner.classList.add('warning-yellow');
        const mins = time.minutes;
        const secs = time.seconds.toString().padStart(2, '0');
        warningText.textContent = `Peringatan! Sisa waktu: ${mins}:${secs} menit`;
    } else {
        // More than 10 minutes - hide banner
        warningBanner.style.display = 'none';
    }
}

/**
 * Update attendance progress bar
 * Counts HADIR rows and updates progress visualization
 */
function updateProgressBar() {
    const progressFill = document.getElementById('progress-fill');
    const progressCount = document.getElementById('progress-count');
    const progressPercentage = document.getElementById('progress-percentage');

    if (!progressFill || !progressCount || !progressPercentage) return;

    const counts = countStatuses();
    const hadir = counts.hadir;
    const total = counts.total;
    const percentage = total > 0 ? Math.round((hadir / total) * 100) : 0;

    // Update progress bar width
    progressFill.style.width = `${percentage}%`;

    // Update count text
    progressCount.textContent = `${hadir} / ${total} siswa hadir`;

    // Update percentage text
    progressPercentage.textContent = `${percentage}%`;
}

/**
 * Inject status confidence icons into status cells
 * Hadir: ✔️, Terlambat: ⏱️, Tidak Hadir: ✖️
 */
function injectStatusIcons() {
    const statusCells = document.querySelectorAll('.status-cell');

    statusCells.forEach(cell => {
        // Check if icon already exists
        if (cell.querySelector('.status-icon-check, .status-icon-clock, .status-icon-cross')) {
            return;
        }

        const text = cell.textContent.trim().toUpperCase();
        const icon = document.createElement('span');
        icon.style.marginLeft = '6px';

        if (text === 'HADIR') {
            icon.innerHTML = '✔️';
            icon.className = 'status-icon-check';
        } else if (text === 'TERLAMBAT') {
            icon.innerHTML = '⏱️';
            icon.className = 'status-icon-clock';
        } else if (text === 'TIDAK HADIR') {
            icon.innerHTML = '✖️';
            icon.className = 'status-icon-cross';
        }

        if (icon.innerHTML) {
            cell.appendChild(icon);
        }
    });
}

/**
 * Update row aging indicator for BELUM HADIR rows
 * Color changes based on time elapsed since 05:00
 */
function updateRowAging() {
    const rows = getTableRows();
    const now = getCurrentTime();

    // Calculate total minutes since 05:00
    const startMinutes = CONFIG.START_HOUR * 60 + CONFIG.START_MINUTE;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const elapsedMinutes = Math.max(0, currentMinutes - startMinutes);

    // Calculate cutoff duration (05:00 to 09:15 = 255 minutes)
    const cutoffMinutes = (CONFIG.CUTOFF_HOUR * 60 + CONFIG.CUTOFF_MINUTE) - startMinutes;

    rows.forEach(row => {
        const status = row.getAttribute('data-status');
        const statusCell = row.querySelector('.status-cell');

        // Only apply aging to BELUM HADIR rows
        if (status === 'belum-hadir' && statusCell) {
            // Calculate aging stage (1-4 based on percentage of cutoff time)
            const progress = elapsedMinutes / cutoffMinutes;

            // Remove existing aging classes
            row.classList.remove('row-aging-1', 'row-aging-2', 'row-aging-3', 'row-aging-4');

            // Apply new aging class based on progress
            if (progress < 0.25) {
                row.classList.add('row-aging-1');
            } else if (progress < 0.5) {
                row.classList.add('row-aging-2');
            } else if (progress < 0.75) {
                row.classList.add('row-aging-3');
            } else {
                row.classList.add('row-aging-4');
            }
        }
    });
}

/**
 * Setup student name search functionality
 */
function setupSearch() {
    const searchInput = document.getElementById('student-search');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        state.currentSearch = e.target.value.trim().toLowerCase();
        applyFilter(state.currentFilter);
        updateProgressBar();
    });
}

/**
 * Apply search filter to table rows
 * @param {string} searchTerm - Search term to match
 * @returns {boolean} True if row should be shown
 */
function applySearchFilter(row, searchTerm) {
    if (!searchTerm) return true;

    const nameCell = row.querySelector('.student-name');
    if (!nameCell) return true;

    const name = nameCell.textContent.trim().toLowerCase();
    return name.includes(searchTerm);
}

/**
 * Handle freeze after cutoff
 * Stops auto-refresh and shows freeze badge
 */
function handleFreezeAfterCutoff() {
    const freezeBadge = document.getElementById('freeze-badge');

    if (isPastCutoff() && !state.isFrozen) {
        state.isFrozen = true;

        // Stop auto-refresh
        if (state.refreshIntervalId) {
            clearInterval(state.refreshIntervalId);
            state.refreshIntervalId = null;
        }

        // Show freeze badge
        if (freezeBadge) {
            freezeBadge.style.display = 'flex';
        }

        console.log('Attendance data frozen - cutoff time passed');
    } else if (!isPastCutoff() && state.isFrozen) {
        // Reset freeze state if time goes back (edge case)
        state.isFrozen = false;
        if (freezeBadge) {
            freezeBadge.style.display = 'none';
        }
    }
}

/**
 * Update filter counts based on current search and filter
 * Ensures BELUM HADIR doesn't appear in TIDAK HADIR filter
 */
function updateFilterCounts() {
    const rows = getTableRows();
    const searchTerm = state.currentSearch;

    let counts = {
        total: 0,
        hadir: 0,
        terlambat: 0,
        belum: 0,
        tidak: 0
    };

    rows.forEach(row => {
        // Check if row passes search filter
        if (!applySearchFilter(row, searchTerm)) {
            return;
        }

        counts.total++;

        const status = row.getAttribute('data-status');
        if (status === 'hadir') {
            counts.hadir++;
        } else if (status === 'terlambat') {
            counts.terlambat++;
        } else if (status === 'belum-hadir') {
            counts.belum++;
        } else if (status === 'tidak-hadir') {
            counts.tidak++;
        }
    });

    // Update filter count elements
    const countElements = {
        'filter-count-all': counts.total,
        'filter-count-hadir': counts.hadir,
        'filter-count-terlambat': counts.terlambat,
        'filter-count-belum': counts.belum,
        'filter-count-tidak': counts.tidak
    };

    Object.entries(countElements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    });
}

/**
 * Override applyFilter to include search functionality
 * @param {string} filter - Filter value ('all', 'hadir', 'terlambat', 'belum', 'tidak')
 */
function applyFilterWithSearch(filter) {
    const rows = getTableRows();
    const searchTerm = state.currentSearch;
    let visibleCount = 0;

    rows.forEach(row => {
        const status = row.getAttribute('data-status');
        const passesSearch = applySearchFilter(row, searchTerm);
        let shouldShow = false;

        if (!passesSearch) {
            shouldShow = false;
        } else {
            switch (filter) {
                case 'all':
                    shouldShow = true;
                    break;
                case 'hadir':
                    shouldShow = status === 'hadir';
                    break;
                case 'terlambat':
                    shouldShow = status === 'terlambat';
                    break;
                case 'belum':
                    shouldShow = status === 'belum-hadir';
                    break;
                case 'tidak':
                    shouldShow = status === 'tidak-hadir';
                    break;
            }
        }

        if (shouldShow) {
            row.classList.remove('hidden');
            visibleCount++;
        } else {
            row.classList.add('hidden');
        }
    });

    // Show/hide no data message
    const noDataMsg = document.getElementById('no-data-message');
    if (noDataMsg) {
        noDataMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    // Update filter counts
    updateFilterCounts();

    // Update summary for visible rows only
    updateFilteredSummary(filter);
}

/**
 * Initialize all UI components
 */
function initializeUI() {
    // Initial clock update
    updateClock();

    // Initial countdown update
    updateCountdown();

    // Apply initial status badges
    applyStatusBadges();

    // Inject status icons
    injectStatusIcons();

    // Update summary bar
    updateSummaryBar();

    // Update progress bar
    updateProgressBar();

    // Update filter counts
    updateFilterCounts();

    // Setup filters
    setupFilters();

    // Override default filter function with search-enabled version
    window.applyFilter = applyFilterWithSearch;

    // Setup sorting
    setupSorting();

    // Setup search
    setupSearch();

    // Store initial row count
    state.previousRowCount = getTableRows().length;

    // Store initial statuses
    getTableRows().forEach((row, index) => {
        const statusCell = row.querySelector('.status-cell');
        if (statusCell) {
            state.previousStatuses.set(`row-${index}`, statusCell.textContent.trim().toUpperCase());
        }
    });

    console.log('Public Attendance View initialized');
    console.log(`Cutoff time: ${CONFIG.CUTOFF_HOUR}:${CONFIG.CUTOFF_MINUTE.toString().padStart(2, '0')}`);
    console.log(`Auto-refresh every ${CONFIG.REFRESH_INTERVAL / 1000} seconds`);
}

/**
 * Main initialization
 */
function initializePublicView() {
    // Set up live clock (updates every second)
    setInterval(updateClock, CONFIG.CLOCK_UPDATE_INTERVAL);

    // Set up countdown (updates every second)
    setInterval(updateCountdown, CONFIG.CLOCK_UPDATE_INTERVAL);

    // Set up warning mode (updates every second)
    setInterval(updateWarningMode, CONFIG.CLOCK_UPDATE_INTERVAL);

    // Set up row aging (updates every minute)
    setInterval(updateRowAging, 60000);

    // Set up auto-refresh (updates every 5 seconds)
    state.refreshIntervalId = setInterval(refreshAttendanceData, CONFIG.REFRESH_INTERVAL);

    // Initialize UI components
    initializeUI();

    // Check for freeze after cutoff
    setInterval(handleFreezeAfterCutoff, CONFIG.CLOCK_UPDATE_INTERVAL);

    // Initial row aging update
    updateRowAging();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePublicView);

