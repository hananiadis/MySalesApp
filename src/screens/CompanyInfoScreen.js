import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';

import SafeScreen from '../components/SafeScreen';
import { BRAND_LABEL } from '../constants/brands';
import colors from '../theme/colors';

const LOCAL_BANK_LOGOS = {
  alpha: require('../../assets/alphabank_logo.png'),
  nbg: require('../../assets/nbg_logo.png'),
  eurobank: require('../../assets/eurobank_logo.png'),
  piraeus: require('../../assets/piraeusbank_logo.png'),
};

const COMPANY_DATA = {
  kivos: {
    name: 'Ανανιάδου Αναστασία Κ ΣΙΑ ΟΕ',
    profession: 'Αντιπροσωπείες - Χονδρικό Εμπόριο',
    phone: '2310752955',
    email: 'info@mykivos.gr',
    address: '28ης Οκτωβρίου 66',
    city: 'Καλοχώρι',
    postalCode: '57009',
    prefecture: 'Θεσσαλονίκης',
    vat: '800364203',
    taxOffice: "ΔΟΥ Ιωνίας Θεσσαλονίκης",
    gemi: '118466704000',
    registry: '',
    banks: [
      {
        bank: 'Alpha Bank',
        account: '722002002002910',
        iban: 'GR7001407220722002002002910',
        logo: 'https://www.alpha.gr/-/media/AlphaGr/Images/logo/alphaBank_logo.svg?iar=0&hash=1F750DEDB5C3D48D59DCC4FB13FC7F07',
      },
      {
        bank: 'Εθνική Τράπεζα',
        account: '83944028634',
        iban: 'GR5301108390000083944028634',
        logo: 'https://www.nbg.gr/-/jssmedia/nbgportal/src/logo-black.svg',
      },
      {
        bank: 'Τράπεζα Πειραιώς',
        account: '6540142808397',
        iban: 'GR4001715400006540142808397',
        logo: 'https://www.ebanking.piraeusbank.gr/sites/corporate/SiteCollectionImages/EL/Images/piraeus.svg',
      },
    ],
  },
  playmobil: {
    name: 'Playmobil Hellas Μονοπρόσωπη Α.Ε.',
    profession: 'Εισαγωγή και εμπορία παιχνιδιών',
    phone: '2108000018',
    email: 'info@playmobil.gr',
    address: 'Αμαλιάδος 4 & Καλαβρύτων',
    city: 'Κηφησιά',
    postalCode: '14564',
    prefecture: 'Αττικής',
    vat: '094283517',
    taxOffice: 'ΔΟΥ Κηφισιάς',
    gemi: '640201000',
    registry: 'Μητρώο: 2582',
    banks: [
      {
        bank: 'Alpha Bank',
        account: '121 00 2320 000 129',
        iban: 'GR22 0140 1210 1210 0232 0000 129',
        logo: 'https://www.alpha.gr/-/media/AlphaGr/Images/logo/alphaBank_logo.svg?iar=0&hash=1F750DEDB5C3D48D59DCC4FB13FC7F07',
      },
      {
        bank: 'Εθνική Τράπεζα',
        account: '1414 7071 923',
        iban: 'GR74 0110 1410 0000 1414 7071 923',
        logo: 'https://www.nbg.gr/-/jssmedia/nbgportal/src/logo-black.svg',
      },
    ],
  },
  john: {
    name: 'John Hellas ΕΠΕ',
    profession: 'Εισαγωγή και εμπορία παιχνιδιών',
    phone: '2310688653',
    email: 'info@johnhellas.gr',
    address: 'Μακεδονικού Αγώνα 14, Τ.Θ. 364',
    city: 'Ωραιόκαστρο',
    postalCode: '57013',
    prefecture: 'Θεσσαλονίκης',
    vat: '999293775',
    taxOffice: "ΔΟΥ Αμπελοκήπων Θεσσαλονίκης",
    gemi: '58787404000',
    registry: 'Αρ. Μητρώου 13567',
    banks: [
      {
        bank: 'Alpha Bank',
        account: '473002320000738',
        iban: 'GR0201404730473002320000738',
        logo: 'https://www.alpha.gr/-/media/AlphaGr/Images/logo/alphaBank_logo.svg?iar=0&hash=1F750DEDB5C3D48D59DCC4FB13FC7F07',
      },
      {
        bank: 'Εθνική Τράπεζα',
        account: '89447018287',
        iban: 'GR8401108940000089447018287',
        logo: 'https://www.nbg.gr/-/jssmedia/nbgportal/src/logo-black.svg',
      },
      {
        bank: 'Τράπεζα Πειραιώς',
        account: '6564104936043',
        iban: 'GR3401715640006564104936043',
        logo: 'https://www.ebanking.piraeusbank.gr/sites/corporate/SiteCollectionImages/EL/Images/piraeus.svg',
      },
      {
        bank: 'Eurobank',
        account: '00260183270200411641',
        iban: 'GR3702601830000270200411641',
        logo: 'https://www.eurobank.gr/-/media/eurobank/logo/eurobank_svg.svg?iar=0&hash=C480ACB253179CA43344E1E6CF935447',
      },
    ],
  },
};

