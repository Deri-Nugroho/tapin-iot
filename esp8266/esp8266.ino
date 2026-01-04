#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
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

// ============ SERVER ============
const String SERVER_URL = "http://192.168.1.4:3000/api/attendance";
WiFiClient client;

// ============ NTP ============
#define GMT_OFFSET_SEC  (7 * 3600)
#define DAYLIGHT_OFFSET_SEC 0

// ============ MASTER CARD ============
const String MASTER_UID = "29288159";
bool readMode = false;

// ============ SCAN CONTROL ============
String lastUID = "";
unsigned long lastScanTime = 0;
const unsigned long scanDelay = 5000;

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
  lcd.print("ABSENSI RFID");
  delay(1500);
  lcd.clear();
  lcd.print("Tap Kartu...");
}

// =====================================
void loop() {

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toLowerCase();
  Serial.println("UID: " + uid);

  // ===== MASTER CARD =====
  if (uid == MASTER_UID) {
    readMode = !readMode;
    lcd.clear();
    lcd.print(readMode ? "MODE READ UID" : "MODE ABSENSI");
    tone(BUZZER, 2000, 200);
    delay(1500);
    lcd.clear();
    lcd.print("Tap Kartu...");
    haltRFID();
    return;
  }

  // ===== MODE READ UID =====
  if (readMode) {
    lcd.clear();
    lcd.print("UID:");
    lcd.setCursor(0, 1);
    lcd.print(uid);
    tone(BUZZER, 1500, 200);
    delay(3000);
    lcd.clear();
    lcd.print("Tap Kartu...");
    haltRFID();
    return;
  }

  // ===== ANTI DOUBLE TAP =====
  if (uid == lastUID && millis() - lastScanTime < scanDelay) {
    lcd.clear();
    lcd.print("Tap Berulang!");
    tone(BUZZER, 700, 200);
    delay(1500);
    lcd.clear();
    lcd.print("Tap Kartu...");
    haltRFID();
    return;
  }

  lastUID = uid;
  lastScanTime = millis();

  // ===== AMBIL WAKTU DARI ESP (NTP) =====
  struct tm timeinfo;
  getLocalTime(&timeinfo);

  char waktu[6];
  sprintf(waktu, "%02d.%02d", timeinfo.tm_hour, timeinfo.tm_min);

  // ===== KIRIM KE SERVER (UID SAJA) =====
  String response = sendAttendance(uid);
  handleServerResponse(response, waktu);

  delay(3000);
  lcd.clear();
  lcd.print("Tap Kartu...");
  haltRFID();
}

// =====================================
// === HANDLE RESPONSE SERVER ===
void handleServerResponse(String response, const char* waktuESP) {

  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, response)) {
    lcd.clear();
    lcd.print("SERVER ERROR");
    tone(BUZZER, 500, 400);
    return;
  }

  if (doc["success"] == true) {
    const char* nama  = doc["data"]["nama"];
    const char* kelas = doc["data"]["kelas"];

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(nama);
    lcd.setCursor(10, 0);
    lcd.print("|PUKUL");

    lcd.setCursor(0, 1);
    lcd.print(kelas);
    lcd.print(" |");
    lcd.print(waktuESP);

    tone(BUZZER, 2000, 200);
  } else {
    lcd.clear();
    lcd.print("ABSENSI GAGAL");
    lcd.setCursor(0, 1);
    lcd.print(doc["message"].as<const char*>());
    tone(BUZZER, 700, 400);
  }
}

// =====================================
// === SEND UID ONLY ===
String sendAttendance(String uid) {
  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"uid\":\"" + uid + "\"}";
  int code = http.POST(payload);

  String response = (code > 0)
      ? http.getString()
      : "{\"success\":false,\"message\":\"HTTP Error\"}";

  Serial.println("Server Response: " + response);
  http.end();
  return response;
}

// =====================================
void haltRFID() {
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}