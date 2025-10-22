import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SafeScreen from '../components/SafeScreen';

const CatalogScreen = ({ navigation, route }) => {
  const { brand } = route.params || {};

  const playmobilCatalogs = [
    {
      title: 'Δελτίο Παραγγελίας 2025 Β\' Εξάμηνο',
      url: 'https://www.dropbox.com/scl/fi/r1nw149vzgzlll69kr76d/2025_.xlsx?rlkey=hhe57zlsayw65ha5a9ee6p8dd&st=m02z5lzu&dl=0',
      type: 'Excel',
    },
    {
      title: 'Κατάλογος 2025 Β\' Εξάμηνο',
      url: 'https://playmobil.a.bigcontent.io/v1/static/85684_CC_25-2_GR_Web-250623',
      type: 'PDF',
    },
    {
      title: 'Exclusives 2025 Β\' εξάμηνο (κωδικοί χωρίς απεικόνιση)',
      url: 'https://online.fliphtml5.com/gtcjg/vtzx/',
      type: 'Online',
    },
    {
      title: 'Κατάλογος Playmobil Junior',
      url: 'https://playmobil.a.bigcontent.io/v1/static/FINAL_WEB_GR_Junior_Katalog_2024_ONLINE_mit_Tinti_1',
      type: 'PDF',
    },
    {
      title: 'Διαφημιζόμενα TV',
      url: 'https://online.fliphtml5.com/gtcjg/mdqr/',
      type: 'Online',
    },
  ];

  const johnCatalogs = [
    {
      title: 'John Hellas 2025',
      url: 'https://johnhellas.gr/show_pdf/?file=https://johnhellas.gr/download_catalogue?download_id=69',
      type: 'PDF',
    },
    {
      title: 'Ravensburger 2025',
      url: 'https://johnhellas.gr/show_pdf/?file=https://johnhellas.gr/download_catalogue?download_id=70',
      type: 'PDF',
    },
    {
      title: 'Αρχείο Ειδών 2025',
      url: 'https://www.dropbox.com/scl/fi/7pfg0zsgokiq4ugosft0p/John-Hellas.xlsm?rlkey=76kkhtv01782zsmhqjjy73vk0&st=17et37pp&dl=0',
      type: 'Excel',
    },
  ];

  const catalogs = brand === 'playmobil' ? playmobilCatalogs : johnCatalogs;
  const brandName = brand === 'playmobil' ? 'Playmobil' : 'John Hellas';

  const handleOpenLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Σφάλμα', 'Δεν είναι δυνατό το άνοιγμα αυτού του συνδέσμου.');
      }
    } catch (error) {
      Alert.alert('Σφάλμα', 'Παρουσιάστηκε σφάλμα κατά το άνοιγμα του συνδέσμου.');
    }
  };

  const handleShareLink = async (title, url) => {
    try {
      await Share.share({
        message: `${title}\n\n${url}`,
        url: url,
        title: title,
      });
    } catch (error) {
      Alert.alert('Σφάλμα', 'Παρουσιάστηκε σφάλμα κατά την κοινοποίηση.');
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
    <SafeScreen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Επιστροφή"
          >
            <Ionicons name="arrow-back" size={24} color="#1f4f8f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Κατάλογοι {brandName}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.introSection}>
            <Ionicons name="library-outline" size={48} color="#1f4f8f" />
            <Text style={styles.introTitle}>Κατάλογοι {brandName}</Text>
            <Text style={styles.introText}>
              Επιλέξτε έναν κατάλογο για να τον προβάλετε στον browser σας
            </Text>
          </View>

          <View style={styles.catalogList}>
            {catalogs.map((catalog, index) => (
              <View key={index} style={styles.catalogItem}>
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
                    accessibilityLabel={`Άνοιγμα ${catalog.title}`}
                  >
                    <Ionicons name="open-outline" size={20} color="#1f4f8f" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleShareLink(catalog.title, catalog.url)}
                    accessibilityLabel={`Κοινοποίηση ${catalog.title}`}
                  >
                    <Ionicons name="share-outline" size={20} color="#1f4f8f" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  introSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  introText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  catalogList: {
    gap: 12,
  },
  catalogItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catalogInfo: {
    flex: 1,
    marginRight: 12,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  catalogType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catalogTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 20,
  },
  catalogActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bottomSpacer: {
    height: 30,
  },
});

export default CatalogScreen;




