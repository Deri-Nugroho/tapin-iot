const express = require('express');
const router = express.Router();
const mysql = require('mysql');

/* gunakan koneksi DB yang sama */
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

/* =========================
   PUBLIC VIEW - ATTENDANCE
========================= */
router.get('/attendance', (req, res) => {

    const query = `
        SELECT 
            s.nama_siswa,
            k.nama_kelas,
            a.status,
            a.jam_masuk,
            a.tanggal
        FROM siswa s
        JOIN kelas k ON s.id_kelas = k.id_kelas
        LEFT JOIN absensi a 
            ON s.id_siswa = a.id_siswa
            AND a.tanggal = CURDATE()
        WHERE s.status = 'aktif'
        ORDER BY k.nama_kelas, s.nama_siswa
    `;

    db.query(query, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        res.render('attendance/public', {
            title: 'Absensi Siswa Hari Ini',
            data: rows,
            tanggal: new Date().toLocaleDateString('id-ID')
        });
    });
});

module.exports = router;
