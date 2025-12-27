#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <time.h>

// ================= PIN =================
#define SS_PIN  D2
#define RST_PIN D1
#define BUZZER  D8

MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ============ WIFI ============
const char* ssid = "2D_HOME";       // ganti SSID
const char* password = "mieayamenak"; // ganti password

// ============ SERVER ============
const String SERVER_URL = "http://192.168.1.4:3000/api/attendance"; // ganti sesuai IP server
WiFiClient client;

// ============ NTP ============
#define GMT_OFFSET_SEC  7 * 3600
#define DAYLIGHT_OFFSET_SEC 0

// ============ MASTER CARD ============
const String MASTER_UID = "29288159";  // GANTI UID MASTER
bool readMode = false;  // false = absensi, true = baca UID

// ============ DATA SISWA ============
String uidList[]  = {"9215d29", "f2c8bdd", "2945ac29"};
String namaList[] = {"HAMDAN",  "SALSA",  "NAURA"};
const int jumlahSiswa = 3;

// ============ SCAN CONTROL ============
String lastUID = "";
unsigned long lastScanTime = 0;
const unsigned long scanDelay = 5000; // 5 detik minimal antar scan

// =====================================
void setup() {
  Serial.begin(115200);
  pinMode(BUZZER, OUTPUT);

  Wire.begin(D3, D4);
  lcd.init();
  lcd.backlight();

  SPI.begin();
  rfid.PCD_Init();

  // ===== WIFI =====
  lcd.clear();
  lcd.print("Connecting WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  // ===== NTP =====
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC,
             "pool.ntp.org", "time.nist.gov");

  lcd.clear();
  lcd.print("Mode: ABSENSI");
  delay(1500);
  lcd.clear();
  lcd.print("Scan Kartu...");
}

// =====================================
void loop() {

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  // ==== BACA UID ====
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  Serial.print("UID: ");
  Serial.println(uid);

  // ===== MASTER CARD =====
  if (uid.equalsIgnoreCase(MASTER_UID)) {
    readMode = !readMode;

    lcd.clear();
    if (readMode) {
      lcd.print("MODE: READ UID");
      Serial.println(">> MODE BACA UID AKTIF");
      tone(BUZZER, 3000, 200);
    } else {
      lcd.print("MODE: ABSENSI");
      Serial.println(">> MODE ABSENSI AKTIF");
      tone(BUZZER, 1500, 200);
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }

  // ===== MODE BACA UID =====
  if (readMode) {
    lcd.clear();
    lcd.print("UID TERDETEKSI");
    lcd.setCursor(0, 1);
    lcd.print(uid);

    Serial.println("READ UID MODE");

    tone(BUZZER, 2000, 100);

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }

  // ===== CEK DUPLIKAT SCAN =====
  if (uid.equalsIgnoreCase(lastUID) && (millis() - lastScanTime) < scanDelay) {
    Serial.println("Duplicate scan ignored");
    lcd.clear();
    lcd.print("Scan Ulang Dihindari");
    delay(1500);
    lcd.clear();
    lcd.print("Scan Kartu...");
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }

  lastUID = uid;
  lastScanTime = millis();

  // ===== MODE ABSENSI =====
  int index = -1;
  for (int i = 0; i < jumlahSiswa; i++) {
    if (uid.equalsIgnoreCase(uidList[i])) {
      index = i;
      break;
    }
  }

  lcd.clear();

  if (index != -1) {
    struct tm timeinfo;
    getLocalTime(&timeinfo);

    char waktu[6];
    sprintf(waktu, "%02d.%02d", timeinfo.tm_hour, timeinfo.tm_min);

    // KIRIM KE SERVER & AMBIL RESPONSE
    String response = sendAttendanceToServer(uidList[index], namaList[index], String(waktu));

    // ===== JIKA SUKSES =====
    if (response.indexOf("\"success\":true") != -1) {
      lcd.setCursor(0, 0);
      lcd.print(namaList[index]);
      lcd.setCursor(10, 0);
      lcd.print("|PUKUL");

      lcd.setCursor(0, 1);
      lcd.print("XII TJKT 1|");
      lcd.print(waktu);

      tone(BUZZER, 2000, 200);
    }
    // ===== JIKA SUDAH ABSEN =====
    else if (response.indexOf("Sudah melakukan absensi") != -1) {
      lcd.clear();
      lcd.print("SUDAH ABSEN");
      lcd.setCursor(0, 1);
      lcd.print("HARI INI");

      tone(BUZZER, 700, 400);
    }
    // ===== ERROR LAIN =====
    else {
      lcd.clear();
      lcd.print("ABSENSI GAGAL");
      tone(BUZZER, 500, 400);
    }
  }
  else {
    lcd.print("KARTU DITOLAK");
    tone(BUZZER, 800, 400);
  }

  delay(3000);
  lcd.clear();
  lcd.print("Scan Kartu...");

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// =====================================
// === FUNGSI KIRIM DATA KE SERVER ===
String sendAttendanceToServer(String uid, String nama, String waktu) {
  if (WiFi.status() != WL_CONNECTED) {
    return "WiFi disconnected";
  }

  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"uid\":\"" + uid + "\", \"nama\":\"" + nama + "\", \"waktu\":\"" + waktu + "\"}";
  int httpResponseCode = http.POST(payload);

  String response = "";

  if (httpResponseCode > 0) {
    response = http.getString();
    Serial.println("Server Response: " + response);
  } else {
    response = "HTTP Error";
  }

  http.end();
  return response;
}