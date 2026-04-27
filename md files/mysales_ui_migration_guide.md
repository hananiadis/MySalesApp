# MySales App — UI Migration Guide
## Από το παλιό UI στο νέο Material 3 Design
### Οδηγός υλοποίησης για GitHub Copilot / VS Code

---

## Πώς να χρησιμοποιήσεις αυτόν τον οδηγό

Κάθε ενότητα περιέχει:
- **Τι αλλάζει** — σύντομη περιγραφή
- **Prompt για Copilot** — αντίγραψε και επικόλλησε στο Copilot Chat (VS Code)
- **Tokens / Design values** — χρωματικές τιμές και παράμετροι που πρέπει να χρησιμοποιήσεις

---

## 1. Design Tokens — Πρώτο βήμα

Πριν αλλάξεις οτιδήποτε, δήλωσε τα νέα design tokens. Αυτά αντικαθιστούν τα παλιά μπλε χρώματα με Material 3 palette.

### Prompt

```
Create a design tokens file for a React Native app called MySales.
Replace the existing blue color system with a Material Design 3 palette.

New token values:

PRIMARY COLOR SYSTEM:
- colorPrimary: '#6750A4'
- colorOnPrimary: '#FFFFFF'
- colorPrimaryContainer: '#EADDff'
- colorOnPrimaryContainer: '#21005D'

SECONDARY (used for brand accents):
- colorSecondary: '#625B71'
- colorSecondaryContainer: '#E8DEF8'

SURFACE SYSTEM:
- colorBackground: '#FEF7FF'
- colorSurface: '#FEF7FF'
- colorSurfaceVariant: '#ECE6F0'
- colorSurfaceContainer: '#F3EDF7'
- colorOutline: '#79747E'
- colorOutlineVariant: '#CAC4D0'

SEMANTIC COLORS (keep existing logic, update values):
- colorAmber: '#E65100'
- colorAmberContainer: '#FFF3E0'
- colorGreen: '#2E7D32'
- colorGreenContainer: '#E8F5E9'
- colorError: '#B3261E'
- colorErrorContainer: '#F9DEDC'

TYPOGRAPHY:
- fontFamily: 'Roboto' (primary), 'Google Sans' (display/titles)
- Use weight 400 for body, 500 for labels, 300 for large numbers

SHAPE (border radius):
- shapeExtraSmall: 4
- shapeSmall: 8
- shapeMedium: 12
- shapeLarge: 16
- shapeExtraLarge: 28
- shapeFull: 999 (pills/chips)

Save as src/theme/tokens.ts and export all values as constants.
```

---

## 2. Homepage — Κεντρική Οθόνη

### Τι αλλάζει
- Αφαιρούνται τα solid μπλε module cards (Παραγγελίες, Πελάτες, Προϊόντα)
- Η αρχική γίνεται **personal dashboard** του πωλητή
- Προστίθεται hero card με gradient, "Σήμερα" stats, επόμενες επισκέψεις
- Ο ρόλος εμφανίζεται ως chip δίπλα στο όνομα

### Prompt — Hero User Card

