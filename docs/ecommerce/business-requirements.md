# CamCow Beef E-Commerce (PWA): Business Requirements

| | |
|---|---|
| Document | Business Requirements Document (BRD) |
| Product | CamCow online beef ordering, built as a Progressive Web App (PWA) |
| Company | CAM COW CO., LTD (ខេម ខោវ) |
| Version | 0.3: own offline store (POS) added; Beef prices page references removed |
| Date | 2026-10-29 |
| Status | Draft. Assumptions are marked **[A]**; decisions waiting on CamCow are listed in section 22 |

---

## 1. Summary

CamCow raises cattle with Cambodian family farms and now sells beef under its own name (the printed *CamCow Price List*: 38 cuts and parts, priced in riel per kilogram). Orders arrive today by phone, Telegram and Facebook. That works for a few customers a day, but it does not scale, prices and stock are not visible, and repeat business customers have to ask every time.

The goal is **one selling platform for every way CamCow sells beef**: online and in CamCow's own shop, sharing one product list, one stock and one customer record:

1. **Consumers (B2C)**: families and individuals ordering beef for home delivery or pick-up.
2. **Retail partners (B2B)**: supermarkets, mini-marts, market butchers and meat shops that buy to resell, the same model FBL Beef uses with its nine supermarket partners (Super Duper, Sambo Market, Olympic, Fresh Shop, Seven Mart and others).
3. **Food service (B2B, "HoReCa")**: restaurants, hotels, caterers, canteens and BBQ shops that buy regularly, often with special cuts, portion sizes and payment terms.
4. **CamCow's own offline store(s)**: a CamCow butcher shop where walk-in customers buy at the counter, weighed and paid on the spot. The shop is also a pick-up point for online orders and a base for local deliveries. It uses a **point-of-sale (POS) screen** in the same system, so a kilogram sold in the shop is a kilogram the website no longer offers.

The platform is a **PWA**: one web app that works in the phone browser, can be installed on the home screen like an app (Android and iPhone), loads fast on mobile data, keeps the catalogue and cart available offline, and can send order notifications. There is no App Store or Play Store release to maintain. The in-store POS uses the same PWA on a tablet or PC at the counter, and keeps selling when the internet is down (POS-10).

It sits beside the systems CamCow already runs:

| Existing | Address | Role for e-commerce |
|---|---|---|
| CamCow public website | www.camcow.com.kh | Brand, story, farms → "Order online" button sends visitors to the shop |
| CC Livestock office system | digital.camcow.com.kh | Cattle, farms, batches, CamCow stock and buyers → source of origin and traceability data |
| Telegram @CAMCOW, Facebook | | Customer contact; order notifications |

The rest of this document describes **what the business needs**, not how to build it. Technical design comes after these requirements are agreed.

---

## 2. Business context

### 2.1 What CamCow sells

From the CamCow Price List brochure (prices in riel per kg):

| Group | Items | Price range (៛/kg) | Notes |
|---|---|---|---|
| Whole carcass | Cow (female), bull (male) | 26,000 to 28,000 | Wholesale only in practice |
| Fresh beef cuts | 16 cuts: shoulder, rib meat, striploin, rump, round, tail end, brisket, belly flank, flank, shank, tenderloin, tomahawk, striploin steak, bone-in striploin steak, osso buco, mince | 34,000 to 76,000 | Core range |
| Offal | Red offal (heart, kidney, spleen, liver, lung), white offal (omasum, honeycomb, peck), abomasum | 12,000 to 26,000 | Strong demand from restaurants and markets |
| Other parts | Cheek, oxtail, tendon, head meat, tongue, brain, feet, skin, fat | 8,000 to 32,000 | |
| Processed products | Steak, ribs, German-style braised beef, pâté, beef balls, sausage, ham, smoked sausage | Not printed ("ask us") | Fixed packs, not by weight **[A]** |

The brochure says prices "may change by negotiation". The platform must therefore support **list prices for the public and agreed prices for business accounts**.

### 2.2 How beef is different from ordinary e-commerce

These facts drive most of the requirements below:

1. **Sold by weight, cut to order.** A customer orders "1 kg of striploin", but the packed piece weighs 1.06 kg. The final price is known only after weighing (*catch weight*).
2. **One animal gives limited premium cuts.** Each carcass yields only a few kilograms of tenderloin but a lot of shoulder and offal. Stock is driven by **carcass breakdown**, not by buying more of one item. Selling the whole animal matters as much as selling the best cuts.
3. **Perishable, cold chain.** Fresh beef has a short shelf life, so delivery must stay cold and orders are planned around cutting days.
4. **Different buyers, different rules.** Consumers want small packs, quick checkout and QR payment. Partners want wholesale prices, invoices, credit and repeat orders. Restaurants want fixed portion specs, daily early deliveries and monthly statements.
5. **Trust.** Origin ("raised by Khmer farmers"), hygiene and freshness are the selling points. CC Livestock already records farm, batch and animal history, which can become a traceability QR code on each pack.

### 2.3 Reference: the FBL model

FBL Beef (fblbeef.com) processes beef, holds HACCP certification and supplies supermarkets that resell under FBL's name. For CamCow this means:

- Partners need **their own account and price list**, delivery to **several branches**, invoices with **VAT details**, and **credit terms**.
- The public site can show **"Where to buy"**: partner stores that carry CamCow beef. This promotes partners and brings consumers who prefer to buy in a shop.
- Partners may need **labels** (CamCow brand, weight, price, dates, barcode) ready for their shelves.

### 2.4 Why the own store belongs in the same system

A CamCow shop and the website sell the **same carcasses**. Separate systems mean:
- the website takes an order for tenderloin the shop sold an hour ago
- prices on the shelf differ from prices online
- a loyal shop customer is a stranger online
- the evening count never matches

With one system:
- stock is shared live, or synced as soon as the connection returns
- each channel can have its own prices where wanted
- a customer is recognised by phone number in the shop and online
- the shop is also the place to collect online orders, return or replace items, and send local deliveries

---

## 3. Goals and success measures

