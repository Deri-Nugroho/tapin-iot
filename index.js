require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();

/* ==========================
   MIDDLEWARE
========================== */

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // true kalau HTTPS
}));

/* ==========================
   DATABASE CONNECTION
========================== */
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
    console.log('✅ MySQL Connected');
});

/* ==========================
   HELPER FUNCTION
========================== */

// Validasi jam absensi (05:00 – 09:15)
function getAttendanceStatus() {
    const now = new Date(); // ⬅️ SUDAH WIB

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    // JAM ABSENSI (WIB)
    const start = 5 * 60;        // 05:00
    const onTime = 13 * 60;       // 07:00
    const end = 12 * 60 + 15;    // testing: 12:15

    console.log({
        local: now.toString(),
        menit: currentMinutes
    });

    if (currentMinutes < start || currentMinutes > end) {
        return null;
    }

    if (currentMinutes <= onTime) {
        return 'hadir';
    }

    return 'terlambat';
}

// Ambil tanggal hari ini (YYYY-MM-DD)
function todayDate() {
    return new Date().toISOString().slice(0, 10);
}

/* ==========================
   TEST SERVER
========================== */
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'API Absensi RFID aktif'
    });
});

/* =====================================================
   API ABSENSI RFID
   POST /api/attendance
   BODY: { uid: "04A1B2C3" }
===================================================== */
app.post('/api/attendance', (req, res) => {
    const { uid } = req.body;

    /* 1️⃣ Validasi UID kosong */
    if (!uid) {
        return res.status(400).json({
            success: false,
            message: 'UID tidak terdaftar'
        });
    }

    /* 2️⃣ Validasi jam */
    const status = getAttendanceStatus();
    if (!status) {
        return res.status(403).json({
            success: false,
            message: 'Absensi hanya valid pukul 05:00 – 09:15'
        });
    }

    /* 3️⃣ Cek UID terdaftar */
    const studentQuery = `
        SELECT 
            s.id_siswa,
            s.nama_siswa,
            k.nama_kelas
        FROM siswa s
        JOIN kelas k ON s.id_kelas = k.id_kelas
        WHERE s.uid_rfid = ?
        AND s.status = 'aktif'
    `;

    db.query(studentQuery, [uid], (err, studentResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false });
        }

        if (studentResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'UID tidak terdaftar'
            });
        }

        const siswa = studentResult[0];

        /* 4️⃣ Cek sudah absen hari ini */
        const checkQuery = `
            SELECT id_absensi FROM absensi
            WHERE id_siswa = ? AND tanggal = ?
        `;

        db.query(checkQuery, [siswa.id_siswa, todayDate()], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false });
            }

            if (result.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Sudah melakukan absensi hari ini'
                });
            }

            /* 5️⃣ Simpan absensi */
            const insertQuery = `
                INSERT INTO absensi
                (id_siswa, tanggal, jam_masuk, status)
                VALUES (?, CURDATE(), CURTIME(), ?)
            `;

            db.query(insertQuery, [siswa.id_siswa, status], err => {
                if (err) {

                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({
                            success: false,
                            message: 'Sudah melakukan absensi hari ini'
                        });
                    }

                    console.error(err);
                    return res.status(500).json({ success: false });
                }
                return res.json({
                    success: true,
                    message: 'Absensi berhasil',
                    data: {
                        nama: siswa.nama_siswa,
                        kelas: siswa.nama_kelas,
                        status: status,
                        waktu: new Date()
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