```
Rewrite the user profile card on the MySales HomeScreen.

REMOVE: The existing flat white card with avatar icon, name, email, toggle switch, 
and solid blue company pills.

CREATE: A gradient hero card with these specs:

Container:
- marginHorizontal: 16, borderRadius: 24
- background: linear gradient from '#6750A4' to '#7965AF' (135deg)
- padding: 20
- overflow: hidden
- Add 2 decorative circles (position: absolute) using pseudo-elements or 
  View overlays with rgba(255,255,255,0.08) background, fully circular

Top row (flexDirection: row, alignItems: center, gap: 14, marginBottom: 14):
  LEFT — Avatar circle:
    - width/height: 52, borderRadius: 26 (fully circular)
    - background: rgba(255,255,255,0.22)
    - border: 2px solid rgba(255,255,255,0.35)
    - Shows user initials (e.g. 'ΧΑ'), fontSize: 20, color: #fff, fontWeight: '500'

  RIGHT — User info:
    - Name row: Text (fontSize 18, fontWeight '500', color #fff) + Role chip inline
    - Role chip: background rgba(255,255,255,0.22), fontSize 10, fontWeight '600',
      paddingHorizontal 10, paddingVertical 2, borderRadius 20, color #fff,
      letterSpacing 0.8, text = user.role (e.g. 'SALESMAN')
    - Email: fontSize 12, color rgba(255,255,255,0.75), marginTop 3

Bottom row (flexDirection: row, justifyContent: space-between, alignItems: center):
  LEFT — Sync status:
    - Green dot (width/height 7, borderRadius 3.5, background '#69F0AE')
    - Text: 'Sync ' + lastSyncDate, fontSize 11, color rgba(255,255,255,0.8)

  RIGHT — Brand chips (map over user.brands):
    - Each chip: background rgba(255,255,255,0.18), border 1px solid rgba(255,255,255,0.3)
    - fontSize 11, paddingHorizontal 10, paddingVertical 3, borderRadius 20, color #fff, fontWeight '500'

Props: { user: { initials, name, email, role, brands: string[], lastSync } }
```

### Prompt — "Σήμερα" Stats Section

```
Add a "ΣΗΜΕΡΑ" stats section to MySales HomeScreen, placed below the hero card.

SECTION HEADER:
- Text 'ΣΗΜΕΡΑ', fontSize 11, fontWeight '500', color '#6750A4', 
  letterSpacing 0.8, paddingHorizontal 16, paddingTop 16, paddingBottom 8

STATS GRID (2 columns, gap 10, marginHorizontal 16):

Card 1 — Επισκέψεις:
  - background '#fff', borderRadius 16
  - Shadow: elevation 2 (Android) / shadowColor '#000' opacity 0.08 (iOS)
  - padding 16
  - Icon container: width/height 40, borderRadius 12, background '#EADDff', 
    contains calendar emoji (fontSize 20), marginBottom 10
  - Value: fontSize 28, fontWeight '400', color '#1C1B1F' — show visitCount
  - Label: 'Επισκέψεις', fontSize 12, color '#49454F'
  - Sublabel: 'σήμερα', fontSize 10, color '#79747E', marginTop 2
  - Chip (if pendingVisits > 0): background '#EADDff', color '#6750A4', 
    fontSize 10, fontWeight '500', paddingHorizontal 9, paddingVertical 2, 
    borderRadius 20, marginTop 8, text: pendingVisits + ' εκκρεμούν'

Card 2 — Έξοδα:
  - Same container style as Card 1
  - Icon container: background '#FFF3E0', contains receipt emoji
  - Value: '€' prefix (fontSize 16) + amount (fontSize 28) — show monthlyExpenses
  - Label: 'Έξοδα', Sublabel: 'τρέχων μήνας'
  - Chip: if expenseStatus === 'draft' → background '#FFF3E0', color '#E65100', text '1 πρόχειρο'
         if expenseStatus === 'submitted' → background '#E8F5E9', color '#2E7D32', text 'Υποβλήθηκε'

Wide Card — Επόμενη Επίσκεψη (full width, grid-column span 2):
  - background '#fff', borderRadius 16, padding 14 16
  - flexDirection: row, alignItems: center, gap 14
  - Left: icon container (width/height 44, borderRadius 12, background '#E0F2F1', map emoji, fontSize 22)
  - Center: Title 'Επόμενη επίσκεψη' (fontSize 14, fontWeight '500', color '#1C1B1F')
            Subtitle: time + location (fontSize 12, color '#79747E', marginTop 3)
  - Right: chevron '›' (fontSize 20, color '#79747E', marginLeft auto)
  - onPress: navigate to VisitsScreen

Props: { visitCount, pendingVisits, monthlyExpenses, expenseStatus, nextVisit: { time, location } }
```

### Prompt — Upcoming Visits List

