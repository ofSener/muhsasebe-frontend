-- ============================================================================
-- FRONTEND ICIN EKLENMESI GEREKEN TABLOLAR
-- ============================================================================
-- Tarih: 2026-01-19 (Guncellendi)
-- Aciklama: Frontend'de kullanilan ama mevcut tablolarda karsiligi olmayan tablolar
-- ============================================================================
-- NOT: Sigorta sirketleri, firmalar, subeler, acente kodlari ve komisyon oranlari
--      tablolari artik "Kullanilcak Tablolar.txt" dosyasinda mevcut.
-- ============================================================================


-- ============================================================================
-- 1. TAHSILAT/TAKSIT TABLOSU (KRITIK)
-- ============================================================================
-- Kullanim: Police bazli taksit ve odeme takibi
-- Frontend: Tahsilat Takibi sayfasi (finance/collections.html)

CREATE TABLE `muhasebe_tahsilatlar` (
	`ID` INT(11) NOT NULL AUTO_INCREMENT,
	`PoliceId` INT(11) NOT NULL COMMENT 'muhasebe_police.Id ile iliskili',
	`MusteriId` INT(11) NOT NULL COMMENT 'muhasebe_musteriler.ID ile iliskili',
	`FirmaId` INT(11) NOT NULL,
	`TahsilatKodu` VARCHAR(20) NULL DEFAULT NULL COMMENT 'Tahsilat referans kodu' COLLATE 'utf8_turkish_ci',
	`TaksitNo` TINYINT(4) NULL DEFAULT '1' COMMENT 'Taksit numarasi',
	`ToplamTaksitSayisi` TINYINT(4) NULL DEFAULT '1' COMMENT 'Toplam taksit sayisi',
	`TaksitTutari` DECIMAL(12,2) NOT NULL COMMENT 'Taksit tutari',
	`OdenenTutar` DECIMAL(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Odenen tutar',
	`KalanTutar` DECIMAL(12,2) NOT NULL COMMENT 'Kalan tutar',
	`VadeTarihi` DATE NOT NULL COMMENT 'Vade tarihi',
	`OdemeTarihi` DATE NULL DEFAULT NULL COMMENT 'Odeme yapilan tarih',
	`OdemeDurumu` TINYINT(4) NOT NULL DEFAULT '0' COMMENT '0=Bekliyor, 1=Odendi, 2=Gecikti, 3=Kismi Odendi, 4=Iptal',
	`OdemeTipi` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Nakit, Kredi Karti, Havale vb.' COLLATE 'utf8_turkish_ci',
	`BankaAdi` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8_turkish_ci',
	`DekontNo` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8_turkish_ci',
	`Aciklama` TEXT NULL DEFAULT NULL COLLATE 'utf8_turkish_ci',
	`HatirlatmaGonderildi` TINYINT(1) NULL DEFAULT '0' COMMENT 'SMS/Email hatirlatma gonderildi mi',
	`EklenmeTarihi` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`GuncellenmeTarihi` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	`GuncelleyenUyeId` INT(11) NULL DEFAULT NULL,
	PRIMARY KEY (`ID`) USING BTREE,
	INDEX `PoliceId` (`PoliceId`) USING BTREE,
	INDEX `MusteriId` (`MusteriId`) USING BTREE,
	INDEX `FirmaId` (`FirmaId`) USING BTREE,
	INDEX `VadeTarihi` (`VadeTarihi`) USING BTREE,
	INDEX `OdemeTarihi` (`OdemeTarihi`) USING BTREE,
	INDEX `OdemeDurumu` (`OdemeDurumu`) USING BTREE,
	INDEX `TahsilatKodu` (`TahsilatKodu`) USING BTREE
)
COLLATE='utf8_turkish_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1
;


-- ============================================================================
-- 2. FINANSAL ISLEMLER/HAREKETLER TABLOSU (ORTA ONCELIK)
-- ============================================================================
-- Kullanim: Gelir/gider takibi, finansal hareketler
-- Frontend: Finans Dashboard, Raporlar (finance/dashboard.html, finance/reports.html)

CREATE TABLE `muhasebe_finansalislemler` (
	`ID` INT(11) NOT NULL AUTO_INCREMENT,
	`FirmaId` INT(11) NOT NULL,
	`SubeId` INT(11) NULL DEFAULT NULL,
	`IslemKodu` VARCHAR(20) NULL DEFAULT NULL COMMENT 'Islem referans kodu' COLLATE 'utf8_turkish_ci',
	`IslemTipi` TINYINT(4) NOT NULL COMMENT '1=Gelir, 2=Gider, 3=Komisyon, 4=Iade',
	`Kategori` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Police, Komisyon, Ofis Gideri vb.' COLLATE 'utf8_turkish_ci',
	`PoliceId` INT(11) NULL DEFAULT NULL COMMENT 'Police ile iliskiliyse',
	`MusteriId` INT(11) NULL DEFAULT NULL,
	`CalisanId` INT(11) NULL DEFAULT NULL,
	`Tutar` DECIMAL(12,2) NOT NULL,
	`ParaBirimi` VARCHAR(5) NULL DEFAULT 'TRY' COLLATE 'utf8_turkish_ci',
	`Kur` DECIMAL(10,4) NULL DEFAULT '1.0000',
	`IslemTarihi` DATE NOT NULL,
	`VadeTarihi` DATE NULL DEFAULT NULL,
	`Aciklama` TEXT NULL DEFAULT NULL COLLATE 'utf8_turkish_ci',
	`BelgeNo` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Fatura/makbuz no' COLLATE 'utf8_turkish_ci',
	`Durum` TINYINT(4) NOT NULL DEFAULT '1' COMMENT '1=Aktif, 0=Iptal',
	`EklenmeTarihi` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`GuncellenmeTarihi` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	`EkleyenUyeId` INT(11) NULL DEFAULT NULL,
	PRIMARY KEY (`ID`) USING BTREE,
	INDEX `FirmaId` (`FirmaId`) USING BTREE,
	INDEX `SubeId` (`SubeId`) USING BTREE,
	INDEX `IslemTipi` (`IslemTipi`) USING BTREE,
	INDEX `PoliceId` (`PoliceId`) USING BTREE,
	INDEX `MusteriId` (`MusteriId`) USING BTREE,
	INDEX `CalisanId` (`CalisanId`) USING BTREE,
	INDEX `IslemTarihi` (`IslemTarihi`) USING BTREE,
	INDEX `IslemKodu` (`IslemKodu`) USING BTREE,
	INDEX `Durum` (`Durum`) USING BTREE
)
COLLATE='utf8_turkish_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1
;


-- ============================================================================
-- 3. KOMISYON DETAY/HAKEDIS TABLOSU (ORTA ONCELIK)
-- ============================================================================
-- Kullanim: Calisan bazli komisyon takibi ve hakedis
-- Frontend: Komisyon sayfasi (employees/commission.html), Takip/Hakedis (employees/tracking.html)
-- NOT: muhasebe_komisyonoranlari AYARLARI tutar, bu tablo ise GERCEKLESEN komisyonlari tutar

CREATE TABLE `muhasebe_komisyonlar` (
	`ID` INT(11) NOT NULL AUTO_INCREMENT,
	`FirmaId` INT(11) NOT NULL,
	`CalisanId` INT(11) NOT NULL COMMENT 'sigortakullanicilist.ID ile iliskili',
	`PoliceId` INT(11) NOT NULL COMMENT 'muhasebe_police.Id ile iliskili',
	`KomisyonOrani` DECIMAL(5,2) NOT NULL COMMENT 'Komisyon orani %',
	`KomisyonTutari` DECIMAL(12,2) NOT NULL COMMENT 'Komisyon tutari',
	`Donem` VARCHAR(7) NOT NULL COMMENT 'YYYY-MM formatinda donem' COLLATE 'utf8_turkish_ci',
	`OdemeDurumu` TINYINT(4) NOT NULL DEFAULT '0' COMMENT '0=Bekliyor, 1=Odendi, 2=Kismi',
	`OdenenTutar` DECIMAL(12,2) NULL DEFAULT '0.00',
	`OdemeTarihi` DATE NULL DEFAULT NULL,
	`Aciklama` TEXT NULL DEFAULT NULL COLLATE 'utf8_turkish_ci',
	`EklenmeTarihi` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`GuncellenmeTarihi` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`ID`) USING BTREE,
	INDEX `FirmaId` (`FirmaId`) USING BTREE,
	INDEX `CalisanId` (`CalisanId`) USING BTREE,
	INDEX `PoliceId` (`PoliceId`) USING BTREE,
	INDEX `Donem` (`Donem`) USING BTREE,
	INDEX `OdemeDurumu` (`OdemeDurumu`) USING BTREE
)
COLLATE='utf8_turkish_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1
;