| # | Goal | Measure (first 12 months) **[A]: targets to confirm** |
|---|---|---|
| G1 | Take orders without phone calls | ≥ 70% of orders placed in the app instead of by phone or chat |
| G2 | Grow consumer sales | Consumer orders per month; repeat rate ≥ 35% within 60 days |
| G3 | Win and keep business accounts | Number of active partner and restaurant accounts; % ordering every week |
| G4 | Sell the whole carcass | Unsold kg per carcass; offal and secondary cuts sell-through ≥ 90% |
| G5 | Get paid on time | Online payment share for consumers; overdue B2B balance < 10% |
| G6 | Deliver reliably | On-time delivery ≥ 95%; quality complaints < 2% of orders |
| G7 | Fast on phones | Home page usable in < 3 s on a mid-range Android over 4G |
| G8 | Run the shop on the same system | 100% of shop sales through the POS; daily cash difference < 0.5% of takings; stock difference per count < 2% |
| G9 | Join online and shop | ≥ 20% of online orders collected in the shop or delivered from it; shop customers who also order online |

---

## 4. Scope

### 4.1 In scope

- Online catalogue in Khmer and English, with prices per customer type
- Consumer ordering: cart, delivery or pick-up, payment, order tracking
- Business accounts (retail partners and food service): application, approval, own prices, credit terms, quick re-ordering, standing orders, invoices and statements
- Catch-weight pricing (estimate at order, final after weighing)
- Stock by product in kg, with limits that follow carcass yields
- Order processing for staff: confirm, cut, weigh, pack, label, dispatch, deliver
- Delivery zones, time slots and fees; proof of delivery
- Payments: KHQR, ABA PayWay, cash on delivery, bank transfer, credit account
- Notifications by Telegram (and SMS/email where needed)
- Admin back office, reports, roles and permissions
- PWA: install, offline catalogue and cart, push notifications
- Links to the CamCow website and the CC Livestock system (origin and traceability)
- **CamCow's own offline store(s)**:
  - point-of-sale (POS) for walk-in customers, with a weighing scale, label/receipt printer and cash drawer
  - store stock and transfers
  - click-and-collect pick-up and in-store returns
  - shift opening and closing with cash count
  - selling while offline, then syncing
  - store reports

### 4.2 Later phases (not in the first release)

- Loyalty points, referral rewards, gift cards
- Subscription boxes for consumers ("BBQ box every two weeks")
- Driver app with live tracking and route planning
- Third-party delivery (Grab, Nham24, foodpanda) integration
- Marketplace listings (Shopee, Lazada, Facebook Shop)
- Partner self-service shelf labels and point-of-sale integration
- Chinese or other languages for hotels and restaurants
- More shops (franchise or shop-in-shop counters in partner supermarkets) with central reporting
- Self-service kiosk or customer-facing price screen in the shop

### 4.3 Out of scope

- Live cattle sales (stay in CC Livestock and with the sales team)
- Farm management, feed and weights (CC Livestock)
- Full accounting system (the platform exports to accounting; it does not replace it)
- Native iOS/Android store apps (the PWA covers this need)

---

## 5. Who uses it

### 5.1 Customer types

| Type | Who | What they need most | How they pay |
|---|---|---|---|
| **Consumer (B2C)** | Families, young professionals, expats in Phnom Penh | Pictures, clear price per kg, small packs, quick checkout, delivery today or tomorrow, freshness | KHQR / ABA, cash on delivery |
| **Retail partner (B2B)** | Supermarkets, mini-marts, market butchers, meat shops | Wholesale prices, steady supply, several branches, VAT invoice, credit 7 to 30 days, labels, returns process | Bank transfer, credit account |
| **Food service (B2B)** | Restaurants, hotels, caterers, BBQ and hot-pot shops, canteens | Same cut and portion every time, early-morning delivery, standing orders, monthly statement, special requests (thin slices, minced to order) | Credit account, monthly statement |
| **Wholesale / processor** **[A]** | Processors like FBL, other butchers buying carcasses or primals | Whole or half carcass, quotes, scheduled pick-up | Bank transfer, deposit |
| **Walk-in shop customer (own store)** | Neighbours, market shoppers, restaurant staff buying small amounts | See and choose the meat, cut while they wait, quick weighing and payment, a printed receipt, maybe order for tomorrow | Cash, KHQR, card; business accounts can charge to their account |

### 5.2 Personas

- **Sreymom, 34, mother in Phnom Penh.** Orders on her phone in Khmer at 9 pm for tomorrow's lunch. Wants 1 kg of mince and 500 g of steak, pays by KHQR, wants to know when the driver arrives.
- **Dara, purchasing at a mini-mart chain (3 branches).** Orders twice a week, needs separate deliveries per branch, prices agreed for the quarter, one VAT invoice per delivery and a monthly statement. His manager approves orders above a set amount.
- **Chef Visal, BBQ restaurant.** Every morning by 6 am he needs 8 kg of thin-sliced brisket and 3 kg of tongue. He uses a standing order and only changes quantities. He pays at month end.
- **CamCow order desk staff.** Sees every new order, confirms stock, changes quantities with the customer, and sends orders to the cutting room.
- **Butcher / packer.** Sees the cutting list for the next delivery round, weighs each pack, and prints the label with the real weight and price.
- **Driver.** Sees the drops in order, the cash to collect, and takes a photo or signature at delivery.
- **Bopha, shop cashier/butcher at the CamCow store.** At 7 am she opens her shift and counts the cash float. A customer asks for 800 g of brisket cut thin. Bopha weighs it; the scale reading goes straight into the POS, which prints the label and the receipt. The customer pays by KHQR. Between customers Bopha hands out two online orders for pick-up and puts a phone order in for tomorrow's delivery. At closing she counts the cash and the system shows the expected amount.
- **Store manager.** Orders stock from the central cutting room, records waste and price markdowns at the end of the day, approves refunds, and checks the store's sales.
- **Finance.** Checks payments, issues invoices and credit notes, follows up overdue accounts.
- **Management.** Sales by product, customer type and area; carcass sell-through; margin.

### 5.3 Internal roles and what they may do

| Role | Main permissions |
|---|---|
| Super Admin / Admin | Everything, including prices, users, settings |
| Sales / Account manager | Approve business accounts, set customer prices and credit limits (within limits), quotes |
| Order desk | View and change orders, call customers, apply substitutions |
| Butchery / Warehouse | Cutting lists, weighing, labels, stock in and out, carcass breakdown |
| Dispatch / Driver | Delivery rounds, proof of delivery, cash collected |
| Finance | Payments, invoices, credit notes, statements, refunds, exports |
| Management | Read-only reports and dashboards |
| Store manager | Their store's stock, transfers, waste, markdowns, refunds, staff shifts, store reports |
| Cashier / Store butcher | Sell at the POS, open and close their own shift, hand out pick-ups, take store orders. Discounts and refunds need a manager's PIN above a set limit |