```
Add an upcoming visits list section to MySales HomeScreen.

SECTION HEADER: 'ΕΠΟΜΕΝΕΣ ΕΠΙΣΚΕΨΕΙΣ' — same style as ΣΗΜΕΡΑ header above.

CONTAINER: marginHorizontal 16, gap 8 between items.

EACH VISIT ITEM (map over upcomingVisits array):
  Container: background '#fff', borderRadius 16, padding '14 16',
  flexDirection row, alignItems center, gap 14,
  shadow same as stat cards

  1. DATE COLUMN (width 42, alignItems center, flexShrink 0):
     - Day number: fontSize 20, fontWeight '300', color '#6750A4', lineHeight 1
     - Weekday abbreviation (e.g. 'ΤΡΙ'): fontSize 10, color '#79747E', letterSpacing 0.3

  2. VERTICAL DIVIDER: width 1, height 36, background '#E7E0EC', flexShrink 0

  3. INFO COLUMN (flex 1):
     - Title (area/region name): fontSize 14, fontWeight '500', color '#1C1B1F', marginBottom 2
     - Subtitle: clientCount + ' πελάτες · ' + brandName, fontSize 12, color '#79747E'

  4. STATUS BADGE (flexShrink 0):
     - 'Πλάνο': background '#EADDff', color '#6750A4'
     - 'Εκκρεμεί': background '#FFF3E0', color '#E65100'
     Style: fontSize 10, fontWeight '500', paddingHorizontal 10, paddingVertical 3, borderRadius 20

Data shape:
  upcomingVisits: Array<{
    day: number,        // e.g. 28
    weekday: string,    // e.g. 'ΤΡΙ'
    title: string,      // e.g. 'Κεντρική Μακεδονία'
    clientCount: number,
    brand: string,
    status: 'planned' | 'pending'
  }>
```

### Prompt — Tools Section

```
Add a 'ΛΕΙΤΟΥΡΓΙΕΣ' section at the bottom of MySales HomeScreen.

SECTION HEADER: 'ΛΕΙΤΟΥΡΓΙΕΣ' — same header style as above sections.

TWO CARDS in a 2-column grid (gap 10, marginHorizontal 16):

Card 1 — Εξοδολόγιο:
  - background '#E8DEF8', borderRadius 16, padding 16
  - flexDirection column, gap 10
  - Icon wrapper: width/height 40, borderRadius 12, background rgba(255,255,255,0.6),
    contains '🧾' emoji, fontSize 20, alignItems/justifyContent center
  - Title: 'Εξοδολόγιο', fontSize 14, fontWeight '500', color '#21005D'
  - Desc: 'Καύσιμα & ταξίδια', fontSize 11, color '#49454F', marginTop 1
  - onPress: navigate to ExpenseScreen

Card 2 — Επισκέψεις:
  - background '#F3EDF7' (slightly lighter), same structure
  - Icon: '📅'
  - Title: 'Επισκέψεις'
  - Desc: 'Εξορμήσεις & πλάνο'
  - onPress: navigate to VisitsScreen
```

---

## 3. Top App Bar & Navigation

### Prompt — Top App Bar

```
Rewrite the MySales app header / top bar.

REMOVE: Current header with centered 'MySales' title and 'ΧΑ ▾' gray pill button.

CREATE Material 3 Top App Bar:

Container:
  - background '#FEF7FF', paddingHorizontal 16
  - paddingTop: status bar height (use SafeAreaView or useSafeAreaInsets)
  - paddingBottom 12
  - flexDirection row, justifyContent space-between, alignItems center
  - No border/shadow (flat M3 style)

LEFT: App title
  - Text 'MySales', fontSize 22, fontWeight '400', color '#1C1B1F'
  - The 'Sales' part uses color '#6750A4', fontWeight '500'
  - (Render as: <Text><Text style={{color:'#1C1B1F'}}>My</Text><Text style={{color:'#6750A4', fontWeight:'500'}}>Sales</Text></Text>)

RIGHT: User FAB button
  - width/height 40, borderRadius 20 (circular)
  - background '#6750A4'
  - Shows user initials, fontSize 15, color '#fff', fontWeight '500'
  - elevation 2, shadowColor '#000', shadowOpacity 0.2
  - onPress: open user dropdown menu
```