-- ============================================================================
-- 4. AKTIVITE LOG TABLOSU (ORTA ONCELIK)
-- ============================================================================
-- Kullanim: Sistem aktiviteleri ve islem gecmisi
-- Frontend: Dashboard son aktiviteler (index.html)

CREATE TABLE `muhasebe_aktiviteler` (
	`ID` INT(11) NOT NULL AUTO_INCREMENT,
	`FirmaId` INT(11) NOT NULL,
	`UyeId` INT(11) NULL DEFAULT NULL COMMENT 'Islemi yapan kullanici',
	`AktiviteTipi` VARCHAR(50) NOT NULL COMMENT 'POLICE_CREATED, PAYMENT_RECEIVED vb.' COLLATE 'utf8_turkish_ci',
	`EntityTipi` VARCHAR(30) NULL DEFAULT NULL COMMENT 'police, musteri, tahsilat vb.' COLLATE 'utf8_turkish_ci',
	`EntityId` INT(11) NULL DEFAULT NULL COMMENT 'Ilgili kaydin ID si',
	`Baslik` VARCHAR(200) NOT NULL COMMENT 'Aktivite basligi' COLLATE 'utf8_turkish_ci',
	`Aciklama` TEXT NULL DEFAULT NULL COMMENT 'Detayli aciklama' COLLATE 'utf8_turkish_ci',
	`EskiDeger` TEXT NULL DEFAULT NULL COMMENT 'Degisiklik oncesi deger (JSON)' COLLATE 'utf8_turkish_ci',
	`YeniDeger` TEXT NULL DEFAULT NULL COMMENT 'Degisiklik sonrasi deger (JSON)' COLLATE 'utf8_turkish_ci',
	`IpAdresi` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8_turkish_ci',
	`Tarih` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`ID`) USING BTREE,
	INDEX `FirmaId` (`FirmaId`) USING BTREE,
	INDEX `UyeId` (`UyeId`) USING BTREE,
	INDEX `AktiviteTipi` (`AktiviteTipi`) USING BTREE,
	INDEX `EntityTipi` (`EntityTipi`) USING BTREE,
	INDEX `EntityId` (`EntityId`) USING BTREE,
	INDEX `Tarih` (`Tarih`) USING BTREE
)
COLLATE='utf8_turkish_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1
;