Rules: each action is checked on the server; every price, credit and stock change is written to an audit log (who, what, before and after, when).

---

## 6. Prices and commercial rules

**PR-1 Price lists.** The system keeps several price lists:
- **Retail (public)**: starts from the CamCow brochure prices.
- **Partner tier** (e.g. Retail partner A/B, Food service A/B): a percentage or fixed price per item off the retail list.
- **Account price**: an agreed price for one customer and item, with a start and end date (contracts, quarterly prices).
- **Channel prices**: the shop may use the public price, or its own *store price* for some items (e.g. a lower counter price, or a higher price for cut-to-order service) **[A]**.

The best applicable price is used in this order: account price → tier price → channel price → public price. The customer sees only their own price. In the shop, a business customer identified at the counter gets their account price.

**PR-2 Units.** Every item is sold by one of: **per kg (catch weight)**, **fixed pack** (e.g. 500 g pack, sausage 1 pack), or **per piece**. Price per kg is always shown, even for packs (consumer law and trust).

**PR-3 Catch weight.**
- At order: the customer chooses a quantity (e.g. 1 kg, or 2 × 500 g packs). The app shows an **estimated price**.
- After weighing: the final amount uses the real weight. The weight may vary within a set tolerance (e.g. ±10%) **[A]**. Larger differences need the customer's approval, by order desk call or by tapping Accept in the app.
- Payment: see PA-3 for how the difference is settled.

**PR-4 Minimum order and fees.**
- Consumers: minimum order value for delivery (e.g. 40,000 ៛) **[A]**, delivery fee by zone, free delivery above a threshold.
- Business: minimum per delivery (e.g. 10 kg or 300,000 ៛) **[A]**; delivery included in tier price.

**PR-5 Volume prices.** Optional quantity breaks (e.g. mince 10 kg+ at a lower price per kg).

**PR-6 Promotions.** Discount codes, item specials (e.g. offal −10% on Mondays), bundles (BBQ set). Each has dates, limits, customer types and **channels** (online only, shop only, or both). Business account prices are not combined with consumer promotions unless set so.

**PR-6b Shop markdowns.** At the end of the day the store manager can mark down short-dated packs (e.g. −20%). The marked-down label is reprinted, and the markdown is reported as a cost, not hidden in sales.

**PR-7 Currency and rounding.** Prices are in riel. Totals are rounded to 100 ៛ **[A]**. USD is shown for information if needed, at a rate set by finance.

**PR-8 Tax.** Prices for consumers include VAT where it applies **[A, to confirm with accountant]**. Business invoices show the price without VAT, VAT 10% and the total, and carry the customer's VAT number (VATTIN) when given.

**PR-9 Price changes.** Admins schedule changes for a date. Orders keep the price at the time of ordering. Business customers are notified ahead of changes to their prices.

**PR-10 Confidentiality.** Business prices are visible only to that business, and are never shown on the public site or in shared links. Cattle trading prices, farm payments and margins never appear in the shop.

---

## 7. Product catalogue

**CA-1 Product data.** For each product:
- Khmer and English name and description
- Category (as in the brochure), photos, and the cut's position on the beef chart
- Unit type (kg / pack / piece), pack sizes, minimum and step quantity (e.g. 0.5 kg steps)
- Storage (chilled 0 to 4 °C / frozen −18 °C), shelf life, and preparation tips ("best for: BBQ, stew, hot pot")
- Cutting options (whole piece, steak thickness, thin slices for hot pot, cubes, mince) with any extra charge
- Which customer types may buy it (e.g. whole carcass for business only)
- Lead time (same day / next day / 2 days for special cuts)
- SKU and barcode

**CA-2 Categories and search.** Browse by group (Steaks, Fresh cuts, Mince, Offal, Other parts, Processed, BBQ and hot pot), search in Khmer and English (including common spellings), and filter by use, price and availability.

**CA-3 Availability.** Each item shows *In stock*, *Limited (x kg left)*, *Available from (date)* or *Pre-order*. Premium cuts can be limited per order (e.g. tenderloin max 2 kg) **[A]**. For pick-up, availability is per store ("Available at CamCow shop, Toul Kork" **[A]**). An item can be set as online only or shop only.

**CA-4 Recommendations.** "Often bought together" (brisket + tendon for hot pot), "Complete the animal" offers on secondary cuts, and recently ordered items for repeat customers.

**CA-5 Content.** Recipes and cooking guides, the beef cut chart, and the farm story (from the CamCow website), all in Khmer and English.

---

## 8. Ordering

### 8.1 Consumers (B2C)

**B2C-1 Account or guest.** Check out as a guest with a phone number confirmed by a code (OTP), or create an account (phone, Telegram or Google sign-in) to save addresses and re-order.

**B2C-2 Cart.** Add items by weight or pack, choose cutting options, add notes ("cut thin for hot pot"). The cart is kept on the device, even offline and after closing the app.

**B2C-3 Checkout.**
1. Delivery address (map pin and text; landmark field, common in Phnom Penh) or pick-up point
2. Delivery date and time slot (e.g. 8 to 11, 11 to 14, 14 to 17, 17 to 20) with cut-off rules
3. Payment method
4. Summary: estimated total, delivery fee, an explanation of weight-based pricing, and terms
5. Confirmation screen, plus a Telegram/SMS message with the order number

**B2C-4 Order tracking.** Status steps: *Received → Confirmed → Cutting & packing → Out for delivery → Delivered*. Show the final weight and amount after packing, and the driver's contact when out for delivery.

**B2C-5 Changes and cancel.** The customer can cancel or change an order until it reaches *Cutting & packing*. After that they contact the order desk.

**B2C-6 Re-order.** One tap re-orders a past order, with current prices and stock.

### 8.2 Business accounts (retail partners and food service)

**B2B-1 Application.** A business applies online with:
- business name (Khmer/English), type, registration or patent number, VATTIN (optional)
- branches and delivery addresses, contact people and phones
- expected weekly volume, wanted payment terms

