/**
 * Public Attendance View - JavaScript
 * Handles live clock, auto-refresh, and dynamic UI updates
 * 
 * Features:
 * - Live clock with Indonesian date format
 * - Auto-refresh attendance data every 5 seconds
 * - Status badge styling application
 * - Smooth transitions for TV/monitor display
 */

// Configuration
const REFRESH_INTERVAL = 5000; // 5 seconds
const CLOCK_UPDATE_INTERVAL = 1000; // 1 second

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
 * Update the live clock and date display
 */
function updateClock() {
    const now = new Date();
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
 * Apply status badge classes to table cells
 * Transforms plain text status into styled badges
 */
function applyStatusBadges() {
    const statusCells = document.querySelectorAll('.status-cell');
    
    statusCells.forEach(cell => {
        const text = cell.textContent.trim().toUpperCase();
        
        // Remove existing badge classes
        cell.classList.remove('badge', 'badge-hadir', 'badge-terlambat', 'badge-belum-hadir');
        
        // Apply appropriate badge class based on status
        if (text === 'HADIR') {
            cell.classList.add('badge', 'badge-hadir');
        } else if (text === 'TERLAMBAT') {
            cell.classList.add('badge', 'badge-terlambat');
        } else if (text === 'BELUM HADIR' || text === 'TIDAK HADIR') {
            cell.classList.add('badge', 'badge-belum-hadir');
        }
    });
}

/**
 * Fetch and refresh attendance data
 * Uses AJAX to update table without full page reload
 */
async function refreshAttendanceData() {
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
            // Replace only the table body content
            currentTableBody.innerHTML = newTableBody.innerHTML;
            
            // Re-apply status badges after table update
            applyStatusBadges();
            
            // Update last refresh timestamp
            const refreshIndicator = document.getElementById('last-refresh');
            if (refreshIndicator) {
                const now = new Date();
                refreshIndicator.textContent = `Terakhir diperbarui: ${formatTime(now)}`;
            }
        }
    } catch (error) {
        console.error('Error refreshing attendance data:', error);
    }
}

/**
 * Initialize the public attendance view
 * Sets up clock updates and auto-refresh
 */
function initializePublicView() {
    // Initial clock update
    updateClock();
    
    // Set up live clock (updates every second)
    setInterval(updateClock, CLOCK_UPDATE_INTERVAL);
    
    // Set up auto-refresh (updates every 5 seconds)
    setInterval(refreshAttendanceData, REFRESH_INTERVAL);
    
    // Apply initial status badges
    applyStatusBadges();
    
    console.log('Public Attendance View initialized');
    console.log(`Auto-refresh every ${REFRESH_INTERVAL / 1000} seconds`);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePublicView);