### Prompt — Bottom Navigation Bar

```
Rewrite the MySales bottom navigation bar using Material 3 Navigation Bar style.

CONTAINER:
  - background '#ECE6F0'
  - paddingTop 8, paddingBottom: safe area bottom inset + 8
  - flexDirection row, justifyContent space-around, alignItems center
  - No top border (M3 style — surface color creates separation)

HOME TAB (always first):
  Icon container ('nav pill'):
    - paddingHorizontal 20, paddingVertical 4, borderRadius 20
    - When ACTIVE: background '#6750A4'
    - When INACTIVE: background transparent
  Icon: home emoji or Home icon from @expo/vector-icons, fontSize 20
        When active: color '#fff', when inactive: color '#49454F'
  Label: 'Home', fontSize 11, fontWeight '500'
         When active: color '#6750A4', when inactive: color '#49454F'

BRAND TABS (map over user.brands, show 1–3 based on user):
  Same pill container structure (no active pill unless on that brand screen)
  Icon: brand logo image as it is now
  Label: brand short name, same label style

IMPORTANT: The number of brand tabs is DYNAMIC based on user.brands.length.
If user has 1 brand → 2 tabs total (Home + 1 brand)
If user has 3 brands → 4 tabs total (Home + 3 brands)
```

---

## 4. User Dropdown Menu

### Τι αλλάζει
Το dropdown αποκτά M3 αισθητική: το header γίνεται purple panel, ο ρόλος εμφανίζεται prominently.

### Prompt

```
Rewrite the user dropdown menu in MySales that appears when tapping the top-right FAB.

This is a Modal or Popover anchored to the top-right of the screen.

OVERLAY: Semi-transparent background rgba(0,0,0,0.25), dismiss on press outside.

PANEL CONTAINER:
  - position: absolute, top: statusBarHeight + 56, right: 14
  - width: 244, background '#ECE6F0', borderRadius 20
  - elevation 6, shadow for iOS

SECTION 1 — User Header (purple):
  - background '#6750A4', padding 16
  - flexDirection row, alignItems flex-start, gap 12
  
  Avatar:
    - width/height 42, borderRadius 21 (circular)
    - background rgba(255,255,255,0.25)
    - border: 2px solid rgba(255,255,255,0.4)
    - Shows initials, fontSize 16, color '#fff', fontWeight '500'
  
  Info column:
    - Name: fontSize 14, fontWeight '500', color '#fff', marginBottom 2
    - Email: fontSize 11, color rgba(255,255,255,0.75), marginBottom 5
    - Role chip: background rgba(255,255,255,0.2), color '#fff',
      fontSize 10, fontWeight '600', letterSpacing 0.6,
      paddingHorizontal 9, paddingVertical 2, borderRadius 20
      Text = user.role.toUpperCase() (e.g. 'SALESMAN', 'SUPERVISOR')

SECTION 2 — Brand chips row:
  - background '#F3EDF7', paddingHorizontal 14, paddingVertical 10
  - flexDirection row, gap 6, flexWrap wrap
  - borderBottomWidth 1, borderBottomColor '#E7E0EC'
  - Each chip: background '#EADDff', color '#21005D',
    fontSize 11, paddingHorizontal 10, paddingVertical 3, borderRadius 20, fontWeight '500'

SECTION 3 — Menu items (background '#FEF7FF'):
  Each item: flexDirection row, alignItems center, gap 12,
  padding '13 16', fontSize 14, color '#1C1B1F',
  borderBottomWidth 1, borderBottomColor '#F3EDF7'

  Items (in order):
  1. Icon 👤 + 'Προφίλ χρήστη' → navigate to ProfileScreen
  2. Icon 🔄 + 'Συγχρονισμός δεδομένων' → trigger syncData()
  3. Icon ☁️ + 'Ενημέρωση όλων' → trigger updateAll()
  4. Icon ⚙️ + 'Ρυθμίσεις' → navigate to SettingsScreen
  5. Icon 🚪 + 'Αποσύνδεση' → color '#B3261E', trigger logout()
  6. Icon ❌ + 'Έξοδος' → color '#B3261E', trigger exitApp()

Last item has no bottom border.
```

