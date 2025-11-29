import React, { useCallback, useEffect } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import SafeScreen from '../components/SafeScreen';
import { BRAND_LABEL } from '../constants/brands';

const BRAND_CATALOGS = {
  playmobil: {
    label: BRAND_LABEL.playmobil || 'Playmobil',
    description: 'Ενημερωθείτε για τους πιο πρόσφατους καταλόγους προϊόντων Playmobil.',
    catalogs: [
      {
        title: 'Playmobil Κατάλογος 2025 (Excel)',
        url: 'https://www.dropbox.com/scl/fi/r1nw149vzgzlll69kr76d/2025_.xlsx?rlkey=hhe57zlsayw65ha5a9ee6p8dd&st=m02z5lzu&dl=0',
        type: 'Excel',
      },
      {
        title: 'Playmobil Βασικός Κατάλογος 2025 (PDF)',
        url: 'https://playmobil.a.bigcontent.io/v1/static/85684_CC_25-2_GR_Web-250623',
        type: 'PDF',
      },
      {
        title: 'Playmobil Exclusives 2025 (Online)',
        url: 'https://online.fliphtml5.com/gtcjg/vtzx/',
        type: 'Online',
      },
      {
        title: 'Playmobil Junior (PDF)',
        url: 'https://playmobil.a.bigcontent.io/v1/static/FINAL_WEB_GR_Junior_Katalog_2024_ONLINE_mit_Tinti_1',
        type: 'PDF',
      },
    ],
  },
  kivos: {
    label: BRAND_LABEL.kivos || 'Kivos',
    description: 'Κατάλογοι "Ανανιάδου Αναστασία κ ΣΙΑ ΟΕ"',
    catalogs: [
      {
        title: 'Logo Κατάλογος Σχολικών Ειδών (Online)',
        url: 'https://online.fliphtml5.com/gtcjg/cbju/',
        type: 'Online',
      },
      {
        title: 'Logo Κατάλογος Τεχνικών & Επαγγελματικών Προϊόντων (Online)',
        url: 'https://online.fliphtml5.com/gtcjg/xcod/',
        type: 'Online',
      },
    ],
  },
  john: {
    label: BRAND_LABEL.john || 'John Hellas',
    description: 'Κατάλογοι John Hellas και συνεργαζόμενων brands (Ravensburger, κ.ά.).',
    catalogs: [
      {
        title: 'John Hellas 2025 (PDF)',
        url: 'https://johnhellas.gr/show_pdf/?file=https://johnhellas.gr/download_catalogue?download_id=69',
        type: 'PDF',
      },
      {
        title: 'Ravensburger 2025 (PDF)',
        url: 'https://johnhellas.gr/show_pdf/?file=https://johnhellas.gr/download_catalogue?download_id=70',
        type: 'PDF',
      },
      {
        title: 'John Hellas Excel Κατάλογος',
        url: 'https://www.dropbox.com/scl/fi/7pfg0zsgokiq4ugosft0p/John-Hellas.xlsm?rlkey=76kkhtv01782zsmhqjjy73vk0&st=17et37pp&dl=0',
        type: 'Excel',
      },
    ],
  },
};

const CatalogScreen = ({ navigation, route }) => {
  const brandParam = (route?.params?.brand || 'playmobil').toLowerCase();
  const brandData = BRAND_CATALOGS[brandParam] || BRAND_CATALOGS.playmobil;
  const { label: brandName, description, catalogs } = brandData;

  const handleGoBack = useCallback(() => {
    navigation.navigate('BrandHome', { brand: brandParam });
  }, [brandParam, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (event.data.action?.type === 'GO_BACK') {
        event.preventDefault();
        handleGoBack();
      }
    });
    return unsubscribe;
  }, [navigation, handleGoBack]);

  const handleOpenLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η πρόσβαση στον σύνδεσμο.');
      }
    } catch (error) {
      Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η πρόσβαση στον σύνδεσμο.');
    }
  };

  const handleShareLink = async (title, url) => {
    try {
      await Share.share({ message: `${title}\n${url}`, url, title });
    } catch (error) {
      Alert.alert('Σφάλμα', 'Η κοινοποίηση απέτυχε.');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'PDF':
        return 'document-text-outline';
      case 'Excel':
        return 'grid-outline';
      case 'Online':
        return 'globe-outline';
      default:
        return 'link-outline';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'PDF':
        return '#ef4444';
      case 'Excel':
        return '#10b981';
      case 'Online':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  return (
    <SafeScreen
      title={`Κατάλογοι ${brandName}`}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
          accessibilityLabel="Επιστροφή στο brand"
        >
          <Ionicons name="arrow-back" size={24} color="#1f4f8f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{`Κατάλογοι ${brandName}`}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Ionicons name="library-outline" size={48} color="#1f4f8f" />
          <Text style={styles.introTitle}>{`Κατάλογοι ${brandName}`}</Text>
          <Text style={styles.introText}>{description}</Text>
        </View>

        <View style={styles.catalogList}>
          {catalogs.map((catalog) => (
            <View key={catalog.title} style={styles.catalogItem}>
              <View style={styles.catalogInfo}>
                <View style={styles.catalogHeader}>
                  <Ionicons
                    name={getTypeIcon(catalog.type)}
                    size={20}
                    color={getTypeColor(catalog.type)}
                  />
                  <Text style={styles.catalogType}>{catalog.type}</Text>
                </View>
                <Text style={styles.catalogTitle}>{catalog.title}</Text>
              </View>

              <View style={styles.catalogActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenLink(catalog.url)}
                  accessibilityLabel="Άνοιγμα συνδέσμου"
                >
                  <Ionicons name="open-outline" size={20} color="#1f4f8f" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleShareLink(catalog.title, catalog.url)}
                  accessibilityLabel="Κοινοποίηση συνδέσμου"
                >
                  <Ionicons name="share-social-outline" size={20} color="#1f4f8f" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f1fb',
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#1f4f8f',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  introSection: {
    alignItems: 'center',
    backgroundColor: '#f1f5ff',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  introTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#103a7d',
  },
  introText: {
    marginTop: 8,
    fontSize: 14,
    color: '#42526e',
    textAlign: 'center',
    lineHeight: 20,
  },
  catalogList: {
    gap: 16,
  },
  catalogItem: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  catalogInfo: {
    flex: 1,
    paddingRight: 12,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  catalogType: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#1f4f8f',
  },
  catalogTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  catalogActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e8f1fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacer: {
    height: 32,
  },
});

export default CatalogScreen;
