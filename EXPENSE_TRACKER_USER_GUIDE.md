# Expense Tracker Enhancement - Quick Reference Guide

## 🎯 User Features

### 1. **Adding an Expense**
When you tap "Προσθήκη Εξόδου", you'll see:

#### All Expenses
- **Category**: Select from 13 categories (groups by travel/accommodation/misc)
- **Payment Method**: Cash / Credit Card / Bank Transfer
- **Date**: When the expense occurred
- **Amount**: In euros
- **Description**: Optional notes

#### Fuel-Specific (⛽ Βενζίνη - Αέριο)
1. Select your **car** from modal picker (shows color + make + model + license plate)
2. Choose **fuel type**: ΑΜΟΛΥΒΔΗ (Unleaded) / ΑΕΡΙΟ (LPG) / DIESEL / ΡΕΥΜΑ (Electric)
3. Enter **odometer reading** (χιλιόμετρα) at time of refueling
4. Enter **VAT number** of refueling station
5. Enter **cost per liter** (€/L)
6. Enter **total cost** of refueling
7. **System automatically calculates** Cost/km (€/km)
8. Toggle: "Previous refuel logged?" (for accurate km calculation)
9. Toggle: "Full tank?" (for cost accuracy)

#### Service-Specific (🔧 Service)
1. Select your **car**
2. Describe what was serviced (e.g., "Oil + air filter + spark plugs")

#### Hotel-Specific (🏨 Ξενοδοχείο)
1. Enter **hotel name**
2. Enter **number of nights**

#### Ticket-Specific (🎫 Εισιτήριο)
1. Enter **departure** (city or airport code)
2. Enter **destination** (city or airport code)
3. Enter **trip date** (when you traveled)

#### Taxi-Specific (🚕 Ταξί)
1. Enter **departure point**
2. Enter **destination point**

---

### 2. **Weekly Tracking (Εβδομαδιαία Καταγραφή)**
Track weekly metrics:

#### Mileage (Χιλιομετρητής)
- **Start**: Odometer reading at week start
- **End**: Odometer reading at week end
- **Private Use**: Personal kilometers
- **System shows**: Total km + Business km (auto-calculated)

#### Petty Cash (Ταμείο)
- **Previous Balance**: Automatically brought forward from last week
- **Given This Week**: Amount provided this week
- **Expenses Logged**: Auto-calculated from entered expenses
- **Balance**: Remaining amount (auto-calculated)

#### Work Locations (Τοποθεσίες Εργασίας)
- Enter location where you worked each day
- Can type to search/filter available locations
- Linked to salesman scheduling

---

### 3. **Reports**
Three report views:

#### Expense Tracker (Εξοδολόγιο)
- See all your expenses in list format
- Filter by category/status
- Sort by date or amount
- View summary card

#### Weekly Report (Εβδομαδιαία Αναφορά)
- Navigate by week (prev/next arrows)
- See all expenses grouped by day
- See all expenses grouped by category
- Weekly summary totals
- Placeholder for print function

#### Analytics (Αναφορές)
- See total spending by group
- See total spending by category
- Summary stats

---

## 🚗 Car Management

### Vehicle List (Default)
```
1. Άσπρο KIA Ceed (NIP 8893)
2. Ασπρο Toyota Yaris (NIY 2531)
3. Άσπρο Peugeot 208 (XZM 3308)
4. Μαύρο VW Tiguan (NIB 6398)
5. Φορτηγάκι VW Caddy (NHT 7168)
```

### Selecting a Car
- Tap car selector field → Modal opens
- Browse list (shows: Color, Make, Model, License Plate)
- Tap to select
- Modal closes with selection saved

### Adding a New Car (Future Feature)
- From settings/admin panel
- Enter: Color, Make, Model, License Plate
- Saves to Firestore automatically

---

## 💡 Smart Features

