-- ========================================
-- DATABASE ABSENSI RFID TAPIN
-- ========================================

-- 1. Create database
CREATE DATABASE IF NOT EXISTS sql12813198
CHARACTER SET utf8mb4
COLLATE utf8mb4_general_ci;

-- 2. Use database
USE sql12813198;

-- ========================================
-- 3. Table admin
-- ========================================
CREATE TABLE IF NOT EXISTS admin (
    id_admin INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ========================================
-- 4. Table kelas
-- ========================================
CREATE TABLE IF NOT EXISTS kelas (
    id_kelas INT AUTO_INCREMENT PRIMARY KEY,
    nama_kelas VARCHAR(50) NOT NULL,
    wali_kelas VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ========================================
-- 5. Table siswa
-- ========================================
CREATE TABLE IF NOT EXISTS siswa (
    id_siswa INT AUTO_INCREMENT PRIMARY KEY,
    uid_rfid VARCHAR(20) NOT NULL UNIQUE,
    nis VARCHAR(20) NOT NULL UNIQUE,
    nama_siswa VARCHAR(100) NOT NULL,
    nama_tampil VARCHAR(50) NOT NULL,
    id_kelas INT NOT NULL,
    status ENUM('aktif','nonaktif') DEFAULT 'aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_siswa_kelas
        FOREIGN KEY (id_kelas)
        REFERENCES kelas(id_kelas)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ========================================
-- 6. Table absensi
-- ========================================
CREATE TABLE IF NOT EXISTS absensi (
    id_absensi INT AUTO_INCREMENT PRIMARY KEY,
    id_siswa INT NOT NULL,
    tanggal DATE NOT NULL,
    jam_masuk TIME NOT NULL,
    status ENUM('hadir','terlambat','tidak_valid') NOT NULL,
    sumber ENUM('rfid','manual') DEFAULT 'rfid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_absensi_siswa
        FOREIGN KEY (id_siswa)
        REFERENCES siswa(id_siswa)
        ON DELETE CASCADE,

    CONSTRAINT uc_absen_harian
        UNIQUE (id_siswa, tanggal)
) ENGINE=InnoDB;

-- ========================================
-- 7. DUMMY DATA
-- ========================================

-- Kelas
INSERT INTO kelas (nama_kelas, wali_kelas)
VALUES ('XI TJKT 1', 'Dummy Wali');

-- Siswa (UID + nama tampil LCD)
INSERT INTO siswa (uid_rfid, nis, nama_siswa, nama_tampil, id_kelas) VALUES
('f36573',   '15667', 'Deri Nugroho',                 'Deri',          1),
('39759029', '15672', 'Hamdan Allmashah',             'Hamdan',        1),
('49cc6c29', '15681', 'Naura Athaayaa Kamiil',        'Naura',         1),
('89876d29', '15687', 'Salsa Maulidina',              'Salsa',         1),
('293f6a29', '15668', 'Dias Hafiidh Ega Maulana',     'Dias',          1),
('497b7729', '15688', 'Muhammad Haikal Kamil',        'Haikal',        1),
('896b6f29', '15691', 'Zaskia Embun Risqinanti',      'Zaskia',        1),
('19567129', '15661', 'Awalina Nadya Putri',          'Awalina',       1),
('9215d29',  '15658', 'Bagas Nur Setyo Budiarto',     'Bagas',         1),
('29be2b29', '15663', 'Rizki Ganang Prakoso',         'Ganang',        1),
('f2c8bdd',  '15670', 'Apriliatman Dwi Saputro',      'Apri',          1),
('2945ac29', '15671', 'Bayu Aji Prasetya',            'Bayu',          1);

-- ========================================
-- 8. RESET ABSENSI HARI INI (OPTIONAL)
-- ========================================
-- DELETE FROM absensi WHERE tanggal = CURDATE();