---

## 5. Order Management Screen

### Τι αλλάζει
Η οθόνη ανήκει στα brand screens. Διατηρείται η λογική αλλά αναβαθμίζεται το design.

### Prompt — Summary Bar

```
Add a 3-column summary bar to the Order Management screen in MySales.

Place it immediately below the header/tab bar.

CONTAINER:
  - background '#ece9e3', borderRadius 12, marginHorizontal 14, marginTop 10
  - display as 3 equal columns with 0.5px vertical dividers between them (#ccc9c0)
  - paddingVertical 10, border: 0.5px solid #d8d5ce

COLUMN 1 — Total orders:
  - Label: 'Παραγγελίες', fontSize 10, color '#888', marginBottom 1
  - Sublabel: 'όλα τα brands', fontSize 9, color '#bbb', marginBottom 2
  - Value: total order count, fontSize 18, fontWeight '500', color '#185FA5'

COLUMN 2 — Draft orders:
  - Label: 'Πρόχειρες', Sublabel: 'εκκρεμούν'
  - Value: draft count, color '#BA7517' (amber — signals urgency)

COLUMN 3 — Monthly expenses:
  - Label: 'Έξοδα', Sublabel: 'τρέχων μήνας'
  - Value: '€' + amount, color '#1a1a1a'

Props: { totalOrders, draftOrders, monthlyExpenses }
```

### Prompt — Order List Items με Staleness

```
Rewrite the order list item component in MySales Order Management screen.

REMOVE: Current list item with small order code as primary text and icon buttons.

CREATE new OrderListItem component:

CONTAINER (TouchableOpacity):
  - background '#fff', paddingVertical 14, paddingHorizontal 16
  - borderBottomWidth 0.5, borderBottomColor '#e8e5de'
  - flexDirection row, justifyContent space-between, alignItems flex-start
  
  LEFT BORDER (position absolute, left 0, top 0, bottom 0, width 3):
    - No border: order is recent (< 30 days old)  
    - color '#EF9F27': order is stale (30–90 days)
    - color '#E24B4A': order is very stale (> 90 days)
    Calculate from: daysSince = Math.floor((Date.now() - order.createdAt) / 86400000)

LEFT SECTION (flex 1, minWidth 0):
  1. Customer name — fontSize 15, fontWeight '500', color '#1a1a1a', marginBottom 3
     (PRIMARY element — most prominent)
  2. Meta row — fontSize 12, color '#999', marginBottom 7
     Format: order.code + ' · ' + formattedDate + ' · ' + productCount + ' προϊόν(τα)'
  3. Badges row (flexDirection row, gap 6, flexWrap wrap):
     - Always show type badge: background '#E6F1FB', color '#185FA5', 
       fontSize 11, paddingHorizontal 9, paddingVertical 2, borderRadius 20
     - If daysSince >= 30: show staleness badge
       30–90 days: background '#FAEEDA', color '#854F0B', text daysSince + ' ημέρες'
       > 90 days: background '#FCEBEB', color '#A32D2D', text daysSince + ' ημέρες'

RIGHT SECTION (flexShrink 0, marginLeft 12, alignItems flex-end):
  1. Amount: fontSize 16, fontWeight '500', color '#1a1a1a', marginBottom 8
     Format: '€' + order.amount.toLocaleString('el-GR')
  2. Action buttons row (flexDirection row, gap 7):
     Edit button: width/height 28, borderRadius 7, background '#f0ede8', 
                  border 0.5px #d8d5ce, pencil icon, color '#555'
     Delete button: width/height 28, borderRadius 7, background '#FCEBEB',
                    border 0.5px #F7C1C1, × icon, color '#A32D2D'

Props: { order: { id, customerName, code, date, productCount, type, amount, createdAt } }
       onEdit: (id) => void
       onDelete: (id) => void
```

