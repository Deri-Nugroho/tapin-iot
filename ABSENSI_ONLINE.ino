#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN D2
#define RST_PIN D1

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  delay(2000); // kasih waktu board nyala
  Serial.println();
  Serial.println("=== Tes Modul RFID RC522 ===");
  Serial.flush();

  SPI.begin();
  rfid.PCD_Init();
  delay(50);

  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print("Versi Firmware RC522: 0x");
  Serial.println(v, HEX);

  if (v == 0x00 || v == 0xFF) {
    Serial.println("❌ GAGAL: Modul RFID tidak terdeteksi!");
  } else {
    Serial.println("✅ Modul RFID terdeteksi!");
    Serial.println("Tempelkan kartu RFID...");
  }
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  Serial.print("UID: ");
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i], HEX);
    Serial.print(" ");
  }
  Serial.println();
  delay(1000);
}
