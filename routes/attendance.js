const express = require('express');
const router = express.Router();
const mysql = require('mysql');

const { db } = require('../index'); // pakai koneksi dari index.js

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

/* =========================
   API POST - ABSENSI DARI NODEMCU / ESP8266
========================= */
router.post('/attendance', express.json(), (req, res) => {
    const { uid, nama, waktu } = req.body;

    if (!uid || !nama || !waktu) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    const today = new Date();
    const tanggal = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // 1️⃣ Cek apakah siswa sudah absen hari ini
    const cekQuery = `
        SELECT a.id_absensi
        FROM absensi a
        JOIN siswa s ON a.id_siswa = s.id_siswa
        WHERE s.uid_rfid = ? AND a.tanggal = ?
    `;
    db.query(cekQuery, [uid, tanggal], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (rows.length > 0) {
            return res.json({ success: false, message: 'Sudah absen hari ini' });
        }

        // 2️⃣ Ambil id_siswa dari UID
        const siswaQuery = 'SELECT id_siswa FROM siswa WHERE uid_rfid = ? LIMIT 1';
        db.query(siswaQuery, [uid], (err2, result) => {
            if (err2) {
                console.error(err2);
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            if (result.length === 0) {
                return res.json({ success: false, message: 'UID tidak terdaftar' });
            }

            const id_siswa = result[0].id_siswa;

            // 3️⃣ Insert absensi
            const insertQuery = `
                INSERT INTO absensi (id_siswa, status, jam_masuk, tanggal)
                VALUES (?, 'HADIR', ?, ?)
            `;
            db.query(insertQuery, [id_siswa, waktu, tanggal], (err3) => {
                if (err3) {
                    console.error(err3);
                    return res.status(500).json({ success: false, message: 'Database error' });
                }

                return res.json({ success: true, message: 'Absensi diterima' });
            });
        });
    });
});

module.exports = router;