-- ============================================================================
-- 5. BILDIRIM TABLOSU (DUSUK ONCELIK)
-- ============================================================================
-- Kullanim: Yenileme hatirlatmalari, tahsilat uyarilari
-- Frontend: Dashboard uyarilar, bildirim sistemi

CREATE TABLE `muhasebe_bildirimler` (
	`ID` INT(11) NOT NULL AUTO_INCREMENT,
	`FirmaId` INT(11) NOT NULL,
	`UyeId` INT(11) NULL DEFAULT NULL COMMENT 'Bildirimin gidecegi kullanici (NULL=Tum yetkililere)',
	`BildirimTipi` VARCHAR(50) NOT NULL COMMENT 'YENILEME, TAHSILAT, SISTEM vb.' COLLATE 'utf8_turkish_ci',
	`Oncelik` TINYINT(4) NULL DEFAULT '2' COMMENT '1=Dusuk, 2=Normal, 3=Yuksek, 4=Kritik',
	`Baslik` VARCHAR(200) NOT NULL COLLATE 'utf8_turkish_ci',
	`Mesaj` TEXT NOT NULL COLLATE 'utf8_turkish_ci',
	`EntityTipi` VARCHAR(30) NULL DEFAULT NULL COLLATE 'utf8_turkish_ci',
	`EntityId` INT(11) NULL DEFAULT NULL,
	`LinkUrl` VARCHAR(300) NULL DEFAULT NULL COMMENT 'Tiklandiginda gidilecek sayfa' COLLATE 'utf8_turkish_ci',
	`Okundu` TINYINT(1) NOT NULL DEFAULT '0',
	`OkunmaTarihi` DATETIME NULL DEFAULT NULL,
	`OlusturmaTarihi` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`SonGecerlilikTarihi` DATE NULL DEFAULT NULL COMMENT 'Bildirimin gecerli oldugu son tarih',
	PRIMARY KEY (`ID`) USING BTREE,
	INDEX `FirmaId` (`FirmaId`) USING BTREE,
	INDEX `UyeId` (`UyeId`) USING BTREE,
	INDEX `BildirimTipi` (`BildirimTipi`) USING BTREE,
	INDEX `Okundu` (`Okundu`) USING BTREE,
	INDEX `OlusturmaTarihi` (`OlusturmaTarihi`) USING BTREE,
	INDEX `Oncelik` (`Oncelik`) USING BTREE
)
COLLATE='utf8_turkish_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1
;