---

## 6. Expense Report Screen (Εξοδολόγιο)

### Prompt — Weekly Report Card

```
Rewrite the weekly report card component in MySales Expense screen.

REMOVE: Current simple card with just week code, date range, item count and amount.

CREATE WeeklyReportCard component:

CONTAINER:
  - background '#fff', paddingVertical 14, paddingHorizontal 16
  - borderBottomWidth 0.5, borderBottomColor '#e8e5de'
  
  LEFT BORDER (position absolute, left 0, top 0, bottom 0, width 3):
    - 'draft': color '#EF9F27'
    - 'submitted': color '#185FA5'
    - 'approved': color '#639922'

TOP ROW (flexDirection row, justifyContent space-between, alignItems flex-start, marginBottom 8):
  LEFT: flex row, alignItems flex-start, gap 9
    Icon square: width/height 30, borderRadius 7,
      - draft/submitted: background '#E6F1FB'
      - approved: background '#EAF3DE'
      Contains calendar emoji, fontSize 15
    
    Info:
      Week name row (flex row, gap 7, marginBottom 3):
        - Week code text: fontSize 15, fontWeight '500', color '#1a1a1a'
        - Status badge:
          draft → background '#FAEEDA', color '#854F0B', text 'Πρόχειρο'
          submitted → background '#E6F1FB', color '#185FA5', text 'Υποβλήθηκε'
          approved → background '#EAF3DE', color '#3B6D11', text 'Εγκρίθηκε'
          (fontSize 11, paddingHorizontal 9, paddingVertical 2, borderRadius 20)
      Date range: fontSize 12, color '#999'
  
  RIGHT: Amount — fontSize 16, fontWeight '500', color '#1a1a1a'

EXPENSE TAGS ROW (only if status === 'draft', marginLeft 39, gap 6, flexWrap wrap, marginBottom 10):
  For each expense category in the week:
    - Fuel/Καύσιμα: background '#E6F1FB', color '#185FA5'
    - Accommodation/Διαμονή: background '#FAEEDA', color '#854F0B'
    Format: categoryName + ' €' + amount
    Style: fontSize 11, paddingHorizontal 9, paddingVertical 2, borderRadius 20

FOOTER ROW (only if status === 'draft', marginLeft 39, flexDirection row, 
            justifyContent space-between, alignItems center):
  Left text: itemCount + ' έξοδα · Δεν έχει υποβληθεί', fontSize 12, color '#999'
  Submit button: background '#185FA5', color '#fff', fontSize 12,
                 paddingHorizontal 14, paddingVertical 5, borderRadius 8,
                 text 'Υποβολή →', onPress: onSubmit(week.id)

Props: { week: { id, code, dateRange, status, amount, categories: [{name, amount}], itemCount } }
       onSubmit: (id) => void
```

---

## 7. Γενικές Οδηγίες Μετάπτωσης

### Prompt — Shadow System

```
Create a shadow utility for MySales that matches Material 3 elevation levels.

Export these shadow styles for React Native:

export const elevation = {
  level0: {}, // no shadow
  level1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  level2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  level3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
}

Use level1 for: stat cards, order items, tool cards
Use level2 for: hero card, dropdowns
Use level3 for: FAB buttons, modal panels
```

### Prompt — Typography Scale