Sales approves or rejects it, sets the tier, any account prices, credit limit and terms, and assigns an account manager.

**B2B-2 Several users per business.** Roles inside one business: *Owner*, *Buyer* (orders), *Approver* (approves orders above an amount), *Finance* (invoices and statements only), and *Branch* users who see only their branch.

**B2B-3 Quick order.** An order pad listing the account's usual items with their prices; type quantities and submit. Also: re-order a previous order, and upload a list (Excel/CSV) for large orders.

**B2B-4 Standing orders.** Repeat orders (e.g. Mon/Wed/Fri 6 am, 8 kg brisket thin-sliced). The system creates each order ahead of time, notifies the buyer, and lets them change quantities until the cut-off. Holidays can be skipped.

**B2B-5 Cut-off times.** Each delivery round has a cut-off (e.g. order by 16:00 for next-morning delivery) **[A]**. Late orders go to the next round or need order desk approval.

**B2B-6 Purchase order and notes.** The customer's PO number, per-line specs (portion weight, slice thickness, packing per 1 kg bag) and delivery notes.

**B2B-7 Credit control.** Orders that pass the credit limit or have overdue invoices are held for finance approval, with a clear message to the customer.

**B2B-8 Quotes.** For large or special orders (whole carcass, events, new cuts), the customer asks for a quote. Sales replies with prices and a validity date, and the customer accepts it into an order.

**B2B-9 Invoices, statements and documents.** Download invoices, delivery notes, credit notes and monthly statements (PDF, Khmer/English) and see the open balance.

**B2B-10 Where to buy.** With the partner's consent, partner stores appear on a public map ("Where to buy CamCow beef") with branch addresses and opening hours.

### 8.3 Own store: selling at the counter (POS)

**POS-1 Counter sale.** The cashier finds an item by search, category buttons or barcode. For weighed items the **scale** sends the weight (or it is typed), and the line shows weight × price per kg. Pre-packed items are scanned by their label barcode, which carries the weight and price. Several items make one sale.

**POS-2 Payment at the counter.**
- cash, with change calculated
- KHQR shown on screen or a customer-facing display, confirmed automatically
- ABA / card terminal
- split payment (part cash, part KHQR)
- business accounts *charge to account* within their credit limit

**POS-3 Receipt.** A printed receipt (80 mm thermal) in Khmer/English with shop details, VAT where it applies, and a QR code for the digital receipt and traceability. The receipt can also go to the customer's Telegram or SMS. A VAT invoice is printed for business customers on request.

**POS-4 Customer at the counter.** Optional: look up the customer by phone number to attach the sale, give account prices to a business customer, collect loyalty points later, and record marketing consent. Walk-in sales without a name are allowed.

**POS-5 Cut while you wait and special requests.** Notes on a line (slice thin, cubes, remove fat) and a "ready at" time for orders cut in the back.

**POS-6 Store orders.** The cashier can take an order in the shop for later: pick-up tomorrow, or delivery. It enters the same order flow and statuses as online orders (section 8.5), paid now or on collection.

**POS-7 Returns and refunds in the shop.** Refund or exchange against the receipt or order number (online orders too), within the claims rules (FU-9). A reason is required, and refunds above a set amount need the store manager's PIN.

**POS-8 Discounts.** Line or sale discounts with a reason. Cashier limits apply (e.g. up to 5%); above that, manager approval.

**POS-9 Shifts and cash.**
- Each cashier opens a shift with the cash float.
- Records cash in and out (e.g. paying the ice supplier), with a reason.
- Closes with a **cash count by note**. The system shows *expected cash*, *counted* and *difference*.
- The manager reviews the day close (Z report).

**POS-10 Selling while offline.** If the internet fails, the POS keeps selling: cash sales, and KHQR when the phone network works. Sales are stored safely on the device with their own numbers and sent as soon as the connection returns. Stock is reconciled then, and any oversell is flagged for the manager. Card or online payments that need the internet are disabled while offline. Business account credit checks use the last known balance, with a small offline limit **[A]**.

**POS-11 Hardware.**
- tablet or PC (the PWA in the browser)
- receipt printer
- label printer
- cash drawer
- barcode scanner
- weighing scale (legal-for-trade, with a connection for the weight)
- optional customer display showing items, price and the KHQR

Hardware models are chosen during design; the scale must be certified for trade use in Cambodia **[A]**.

**POS-12 Several stores.** Each store has its own stock, staff, cash, opening hours and pick-up slots, and all stores report centrally. The first release supports one store; the design allows more.

### 8.4 Online and store together

**OM-1 Click and collect.** Online customers choose *Pick up at CamCow shop*, a day and time slot, and see what the shop has. The order appears on the shop's pick-up list. The customer gets *Ready for pick-up* with a code, and the cashier confirms hand-over in the POS (paid, or pay at the counter).

**OM-2 Ship from store.** Orders for nearby areas can be packed in the shop instead of the central cutting room, using the shop's stock. Dispatch decides by zone and stock **[A]**.

**OM-3 One customer, every channel.** A phone number links shop receipts and online orders. The customer sees all their purchases in the app, and staff see the full history.

**OM-4 One stock picture.** Online availability for pick-up and nearby delivery uses the store's stock minus what is reserved. A sale in the shop lowers what the website offers within seconds when online, or at the next sync when offline.

**OM-5 Returns anywhere.** Online orders can be returned or replaced in the shop; shop purchases can be claimed online with photos.

**OM-6 Same labels and QR.** Packs cut in the shop carry the same label format and lot code as central packs, so traceability works for every channel.

### 8.5 Order statuses (all customer types)

| Status | Meaning | Who moves it |
|---|---|---|
| Draft / Cart | Not yet sent | Customer |
| Pending approval | Business order waiting for the customer's approver, or for credit | Customer approver / Finance |
| Received | Sent, waiting for CamCow to confirm | System |
| Confirmed | Stock reserved, delivery slot fixed | Order desk (or automatic when stock is clear) |
| Cutting & packing | On the cutting list for its round | Butchery |
| Packed | Weighed and labelled; final amount known | Butchery |
| Ready for pick-up | Packed and waiting at the shop; pick-up code sent | Store |
| Out for delivery | On a delivery round | Dispatch |
| Delivered / Picked up | Proof of delivery taken, or hand-over confirmed in the POS | Driver / Store |
| Completed | Paid, or invoiced on credit | System / Finance |
| Cancelled | Before cutting, by customer or CamCow (reason kept) | Customer / Order desk |
| Partly delivered / Claim | Short, damaged or quality issue reported | Driver / Customer / Order desk |

