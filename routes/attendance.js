const express = require('express');
const router = express.Router();

const { db } = require('../index');

/* =========================
   PUBLIC VIEW - ATTENDANCE
========================= */
router.get('/attendance', (req, res) => {

    const todayWIB = new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Jakarta'
    });

    const nowWIB = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
    );

    const currentMinutes =
        nowWIB.getHours() * 60 + nowWIB.getMinutes();

    // ⛔ HARDCODE SESUAI index.js (TIDAK BUAT VARIABEL BARU)
    const end = 9 * 60 + 15; // 09:15

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
            AND a.tanggal = ?
        WHERE s.status = 'aktif'
        ORDER BY k.nama_kelas, s.nama_siswa
    `;

    db.query(query, [todayWIB], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        // 🔥 LOGIKA STATUS FINAL
        const data = rows.map(r => {
            if (!r.status) {
                if (currentMinutes > end) {
                    r.status = 'TIDAK HADIR';
                } else {
                    r.status = 'BELUM HADIR';
                }
            }
            return r;
        });

        res.render('attendance/public', {
            title: 'Absensi Siswa Hari Ini',
            data,
            tanggal: todayWIB
        });
    });
});

module.exports = router;