```
Create a typography scale for MySales matching Material 3.

Export as a StyleSheet or plain object:

export const typography = {
  displayLarge:  { fontSize: 57, fontWeight: '300', letterSpacing: -0.25 },
  displayMedium: { fontSize: 45, fontWeight: '300' },
  headlineLarge: { fontSize: 32, fontWeight: '400' },
  headlineMedium:{ fontSize: 28, fontWeight: '400' },
  headlineSmall: { fontSize: 24, fontWeight: '400' },
  titleLarge:    { fontSize: 22, fontWeight: '400' },
  titleMedium:   { fontSize: 16, fontWeight: '500', letterSpacing: 0.15 },
  titleSmall:    { fontSize: 14, fontWeight: '500', letterSpacing: 0.1 },
  bodyLarge:     { fontSize: 16, fontWeight: '400', letterSpacing: 0.5 },
  bodyMedium:    { fontSize: 14, fontWeight: '400', letterSpacing: 0.25 },
  bodySmall:     { fontSize: 12, fontWeight: '400', letterSpacing: 0.4 },
  labelLarge:    { fontSize: 14, fontWeight: '500', letterSpacing: 0.1 },
  labelMedium:   { fontSize: 12, fontWeight: '500', letterSpacing: 0.5 },
  labelSmall:    { fontSize: 11, fontWeight: '500', letterSpacing: 0.5 },
}

// Usage mapping for MySales:
// Screen titles → titleLarge
// Section headers (e.g. 'ΣΗΜΕΡΑ') → labelSmall + letterSpacing 0.8
// Customer names in lists → titleSmall
// Amounts → headlineSmall (weight 400)
// Meta/secondary text → bodySmall
// Chips/badges → labelSmall
```

### Prompt — Chip / Badge Component

```
Create a reusable Chip component for MySales that covers all badge/pill use cases.

Props:
  label: string
  variant: 'primary' | 'amber' | 'green' | 'error' | 'surface' | 'outline'
  size?: 'sm' | 'md'  (default 'sm')

VARIANT STYLES:
  primary:  background '#EADDff', color '#21005D'  (brand/type indicator)
  amber:    background '#FFF3E0', color '#E65100'   (warning/pending)
  green:    background '#E8F5E9', color '#2E7D32'   (success/approved)
  error:    background '#F9DEDC', color '#B3261E'   (danger/very stale)
  surface:  background '#F3EDF7', color '#49454F'   (neutral/inactive)
  outline:  background transparent, border 1px '#CAC4D0', color '#49454F'

SIZE STYLES:
  sm: fontSize 10, paddingHorizontal 9, paddingVertical 2, borderRadius 20
  md: fontSize 12, paddingHorizontal 12, paddingVertical 4, borderRadius 20

fontWeight always '500'

Usage examples:
  <Chip label="SALESMAN" variant="primary" />
  <Chip label="Πρόχειρο" variant="amber" />
  <Chip label="77 ημέρες" variant="error" />
  <Chip label="Εγκρίθηκε" variant="green" />
```

---

## 8. Σειρά Υλοποίησης (Checklist)

Ακολούθησε αυτή τη σειρά για να αποφύγεις conflicts:

```
[ ] 1. Δήλωσε τα Design Tokens (src/theme/tokens.ts)
[ ] 2. Δήλωσε το Typography scale (src/theme/typography.ts)
[ ] 3. Δήλωσε το Elevation/Shadow system (src/theme/elevation.ts)
[ ] 4. Δημιούργησε Chip component (src/components/Chip.tsx)
[ ] 5. Αντικατάστησε Top App Bar
[ ] 6. Αντικατάστησε Bottom Navigation Bar
[ ] 7. Αντικατάστησε User Dropdown Menu
[ ] 8. Αντικατάστησε Hero User Card (Homepage)
[ ] 9. Πρόσθεσε Stats Section (Homepage)
[ ] 10. Πρόσθεσε Upcoming Visits List (Homepage)
[ ] 11. Πρόσθεσε Tools Section (Homepage)
[ ] 12. Αντικατάστησε Order List Item
[ ] 13. Πρόσθεσε Order Summary Bar
[ ] 14. Αντικατάστησε Weekly Report Card (Expenses)
[ ] 15. Πρόσθεσε Expense Category Bar (Expenses)
```

---




> "This is a React Native mobile app for Greek sales representatives called MySales. It is a multi-brand B2B sales tool. The UI uses Greek language throughout."



> "Keep all existing business logic, navigation, and data fetching unchanged. Only replace the JSX/StyleSheet of this component with the new design."


