-- ============================================
-- PowerOps: Seed Operators
-- Jalankan SETELAH powerops_schema.sql
-- Edit file ini jika ada perubahan personel
-- ============================================

INSERT INTO operators (name, role, group_name) VALUES
-- Group A
('Budi Santoso', 'supervisor', 'A'),
('Ahmad Fauzi', 'foreman_boiler', 'A'),
('Doni Saputra', 'foreman_turbin', 'A'),
('Hendra Wijaya', 'group_a', 'A'),
('Irfan Hakim', 'group_a', 'A'),
-- Group B
('Rizky Pratama', 'supervisor', 'B'),
('Siti Rahayu', 'foreman_boiler', 'B'),
('Fajar Nugroho', 'foreman_turbin', 'B'),
('Gilang Ramadhan', 'group_b', 'B'),
('Bagus Setiawan', 'group_b', 'B'),
-- Group C
('Eko Prasetyo', 'supervisor', 'C'),
('Dimas Aditya', 'foreman_boiler', 'C'),
('Wahyu Hidayat', 'foreman_turbin', 'C'),
('Rudi Hartono', 'group_c', 'C'),
('Satria Putra', 'group_c', 'C'),
-- Group D
('Agus Supriyanto', 'supervisor', 'D'),
('Dewi Kartika', 'foreman_boiler', 'D'),
('Lukman Hakim', 'foreman_turbin', 'D'),
('Yusuf Maulana', 'group_d', 'D'),
('Arief Rahman', 'group_d', 'D'),
-- Handling
('Teguh Prasetya', 'handling', NULL),
('Surya Dharma', 'handling', NULL),
-- Admin
('Admin Sistem', 'admin', NULL);