---

## 9. Fulfilment: cutting, packing and delivery

**FU-1 Cutting list.** Per delivery round: totals per cut and spec, then per order. It is printable and on a tablet in the cutting room.

**FU-2 Weighing and labels.** The packer enters (or a connected scale sends) the real weight. The system prints a label with:
- product name (KM/EN) and weight
- price per kg and total
- pack date and use-by date, storage instruction
- order and customer name, lot/batch code
- a QR code for traceability
- for partners, a barcode for their shelf if needed **[A]**

**FU-3 Substitutions and shortages.** If an item is short, the order desk offers a substitute or a partial quantity. The customer accepts in the app or by phone, and the change is recorded.

**FU-4 Delivery zones and fees.** Zones drawn on a map (e.g. Phnom Penh inner, outer, provinces) with fee, minimum order, available days and slots, and capacity per slot (number of drops).

**FU-5 Delivery rounds.** Dispatch groups orders into rounds by area and time. The driver sees drops in order, customer phone, map link, payment to collect, and the cold box count.

**FU-6 Proof of delivery.** Photo and/or signature, time, cash collected and any short or rejected items. The customer gets a "Delivered" message.

**FU-7 Pick-up.** Pick-up points with opening hours and a code to show at pick-up:
- **the CamCow shop(s)** (main pick-up point, OM-1)
- the CamCow office
- partner stores **[A]**

Orders not collected by closing time are moved back to stock or chilled for the next day, following the shelf-life rules.

**FU-7b Store replenishment.** The shop orders stock from the central cutting room or warehouse (a *transfer*). The transfer is packed, sent and received in the POS. Differences (short or damaged) are recorded at receipt. Suggested quantities come from recent shop sales and pick-up orders.

**FU-8 Cold chain.** Insulated boxes and ice packs, with a maximum time from packing to delivery (e.g. 3 hours) **[A]**. The driver records the delivery temperature for business orders **[A]**.

**FU-9 Claims and returns.** Customers report a problem within a set time (e.g. 24 h for fresh) with photos. The order desk reviews it, and finance issues a refund, credit note or replacement. Reasons are tracked for quality reports.

---

## 10. Payments and finance

**PA-1 Payment methods.**

| Method | Consumers | Business |
|---|---|---|
| KHQR (Bakong, works with most Cambodian banking apps) | ✓ | ✓ |
| ABA PayWay (ABA Pay, KHQR, cards) | ✓ | ✓ |
| Cash on delivery | ✓ (with a limit, e.g. orders below 500,000 ៛) **[A]** | Optional |
| Bank transfer | | ✓ |
| Credit account (pay by invoice/statement) | | ✓ (approved accounts) |
| **In the shop:** cash, KHQR, card terminal, split payment | ✓ | ✓ (or charge to account) |

Card details are never stored by CamCow; payments go through the bank's or payment gateway's own page.

**PA-2 Payment status.** Each order shows Unpaid / Paid / Partly paid / Refunded. Online payments are confirmed automatically by the gateway; cash and transfers are confirmed by finance or the driver.

**PA-3 Catch-weight settlement.** One of two options, to be chosen (decision D-3):
- **Option A, pay after packing (recommended for the start).** The order is confirmed without payment; after weighing, the customer gets a payment link (KHQR) for the exact amount, or pays cash on delivery.
- **Option B, pay the estimate at order.** The difference is settled after weighing: a small extra amount is collected at delivery, or the balance is refunded or kept as account credit.

**PA-4 Invoices and receipts.** A numbered receipt for consumers. Business accounts get a tax invoice with VAT and VATTIN, a delivery note, credit notes and monthly statements. Khmer and English, with the CamCow logo and company details.

**PA-5 Receivables.** An ageing report (current, 1 to 30, 31 to 60, 60+ days), reminders by Telegram/email before and after the due date, and an automatic hold on new orders when overdue (PA-7).

**PA-6 Refunds.** Back to the original method where possible, or as account credit. Approved by finance, with a reason.

**PA-7 Credit rules.** Credit limit, payment terms (7/15/30 days, or month end), and grace days per account.

**PA-8 Export.** Sales, payments, invoices, VAT and receivables export to Excel/CSV for the accountant (or to accounting software later), split by channel (online, shop, business).

**PA-9 Shop cash control.**
- Daily close per store: takings by payment method; expected and counted cash, and the difference per cashier.
- Cash deposits to the bank recorded with the slip.
- All POS sales, refunds, voids and discounts traceable to the cashier, with time stamps.
- **No sale can be deleted.** Mistakes are voided or refunded, with a reason.

---

## 11. Stock and carcass planning

**ST-1 Stock in kg.** Stock per product and **location**, in kg and packs. Locations are the central chiller and freezer, and each shop's display counter, chiller and freezer. Stock moves by receiving, cutting, transfers, online and shop sales, waste, markdowns and adjustments.

**ST-1b Stock counts.** Daily or weekly counts per location on a tablet, with differences reported and approved by the manager. Spot checks on high-value cuts (tenderloin, steaks) every day **[A]**.

**ST-2 Carcass breakdown.** When a carcass or quarter is cut, staff record the yield per cut (or apply a standard yield table and correct it). Stock then becomes available for sale.

**ST-3 Reservation.** Confirmed orders reserve stock, and the app never sells more than available plus planned cutting **[A]**.

**ST-4 Planned supply.** Planned slaughter/cutting days and expected yields create *available from* dates, so customers can pre-order.

**ST-5 Balancing.** A dashboard shows, per carcass and per week, which cuts are left over. Admins can run promotions on slow cuts with one click.

**ST-6 Expiry.** Use-by dates per lot; first-expiry-first-out picking; alerts before expiry; waste recorded with reason.

**ST-7 Link to CC Livestock.** Cattle sold to CamCow and received into CamCow stock (already in CC Livestock) are the source animals. When an animal is processed, its ID, farm and batch carry into the beef lots. This allows traceability (section 12) and margin per animal later.

---

## 12. Traceability and food safety