-- ============================================================================
-- 6. IL TABLOSU (DUSUK ONCELIK)
-- ============================================================================
-- Kullanim: muhasebe_policerizikoadres.IlId, adres secimleri
-- Frontend: Adres formlarinda il dropdown

CREATE TABLE `muhasebe_iller` (
	`ID` INT(11) NOT NULL AUTO_INCREMENT,
	`PlakaKodu` VARCHAR(2) NOT NULL COMMENT 'Plaka kodu (01-81)' COLLATE 'utf8_turkish_ci',
	`IlAdi` VARCHAR(30) NOT NULL COLLATE 'utf8_turkish_ci',
	`Aktif` TINYINT(1) NOT NULL DEFAULT '1',
	PRIMARY KEY (`ID`) USING BTREE,
	INDEX `PlakaKodu` (`PlakaKodu`) USING BTREE,
	INDEX `IlAdi` (`IlAdi`) USING BTREE
)
COLLATE='utf8_turkish_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1
;


-- ============================================================================
-- 7. ILCE TABLOSU (DUSUK ONCELIK)
-- ============================================================================
-- Kullanim: muhasebe_policerizikoadres.IlceId, adres secimleri
-- Frontend: Adres formlarinda ilce dropdown

CREATE TABLE `muhasebe_ilceler` (
	`ID` INT(11) NOT NULL AUTO_INCREMENT,
	`IlId` INT(11) NOT NULL COMMENT 'muhasebe_iller.ID ile iliskili',
	`IlceAdi` VARCHAR(50) NOT NULL COLLATE 'utf8_turkish_ci',
	`Aktif` TINYINT(1) NOT NULL DEFAULT '1',
	PRIMARY KEY (`ID`) USING BTREE,
	INDEX `IlId` (`IlId`) USING BTREE,
	INDEX `IlceAdi` (`IlceAdi`) USING BTREE
)
COLLATE='utf8_turkish_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1
;


-- ============================================================================
-- OZET - EKLENMESI GEREKEN TABLOLAR (7 adet)
-- ============================================================================
--
-- KRITIK (Mutlaka Eklenmeli):
-- 1. muhasebe_tahsilatlar        - Tahsilat/Taksit takibi
--
-- ORTA ONCELIK (Onerilir):
-- 2. muhasebe_finansalislemler   - Finansal hareketler
-- 3. muhasebe_komisyonlar        - Komisyon detaylari/Hakedis (AYAR degil, ISLEM kaydi)
-- 4. muhasebe_aktiviteler        - Aktivite loglari
--
-- DUSUK ONCELIK (Istege Bagli):
-- 5. muhasebe_bildirimler        - Bildirim sistemi
-- 6. muhasebe_iller              - Il listesi
-- 7. muhasebe_ilceler            - Ilce listesi
--
-- ============================================================================
-- MEVCUT TABLOLAR (Kullanilcak Tablolar.txt'de mevcut - 15 adet):
-- ============================================================================
-- 1.  muhasebe_yakalananpoliceler - Yakalanan policeler
-- 2.  muhasebe_yetkiadlari        - Yetki adlari
-- 3.  muhasebe_yetkiler           - Yetkiler
-- 4.  muhasebe_police             - Ana uretim tablosu
-- 5.  muhasebe_policehavuz        - Havuz policeleri
-- 6.  sigortapoliceturleri        - Police turleri/Branslar
-- 7.  muhasebe_policerizikoadres  - Riziko adresleri
-- 8.  muhasebe_policesigortali    - Police sigortalilari
-- 9.  muhasebe_musteriler         - Musteriler
-- 10. sigortakullanicilist        - Calisanlar/Kullanicilar
-- 11. muhasebe_sigortasirketi     - Sigorta sirketleri
-- 12. sigortasubeler              - Subeler
-- 13. sigortafirmalist            - Firma listesi
-- 14. muhasebe_acentekodlari      - Acente kodlari
-- 15. muhasebe_komisyonoranlari   - Komisyon oranlari AYARLARI (YENİ)
-- ============================================================================