### Automatic Calculations
✅ **Cost per KM** = (Total Cost ÷ Cost/Liter) ÷ Kilometers  
✅ **Business KM** = Total KM - Private KM  
✅ **Petty Cash Balance** = Previous + Given - Expenses  
✅ **Report Numbers** = Auto-generated (A1, A2, B1, etc.)

### Payment Methods
- **Μετρητά** (Cash) - Direct payment
- **Πιστωτική Κάρτα** (Credit Card) - Card payment
- **Τραπεζική Μεταφορά** (Bank Transfer) - Wire transfer

### Fuel Types Supported
- **ΑΜΟΛΥΒΔΗ** - Unleaded petrol
- **ΑΕΡΙΟ (LPG)** - LPG/Gas
- **DIESEL** - Diesel fuel
- **ΡΕΥΜΑ** - Electric charging

---

## 📋 Expense Categories (13 Total)

### ΜΕΤΑΚΙΝΗΣΗ (Travel - 6 items)
- Βενζίνη - Αέριο (Fuel)
- Εισιτήρια (Tickets)
- Ταξί (Taxi)
- Ενοικίαση Αυτοκινήτου (Car Rental)
- Διόδια (Tolls)
- Parking (Parking)

### ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ (Accommodation & Food - 3 items)
- Ξενοδοχείο (Hotel)
- Ατομικό Γεύμα (Personal Meal)
- Γεύμα Τρίτου (Third Party Meal)

### ΔΙΑΦΟΡΑ (Miscellaneous - 4 items)
- Ταχυδρομικά Έξοδα (Postal)
- Τηλέφωνα, φαξ, Internet (Telecom)
- Service Αυτοκινήτου (Car Service)
- Διάφορα (Other)

---

## 🔒 Data Safety

### What's Saved
- ✅ All expenses encrypted in Firestore
- ✅ Your personal data protected
- ✅ Cars list shared across team
- ✅ Weekly tracking only visible to you

### What's Cached Offline
- ✅ Car list (syncs when online)
- ✅ Working areas (syncs when online)
- ✅ Recent expenses (syncs when online)

### What Resets Yearly
- ✅ Report numbers (A1 starts again Jan 1)
- ✅ Petty cash balance (must enter beginning balance)

---

## ⚠️ Important Notes

### Fuel Logging Accuracy
**For accurate cost/km calculation:**
1. Always log the previous fuel stop (so we know the distance)
2. Check "Previous refuel logged?" toggle
3. Check "Full tank?" if you filled the whole tank
4. Otherwise cost/km may be inaccurate

### Weekly Balance Carryover
- If you have €350 remaining at end of Week 1
- It appears as "Προηγούμενο Υπόλοιπο" in Week 2
- Do NOT re-enter it as "Δόθησαν" - it's already counted!

### Car Selection
- Always select the correct car before entering expense
- Different cars have different fuel consumption rates
- Service expenses should match the car that was serviced

---

## 🤔 FAQ

**Q: Can I edit an expense?**  
A: Yes, tap on any expense in the list to edit it

**Q: What if I entered the wrong car?**  
A: Edit the expense and select the correct car

**Q: Does my petty cash auto-calculate?**  
A: Yes! Balance = Previous + Given - (sum of all cash expenses this week)

**Q: What does "Γέμιστη δεξαμενή" mean?**  
A: It means you filled the entire gas tank (useful for accurate km tracking)

**Q: Can I delete an expense?**  
A: Not yet - you can mark status as "Απορρίφθη" (rejected) for now

**Q: How are report numbers assigned?**  
A: Automatically - each salesman gets a letter (A, B, C...) and numbers restart yearly

**Q: What happens if I forget to log a fuel stop?**  
A: Check the "Previous refuel NOT logged" toggle so system doesn't calculate cost/km

---

**Version**: 2.0 - Enhanced Expense Tracking  
**Updated**: January 22, 2026  
**Status**: Production Ready ✅
