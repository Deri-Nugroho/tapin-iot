require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const path = require('path');

const app = express();

/* ==========================
   APP CONFIG
========================== */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(express.json()); // untuk menerima POST JSON dari NodeMCU
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // true jika HTTPS
}));

/* ==========================
   DATABASE CONNECTION
========================== */
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: 'Asia/Jakarta'
});

db.connect(err => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
    console.log('✅ MySQL Connected (Asia/Jakarta)');
});

module.exports = { db };

/* ==========================
   HELPER FUNCTIONS
========================== */

// Validasi jam absensi (05:00 – 09:15 WIB)
function getAttendanceStatus() {
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const start = 5 * 60;          // 05:00
    const onTime = 18 * 60;          // 07:00
    const end = 18 * 60 + 15;        // 09:15

    if (minutesNow < start || minutesNow > end) return null;
    return minutesNow <= onTime ? 'hadir' : 'terlambat';
}

// Tanggal WIB (YYYY-MM-DD)
function todayWIB() {
    return new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Jakarta'
    });
}

/* ==========================
   ROUTES
========================== */
const attendanceRoutes = require('./routes/attendance');
app.use(attendanceRoutes);

/* ==========================
   TEST SERVER
========================== */
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'API Absensi RFID aktif'
    });
});

/* ==========================
   API ABSENSI RFID
   POST /api/attendance
========================== */
app.post('/api/attendance', (req, res) => {
    const { uid } = req.body;

    // 1️⃣ Validasi UID
    if (!uid) {
        return res.status(400).json({ success: false, message: 'UID tidak terdaftar' });
    }

    // 2️⃣ Validasi jam absensi
    const status = getAttendanceStatus();
    if (!status) {
        return res.status(403).json({
            success: false,
            message: 'Absensi hanya valid pukul 05:00 – 09:15 WIB'
        });
    }

    // 3️⃣ Ambil data siswa berdasarkan UID
    const studentQuery = `
        SELECT s.id_siswa, s.nama_siswa, k.nama_kelas
        FROM siswa s
        JOIN kelas k ON s.id_kelas = k.id_kelas
        WHERE s.uid_rfid = ? AND s.status = 'aktif'
        LIMIT 1
    `;
    db.query(studentQuery, [uid], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'UID tidak terdaftar' });
        }

        const siswa = result[0];
        const tanggalHariIni = todayWIB();

        // 4️⃣ Cek apakah sudah absen hari ini
        const checkQuery = `
            SELECT id_absensi
            FROM absensi
            WHERE id_siswa = ? AND tanggal = ?
        `;
        db.query(checkQuery, [siswa.id_siswa, tanggalHariIni], (err2, rows) => {
            if (err2) {
                console.error(err2);
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            if (rows.length > 0) {
                return res.status(409).json({ success: false, message: 'Sudah melakukan absensi hari ini' });
            }

            // 5️⃣ Insert absensi
            const now = new Date();
            const jamWIB = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false });

            const insertQuery = `
                INSERT INTO absensi (id_siswa, tanggal, jam_masuk, status)
                VALUES (?, ?, ?, ?)
            `;
            db.query(insertQuery, [siswa.id_siswa, tanggalHariIni, jamWIB, status], (err3) => {
                if (err3) {
                    console.error(err3);
                    return res.status(500).json({ success: false, message: 'Database error' });
                }

                return res.json({
                    success: true,
                    message: 'Absensi berhasil',
                    data: {
                        nama: siswa.nama_siswa,
                        kelas: siswa.nama_kelas,
                        status: status,
                        waktu: now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                    }
                });
            });
        });
    });
});

/* ==========================
   START SERVER
========================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});