**TR-1 Lot codes.** Every pack has a lot code that leads back to: processing date → carcass / animal ID → farm (district) and batch, from CC Livestock.

**TR-2 Customer QR page.** Scanning the label opens a public page with:
- product and pack date, use-by date
- the farm's region and farm name **only if the farm agreed to be shown**, as on the CamCow website
- the animal's breed and age class **[A]**
- handling and cooking tips

It never shows prices, farm payments or personal details.

**TR-3 Recall.** Admins find every order and customer that received a lot. They can block the lot from sale and send a message to the customers affected.

**TR-4 Hygiene records.** Chiller temperature checks, cleaning logs and supplier records, kept for HACCP or other certification later **[A]**.

---

## 13. Customer communication

**CM-1 Channels.**
- **Telegram** (CamCow already uses it): order confirmation, status changes, payment link, delivery, standing-order reminders.
- **SMS** for customers without Telegram.
- **Email** for business invoices and statements.
- **Web push** for customers who installed the PWA.

**CM-2 Language.** Every message in the customer's language (Khmer default, English available).

**CM-3 Staff alerts.**
- new order
- order waiting for approval
- credit hold
- stock below minimum
- delivery late
- claim reported

These go to a CamCow Telegram group, as in CC Livestock today.

**CM-4 Marketing (with consent only).** Weekly specials, new products, recipes; unsubscribe in one tap.

**CM-5 Help.** A Telegram/phone button on every page, frequently asked questions (delivery, weight pricing, storage), and order-specific chat or call.

---

## 14. PWA requirements

**PWA-1 Install.** Installable on Android and iPhone (Add to Home Screen) with the CamCow icon and name and a splash screen. The app prompts politely after the first order, not on the first visit.

**PWA-2 Speed.** The first screen is usable in under 3 s on a mid-range Android over 4G. Images are compressed and sized for the screen. Re-opening the installed app feels instant (cached app shell).

**PWA-3 Offline.**
- Catalogue, prices last seen, cart and order history readable offline, with a clear "You are offline; prices may have changed" notice.
- Orders are **never sent silently later**: when offline, checkout explains the order needs a connection, so a stale price or slot is never confirmed.
- B2B quick order may keep a draft offline.

**PWA-4 Push notifications.** Order status and payment reminders, only after the customer agrees. On iPhone, push works only when the app is installed on the home screen (iOS 16.4 or later), so Telegram/SMS stay the main channel.

**PWA-5 Updates.** A new version installs in the background, and the user sees "Update available, tap to refresh". Updates never interrupt checkout.

**PWA-6 Device features.** Share products and orders (Telegram, Facebook, Messenger), map location for the address, phone dialler, camera for claim photos. B2B users can scan barcodes for receiving **[A, later]**.

**PWA-7 Works everywhere.** Recent Chrome (Android), Safari (iPhone), Facebook/Telegram in-app browsers, and desktop browsers for business buyers.

**PWA-8 POS mode.** The same PWA opens in a *store mode* for signed-in shop staff:
- a full-screen counter layout with large buttons
- connection to the scale, printers, scanner and cash drawer
- offline selling (POS-10): unlike the customer shop, completed sales are stored on the device and sent later, because the sale already happened at the counter
- a clear banner showing offline status and sales waiting to sync
- a warning before the device is closed or signed out with unsent sales

---

## 15. Back office (admin)

**AD-1 Dashboard.**
- today's orders by status, deliveries per round, sales today and this week
- low stock, overdue accounts, open claims

**AD-2 Products and prices.**
- Edit products, photos, options and availability.
- Manage price lists, tiers and account prices, with scheduled price changes and history.
- Import and export prices by Excel.

**AD-3 Orders.**
- Search and filter by status, date, round and customer type.
- Edit an order (with customer notice), place orders for phone customers (*order on behalf*), and print documents.

**AD-4 Customers.**
- Consumer list with order history.
- Business accounts: users, branches, tier, prices, credit, balance, account manager, notes.
- Approval queue for new applications.

**AD-5 Deliveries.** Zones, slots and capacity; rounds; driver assignment; proof of delivery; cash reconciliation per driver.

**AD-6 Content.** Home banners, featured products, recipes, delivery information and terms, all in Khmer and English.

**AD-7 Settings.**
- Cut-off times, minimum orders, catch-weight tolerance, holidays
- Payment methods, VAT, invoice numbering, Telegram groups

**AD-8 Audit log.** Every price, credit, order and stock change with user and time.

**AD-9 Stores.**
- Store details: address, opening hours, pick-up slots, devices.
- Staff and PINs; cashier discount and refund limits; store prices; receipt text.
- Shift and day-close review; transfers; stock counts.

---

## 16. Reports

| Report | Users |
|---|---|
| Sales by day/week/month, by product, category, customer type, area, channel | Management, Sales |
| Top customers; new versus repeat; inactive business accounts (no order for 14 days) | Sales |
| Carcass yield and sell-through; leftover cuts; waste | Butchery, Management |
| Margin by product and customer type (needs cost per kg) **[A]** | Management only |
| Deliveries: on-time %, failed drops, per driver | Dispatch |
| Payments: by method, unpaid orders, cash per driver | Finance |
| Receivables ageing, credit holds | Finance |
| Claims by reason, product, lot | Quality |
| Promotions: use and cost | Sales |
| Shop: sales by hour, cashier, product and payment method; average basket; day close and cash differences; refunds, voids and discounts by cashier; markdowns and waste | Store manager, Finance |
| Channel comparison: online versus shop versus business, and click-and-collect share | Management |

All reports filter by date and export to Excel/PDF.

---

## 17. Integrations

| System | What is exchanged | When |
|---|---|---|
| **CC Livestock** (digital.camcow.com.kh) | Animal, farm and batch for lots (TR-1); later, beef sales back into CamCow stock reports | Phase 1: lot link; later: two-way |
| **CamCow website** (www.camcow.com.kh) | "Order online" buttons and product links from the website to the shop | Phase 1 |
| **Payment** | KHQR / Bakong, ABA PayWay (others later: ACLEDA, Wing) | Phase 1 |
| **Telegram bot** | Customer and staff messages | Phase 1 |
| **SMS gateway** (local provider) | OTP and messages | Phase 1 |
| **Maps** | Address pin, zones, driver navigation links | Phase 1 |
| **Accounting** | Excel export first; later an accounting system | Phase 1 / later |
| **Scales and label printers** | Weight in, label out | Phase 1 (manual entry plus printing) / later (connected scale) |
| **Shop hardware** | Receipt printer, cash drawer, barcode scanner, card terminal, customer display (POS-11) | Phase 1 for the shop |
| **Delivery companies** | Hand-off for provinces or busy days | Later |

