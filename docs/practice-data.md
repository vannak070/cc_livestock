# Practice data (Plan 2)

A realistic running operation for demonstrations. Every real farm has a farm program from **Planning plan 2** (Plan 80 (02)):
**once a month, on the farm's 3-day slot, CC Livestock buys back the cattle that finished their 4 months and sells the farm
20 new ones the same day.** Feed is not part of the plan. The cattle, weights, health, sales, feed stock and costs line up
with that action plan.

```bash
npm run practice:seed     # adds it (local database only; refuses on production, a remote DB, or while ALERTS_SCHEDULER=on)
npm run practice:remove   # takes exactly that data out again and gives the farms their old cattle limits back
```

Dates are worked out from the day it is run, so re-seed (remove, then seed) on a new day. Existing cattle, batches and logins are
not changed. **Farm cattle limits are raised** to cover a year of intake (20 a month, and every registered animal counts toward a
limit): each change is logged in the farm's limit history ("Plan 2: 20 cattle a month for a year") and undone by `practice:remove`.

| Slot (days) | Farm | Swap day | Where it stands on 15 Oct | Shows |
|---|---|---|---|---|
| 1 (1–3) | VannaraCC1 | 2nd | started March, 160 registered | all four buy-backs done; this month's swap done |
| 1 | SothunCC7 | 1st | started April | this month's swap did not happen: buy-back and sale 14 days late; feed short; weighings late |
| 2 (4–6) | SunnyCC9 | 5th | started July | next sale postponed 10 days ("Truck not available") |
| 2 | VechneatCC10 | 6th | started September | second cohort in |
| 3 (7–9) | KImchhatCC5 | 8th | started June | first buy-back done on 8 Oct; 2 sick animals |
| 4 (10–12) | SokcheaCC4 | 11th | program starts 11 Nov | keeps its 7 cattle; running batch tracked |
| 5 (13–15) | SophalCC12 | 15th | starts today | first sale due today (started by the Operations team) |
| 6 (16–18) | SNR Farm | 16th | program starts 16 Nov | keeps its 75 cattle; its running batch's buy-back is 5 days late |
| 7 (19–21) | CC_001 (company run) | 20th | started February | a cohort 12 of 20 sold back, 25 days late; next swap due in 5 days |
| 7 | ViraksakCC2 | 21st | started May | first buy-back done; next due in 6 days |
| 8 (22–24) | VanndaCC3 | 22nd | started June | first buy-back due in 7 days (task started) |
| 8 | NimolCC11 | 23rd | started September | one cohort in, one sick animal |

Slots 9 and 10 are empty on purpose: the calendar is built for up to 50 farms, several to a slot, arranged by location.

**Money with CamCow** (Action plans, Money tab) is worked out from these records: what each farm bought, what CC Livestock bought
back, the net, and the farm's bank interest and principal under the plan. It is a record only; payments happen outside the system.

Everything is built in `src/db/practice/practice-data.ts` (pure, tested in `practice-data.test.ts`).

**CamCow stock** (Action plans → CamCow stock, and Reports → CamCow stock): every collection (a sale to "CC Livestock") is a candidate for CamCow's own stock. The seed receives most of them, sells the older lots on to buyers (Phnom Penh Meat Co., Kampot Cattle Traders, Siem Reap Slaughterhouse) at 13,000 to 13,400 ៛/kg, marks two animals lost, leaves some lots unsold for over a month (the "held too long" alert), and leaves the newest collection (7 cattle) waiting to be received.

The seed also adds 3 buyers (`P2-BUY-n`) and the stock site's holding costs (`P2-CST-...`: feed every 3 days for the animals in stock, weekly labour, medicine every two weeks), so the Buyers and Costs tabs and the margin after costs have data. `practice:remove` deletes them.
