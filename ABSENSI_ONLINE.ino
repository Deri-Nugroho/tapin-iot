#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP8266WiFi.h>
#include <time.h>

// ================= PIN =================
#define SS_PIN  D2
#define RST_PIN D1
#define BUZZER  D8

MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ============ WIFI ============
const char* ssid = "2D_HOME";
const char* password = "mieayamenak";

// ============ NTP ============
#define GMT_OFFSET_SEC  7 * 3600
#define DAYLIGHT_OFFSET_SEC 0

// ============ DATA SISWA ============
String uidList[]  = {"9215d29", "f2c8bdd", "2945ac29"};
String namaList[] = {"HAMDAN",  "SALSA",  "NAURA"};
const int jumlahSiswa = 3;

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
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
  lcd.clear();
  lcd.print("WiFi Connected");

  // ===== NTP =====
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, 
             "pool.ntp.org", "time.nist.gov");

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

  // ==== CEK UID ====
  int index = -1;
  for (int i = 0; i < jumlahSiswa; i++) {
    if (uid.equalsIgnoreCase(uidList[i])) {
      index = i;
      break;
    }
  }

  lcd.clear();

  if (index != -1) {
    // ==== AMBIL WAKTU NTP ====
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
      lcd.print("Waktu Error");
      return;
    }

    char waktu[6];
    sprintf(waktu, "%02d.%02d", timeinfo.tm_hour, timeinfo.tm_min);

    // ==== LCD FORMAT ====
    lcd.setCursor(0, 0);
    lcd.print(namaList[index]);
    lcd.setCursor(10, 0);
    lcd.print("|PUKUL");

    lcd.setCursor(0, 1);
    lcd.print("XII TJKT 1|");
    lcd.print(waktu);

    Serial.println("ABSEN BERHASIL");
    tone(BUZZER, 2000, 200);

  } else {
    lcd.print("KARTU DITOLAK");
    tone(BUZZER, 800, 400);
    Serial.println("KARTU TIDAK TERDAFTAR");
  }

  delay(3000);
  lcd.clear();
  lcd.print("Scan Kartu...");

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