---

## 18. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NF-1 | Languages | Khmer (default) and English everywhere, including messages, documents and labels. Khmer font: Kantumruy Pro (as on the CamCow website) |
| NF-2 | Performance | Mobile first: < 3 s first screen on 4G; catalogue search < 1 s; supports 500 orders per day and 2,000 products without slowing **[A]** |
| NF-3 | Availability | 99.5% uptime; planned updates outside 06:00 to 21:00 Phnom Penh time |
| NF-4 | Security | HTTPS only; strong passwords and two-step sign-in for staff; roles checked on the server; rate limits on sign-in and OTP; no card data stored; secrets kept out of the code; security headers as on the CamCow sites |
| NF-5 | Privacy | Collect only what is needed (name, phone, address, business details). Clear privacy notice in Khmer and English, marketing only with consent, customers can ask to see or delete their data. Business prices private per account |
| NF-6 | Data | Daily backups kept 30 days plus off-server copies; tested restore; audit log kept 2 years **[A]** |
| NF-7 | Accessibility | Large tap targets and readable text sizes for older users; works with screen readers; colour is never the only signal |
| NF-8 | Hosting | Can run on the same DigitalOcean setup as CamCow (Docker, Caddy, HTTPS, nightly backups) or a separate server; images built and tested before release; rollback possible |
| NF-9 | Quality | Automated tests for prices, catch weight, stock, payments and permissions; a test environment separate from live data |
| NF-10 | Time and money | All times Phnom Penh (UTC+7); money stored in whole riel, never floating point |
| NF-11 | Shop continuity | The POS sells for at least one full day offline without losing a sale. Every offline sale is synced exactly once, never twice. Each sale completes in < 2 s at the counter, including weight read and receipt print |
| NF-12 | Shop devices | A lost or stolen tablet can be signed out remotely; staff sign in with their own PIN; no customer card data on the device |

---

## 19. Legal and compliance (Cambodia) **[to confirm with a local lawyer or accountant]**

- **E-commerce law.** Cambodia's Law on Electronic Commerce (2019) and its regulations require online sellers to show business identity, contact details, prices and terms, and may require an e-commerce permit or registration with the Ministry of Commerce. Confirm what CamCow needs before launch.
- **Consumer protection.** Under the Consumer Protection Law (2019): clear prices including weight-based pricing, honest product descriptions, terms for returns and complaints.
- **Tax.** VAT registration and tax invoices for business customers; check how the General Department of Taxation's e-invoicing applies to CamCow.
- **Food safety.** Licences and hygiene for meat processing and selling, labels with dates and storage, and cold-chain handling.
- **The shop.**
  - business and trade licences for the premises
  - weighing scales certified (verified) for trade use
  - receipts or tax invoices as the tax rules require for retail sales
  - prices displayed per kg on the counter
  - hygiene checks for a meat shop
- **Data protection.** Follow good practice now (NF-5) and check the status of Cambodia's personal data protection law at launch.
- **Partner content.** Written permission from partners before showing their names and logos ("Where to buy"), as on the CamCow and FBL sites.
- **Terms.** Terms of sale, delivery and refund policy, privacy notice and business account terms (credit, late payment), all in Khmer and English.

---

## 20. Risks

| Risk | Effect | How to reduce it |
|---|---|---|
| Premium cuts sell out, the rest stays | Waste, low margin | Carcass-based stock, per-order limits, bundles, offers on slow cuts (ST-5) |
| Weight differences upset customers | Complaints, refunds | Explain catch weight clearly, set a tolerance, pay after packing (PA-3 option A) |
| Cold chain breaks in traffic or heat | Quality claims | Delivery time limits, slot capacity, insulated boxes, temperature checks for B2B |
| Business customers pay late | Cash-flow strain | Credit limits, automatic holds, statements and reminders |
| Staff keep taking orders by phone only | Two systems, mistakes | *Order on behalf* in the back office; every phone order goes into the system |
| Low adoption of a new app | Low sales | PWA (no store download), Telegram links, QR codes on packs and brochures, first-order offer |
| iPhone push limits | Missed updates | Telegram/SMS as the main channel |
| Too much in the first release | Late launch | Phase the work (section 21) |
| Internet down in the shop | Lost sales, long queues | Offline POS (POS-10), mobile data as a backup line |
| Cash shortages or unrecorded sales in the shop | Lost money, wrong stock | Shifts per cashier, cash counts, no deleting sales, refund and discount limits, daily review (PA-9) |
| Shop and website sell the same last pieces | Cancelled online orders | Shared stock, reservations for pick-up, a safety buffer on premium cuts for online **[A]** |

---

## 21. Suggested phases

| Phase | Content | Outcome |
|---|---|---|
| **1. Launch (MVP)** | Catalogue KM/EN, public prices, consumer orders (guest + OTP), delivery zones/slots, KHQR/ABA + cash on delivery, catch weight with pay-after-packing, business accounts with tier/account prices, quick order and re-order, order desk, cutting list, weighing and labels, Telegram notices, basic reports, PWA install and offline catalogue. **Own store: POS counter sales (cash, KHQR, card), scale and printers, receipts, shifts and cash close, offline selling, click-and-collect at the shop, shared stock** | Consumers and first partners/restaurants order online; the shop runs on the same system from day one |
| **2. Business depth** | Standing orders, approvers and branches, credit limits and statements, quotes, invoices with VAT, receivables, Where to buy map, claims workflow, delivery rounds and proof of delivery; shop: transfers from the cutting room, stock counts, markdowns, returns of online orders in the shop, ship-from-store | Retail partners and food service move fully online |
| **3. Stock and traceability** | Carcass breakdown and yield, reservations, expiry, link to CC Livestock lots, QR traceability page, recall | Whole-animal selling and trust story |
| **4. Growth** | Loyalty and referral, subscription boxes, push campaigns, delivery partner hand-off, marketplace listings, connected scales, accounting integration | More repeat business and efficiency |

---

## 22. Decisions needed from CamCow

