const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('🔌 Terhubung ke database');

        // =========================
        // 1️⃣ CEK / INSERT KELAS
        // =========================
        const [kelasRows] = await connection.execute(
            "SELECT id_kelas FROM kelas WHERE nama_kelas = 'XI TJKT 1'"
        );

        let idKelas;

        if (kelasRows.length > 0) {
            idKelas = kelasRows[0].id_kelas;
            console.log("✅ Kelas sudah ada");
        } else {
            const [result] = await connection.execute(
                "INSERT INTO kelas (nama_kelas, wali_kelas) VALUES (?, ?)",
                ['XI TJKT 1', 'Dummy Wali']
            );
            idKelas = result.insertId;
            console.log("🆕 Kelas berhasil ditambahkan");
        }

        // =========================
        // 2️⃣ CEK DATA SISWA
        // =========================
        const [siswaCount] = await connection.execute(
            'SELECT COUNT(*) AS count FROM siswa'
        );

        if (siswaCount[0].count > 0) {
            console.log("⚠️ Tabel siswa sudah memiliki data, dummy tidak ditambahkan.");
        } else {
            // =========================
            // 3️⃣ DATA DUMMY (SESUAI ARDUINO)
            // =========================
            const dummySiswa = [
                { uid: '9215d29', nis: '123001', nama: 'HAMDAN' },
                { uid: 'f2c8bdd', nis: '123002', nama: 'SALSA' },
                { uid: '2945ac29', nis: '123003', nama: 'NAURA' },
            ];

            const insertSiswaQuery = `
                INSERT INTO siswa (uid_rfid, nis, nama_siswa, id_kelas)
                VALUES (?, ?, ?, ?)
            `;

            for (const siswa of dummySiswa) {
                await connection.execute(insertSiswaQuery, [
                    siswa.uid,
                    siswa.nis,
                    siswa.nama,
                    idKelas
                ]);
            }

            console.log("🎉 Data dummy siswa berhasil ditambahkan");
        }

    } catch (error) {
        console.error("❌ Terjadi kesalahan:", error.message);
    } finally {
        await connection.end();
        console.log("🔒 Koneksi database ditutup");
    }
})();