const CompanyInfoScreen = ({ route }) => {
  const brand = route?.params?.brand ?? 'kivos';
  const info = useMemo(() => COMPANY_DATA[brand] || null, [brand]);
  const companyName = info?.name || BRAND_LABEL[brand] || brand;

  const handleShare = useCallback(async () => {
    if (!info) return;
    const brandLabel = BRAND_LABEL[brand] || brand;
    const lines = [
      `${companyName} (${brandLabel})`,
      `Επάγγελμα: ${info.profession}`,
      `Τηλέφωνο: ${info.phone}`,
      `Email: ${info.email}`,
      `Διεύθυνση: ${info.address}`,
      `Πόλη: ${info.city} Τ.Κ.: ${info.postalCode}`,
      `Νομός: ${info.prefecture}`,
      `ΑΦΜ: ${info.vat}`,
      `ΔΟΥ: ${info.taxOffice}`,
      `Γ.Ε.ΜΗ.: ${info.gemi}`,
      `Αρ. Μητρώου: ${info.registry || '-'}`,
    ];

    if (Array.isArray(info.banks) && info.banks.length) {
      lines.push('', 'Τραπεζικοί λογαριασμοί:');
      info.banks.forEach((bank) => {
        lines.push(`- ${bank.bank}: ${bank.account}`, `  IBAN: ${bank.iban}`);
      });
    }

    try {
      await Share.share({ message: lines.join('\n') });
    } catch (err) {
      Alert.alert('Αδυναμία κοινοποίησης', err?.message || 'Κάτι πήγε στραβά κατά την κοινοποίηση.');
    }
  }, [brand, companyName, info]);

  return (
    <SafeScreen
      title="Στοιχεία εταιρείας"
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll
    >
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.brandLabel}>{BRAND_LABEL[brand] || brand}</Text>
          </View>
          {info ? (
            <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={18} color={colors.white} />
              <Text style={styles.shareButtonText}>Κοινοποίηση</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {info ? (
          <>
            <Text style={styles.sectionTitle}>Γενικά στοιχεία</Text>
            <InfoRow label="Επάγγελμα" value={info.profession} />
            <InfoRow label="Τηλέφωνο" value={info.phone} />
            <InfoRow label="Email" value={info.email} />
            <InfoRow label="Διεύθυνση" value={info.address} />
            <InfoRow label="Πόλη" value={`${info.city} Τ.Κ.: ${info.postalCode}`} />
            <InfoRow label="Νομός" value={info.prefecture} />

            <Text style={styles.sectionTitle}>Φορολογικά στοιχεία</Text>
            <InfoRow label="ΑΦΜ" value={info.vat} />
            <InfoRow label="ΔΟΥ" value={info.taxOffice} />
            <InfoRow label="Γ.Ε.ΜΗ." value={info.gemi} />
            <InfoRow label="Αρ. Μητρώου" value={info.registry || '-'} />

            {Array.isArray(info.banks) && info.banks.length ? (
              <>
                <Text style={styles.sectionTitle}>Τραπεζικοί λογαριασμοί</Text>
                {info.banks.map((bank) => (
                  <BankRow key={`${info.vat}-${bank.bank}-${bank.account}`} bank={bank} />
                ))}
              </>
            ) : null}
          </>
        ) : (
          <Text style={styles.hint}>Δεν βρέθηκαν πληροφορίες για το brand.</Text>
        )}
      </View>
    </SafeScreen>
  );
};

const InfoRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <View style={styles.infoValueWrap}>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
};

const BankRow = ({ bank }) => (
  <View style={styles.bankRow}>
    <View style={styles.bankLogoWrap}>
      <BankLogo uri={bank.logo} name={bank.bank} />
    </View>
    <View style={styles.bankInfo}>
      <Text style={styles.bankName}>{bank.bank}</Text>
      <View style={styles.bankLineRow}>
        <Text style={styles.bankLine}>Λογαριασμός: {bank.account}</Text>
      </View>
      <View style={styles.bankLineRow}>
        <Text style={styles.bankLine}>IBAN: {bank.iban}</Text>
      </View>
    </View>
  </View>
);

const resolveBankLogoSource = (name, uri) => {
  const lowerName = (name || '').toLowerCase();
  const lowerUri = (uri || '').toLowerCase();

  if (lowerName.includes('alpha') || lowerUri.includes('alpha')) {
    return LOCAL_BANK_LOGOS.alpha;
  }
  if (lowerName.includes('eurobank') || lowerUri.includes('eurobank')) {
    return LOCAL_BANK_LOGOS.eurobank;
  }
  if (
    lowerName.includes('nbg') ||
    lowerName.includes('ethniki') ||
    lowerName.includes('εθν') ||
    lowerUri.includes('nbg')
  ) {
    return LOCAL_BANK_LOGOS.nbg;
  }
  if (
    lowerName.includes('piraeus') ||
    lowerName.includes('πειρ') ||
    lowerUri.includes('piraeus')
  ) {
    return LOCAL_BANK_LOGOS.piraeus;
  }

  return uri || null;
};

const BankLogo = ({ uri, name }) => {
  const resolvedSource = resolveBankLogoSource(name, uri);
  const [resolvedUri, setResolvedUri] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!resolvedSource) {
        setResolvedUri(null);
        return;
      }

      if (typeof resolvedSource === 'number') {
        const asset = Asset.fromModule(resolvedSource);
        await asset.downloadAsync();
        if (!cancelled) {
          setResolvedUri(asset.localUri || asset.uri || null);
        }
      } else {
        setResolvedUri(resolvedSource);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [resolvedSource]);

  if (!resolvedUri) return null;
  return <Image source={{ uri: resolvedUri }} style={styles.bankLogo} resizeMode="contain" />;
};

const styles = StyleSheet.create({
  body: {
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  companyName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  brandLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  shareButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  infoLabel: {
    width: 140,
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  infoValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  bankLogoWrap: {
    width: 80,
    height: 50,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankLogo: {
    width: 70,
    height: 46,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  bankLine: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bankLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});

export default CompanyInfoScreen;