| # | Question | Why it matters |
|---|---|---|
| D-1 | Where are orders cut and packed (own butchery, FBL or another processor)? | Fulfilment design, labels, lead times |
| D-2 | Delivery area at launch (Phnom Penh only? which provinces?), own drivers or a delivery company? | Zones, fees, slots |
| D-3 | Catch-weight payment: pay after packing (A) or pay the estimate (B)? | Checkout and refunds |
| D-4 | Which payment providers (ABA PayWay, KHQR via which bank)? Is CamCow VAT-registered? | Contracts, invoices |
| D-5 | Discount levels for retail partners and food service; standard credit terms | Price lists, credit control |
| D-6 | Minimum order values and delivery fees | Checkout rules |
| D-7 | Which processed products are sold, in which pack sizes, and at what prices? | Catalogue |
| D-8 | Will partner stores also be pick-up points? | Pick-up flow |
| D-9 | Should the public website show prices at all, or only link to the shop? (A Beef prices page was built on 10-28 and removed on 10-30.) | Avoid two price lists |
| D-10 | Product photos: own photography of each cut? | Brochure photos may not be CamCow's own |
| D-11 | Shop address: separate (e.g. shop.camcow.com.kh) or inside www.camcow.com.kh? | Branding, hosting |
| D-12 | Who runs the order desk, and what are the working hours and cut-off times? | Slots, alerts |
| D-13 | The own store: how many shops at launch, where, opening hours? Is cutting done in the shop or only at the central room? | Stock locations, POS setup, pick-up slots |
| D-14 | Shop prices: same as online, or a separate store price list? | Price rules (PR-1) |
| D-15 | Shop hardware: is there a certified scale, printers and card terminal already? Which brands? | POS-11 setup and cost |
| D-16 | Cashier limits for discounts and refunds; who approves the daily cash close? | POS-8, POS-9, PA-9 |

---

## Appendix A: Example user stories with acceptance criteria

**US-01 (Consumer) Order by weight.** As a consumer I want to order 1.5 kg of brisket and see an estimated price, so I know roughly what I will pay.
- Given brisket at 36,000 ៛/kg, when I choose 1.5 kg, the cart shows *about 54,000 ៛* and explains the final price follows the packed weight.
- Quantity steps follow the product setting (e.g. 0.5 kg).
- Out-of-stock or over-limit quantities are refused with a clear message.

**US-02 (Consumer) Final amount after packing.** As a consumer I want to pay the exact amount after packing.
- When the packer records 1.53 kg, I receive a Telegram message with 55,100 ៛ (rounded to 100 ៛) and a KHQR link.
- If the weight is outside the tolerance, the order desk must confirm with me before dispatch.

**US-03 (Restaurant) Standing order.** As a chef I want my brisket order every Mon/Wed/Fri without retyping.
- The order is created 24 h before delivery and I get a reminder; I can change quantities until the cut-off.
- On a CamCow holiday, the order is skipped and I am told.

**US-04 (Retail partner) Branch delivery and VAT invoice.** As a mini-mart buyer I want each branch to get its own delivery and VAT invoice.
- I choose the branch at checkout; the invoice shows our VATTIN, VAT 10% and the branch address.
- My finance user can download all invoices for the month and a statement.

**US-05 (Finance) Credit hold.** As finance I want orders held when an account is over its limit.
- An order that takes the balance over the limit goes to *Pending approval (credit)*, the customer sees why, and finance can release or decline it.

**US-06 (Butchery) Cutting list.** As a butcher I want one list per round with totals per cut and spec.
- The list groups by product and spec (e.g. *brisket, thin slices, 1 kg bags: 14 kg in 3 orders*) and is printable.

**US-07 (Customer) Traceability.** As a customer I want to scan the pack QR to see where the beef comes from.
- The page shows pack and use-by dates and the farm's province/district. It shows the farm name only with the farm's consent, and never prices or personal data.


**US-08 (Cashier) Weighed counter sale.** As a cashier I want the scale weight to go straight into the sale.
- When I put 0.82 kg of brisket on the scale and choose brisket (36,000 ៛/kg), the line shows 0.82 kg = 29,500 ៛ (rounded to 100 ៛).
- I take payment by KHQR. The sale completes when the bank confirms, prints the receipt, and lowers the shop's brisket stock by 0.82 kg.

**US-09 (Cashier) Offline sale.** As a cashier I want to keep selling when the internet is down.
- With no connection, I can still finish a cash sale and print the receipt; the screen shows *Offline: 3 sales waiting*.
- When the connection returns, the sales are sent once, stock updates, and the banner clears.

**US-10 (Store manager) Day close.** As a store manager I want to close the day and see the cash difference.
- After every cashier closes their shift, the Z report shows takings by method, expected and counted cash, refunds, discounts and voids by cashier.

**US-11 (Customer) Click and collect.** As an online customer I want to pick my order up at the CamCow shop.
- I choose the shop and a time slot and get *Ready for pick-up* with a code. The cashier enters the code; the order shows *Picked up* and the receipt is sent to my Telegram.
---

## Appendix B: Glossary

| Term | Meaning |
|---|---|
| B2C | Business to consumer: selling to individuals |
| B2B | Business to business: selling to shops, restaurants, processors |
| HoReCa | Hotels, restaurants and catering |
| Catch weight | Item priced by its actual weighed weight, known only after packing |
| Carcass breakdown | Cutting one animal into primals and cuts; the yield per cut |
| Tier price | Price level for a group of business customers |
| Account price | Agreed price for one customer and item |
| Standing order | An order repeated on a schedule |
| Cut-off | Last time to order for a delivery round |
| KHQR | Cambodia's national QR payment standard (Bakong) |
| VATTIN | VAT taxpayer identification number |
| PWA | Progressive Web App: a website that installs and behaves like an app |
| OTP | One-time code sent by SMS/Telegram to confirm a phone number |
| FEFO | First expiry, first out |
| POS | Point of sale: the counter screen used in the shop to sell, weigh and take payment |
| Click and collect | Order online, pick up in the shop |
| Ship from store | An online order packed and delivered from the shop's stock |
| Z report | End-of-day report of a till: sales, payments, cash expected and counted |
| Markdown | A price reduction on short-dated stock, recorded separately from promotions |
| Transfer | Stock moved between locations (central cutting room → shop) |
