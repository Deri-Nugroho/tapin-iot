#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN  D2
#define RST_PIN D1
#define BUZZER  D8   // Buzzer di D8 (GPIO15)

MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2); // alamat umum I2C LCD

void setup() {
  // Setup buzzer
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);   // pastikan diam saat boot

  // Inisialisasi Serial
  Serial.begin(115200);
  delay(2000);
  Serial.println();
  Serial.println("=== Tes Modul RFID RC522 + LCD + Buzzer ===");

  // Inisialisasi I2C LCD
  Wire.begin(D4, D3); // SDA = D4 (GPIO2), SCL = D3 (GPIO0)
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("RFID System Ready");
  lcd.setCursor(0, 1);
  lcd.print("Scan your card...");

  // Inisialisasi SPI & RFID
  SPI.begin();
  rfid.PCD_Init();
  delay(50);

  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print("Versi Firmware RC522: 0x");
  Serial.println(v, HEX);

  if (v == 0x00 || v == 0xFF) {
    Serial.println("❌ GAGAL: Modul RFID tidak terdeteksi!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("RFID Not Found!");
  } else {
    Serial.println("✅ Modul RFID terdeteksi!");
    Serial.println("Tempelkan kartu RFID...");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("RFID Detected OK");
    lcd.setCursor(0, 1);
    lcd.print("Tap your card...");
  }
}

void loop() {
  // Jika belum ada kartu baru, keluar dari loop
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  // Tampilkan UID ke Serial Monitor
  Serial.print("UID: ");
  String uidString = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i], HEX);
    Serial.print(" ");
    uidString += String(rfid.uid.uidByte[i], HEX);
    uidString += " ";
  }
  Serial.println();

  // Tampilkan UID di LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Card Detected!");
  lcd.setCursor(0, 1);
  lcd.print(uidString);

  // === Bunyikan buzzer keras sekali ===
  tone(BUZZER, 3000, 400);  // 3 kHz, durasi 400 ms
  delay(500);

  // Beri jeda sebelum membaca kartu berikutnya
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(2000); // waktu tampilan UID
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scan next card...");
}
