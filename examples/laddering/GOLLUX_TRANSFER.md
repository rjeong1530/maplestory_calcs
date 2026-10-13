# Source of Suffering transfer planning

Import `gollux-transfer.json` into Equipment upgrade. Enable Star Force and
Potential, calculate, then open Overall. All sample meso costs are illustrative.

Configure donor stars, maximum donor stars, replacement costs, and an expected
Epic-to-Legendary tier-up cost. A blank tier-up estimate blocks transfer mode;
zero explicitly means free. Record spare stats for a more accurate comparison.
Missing spare stats assume an owned copy with zero stars and zero roll scores.

Each recommended transfer step shows two alternatives:

- **Equipped SoS:** transfer directly onto the equipped item. Its existing flame
  is retained, potential is overwritten, and only potential rerolls plus tier-up
  are charged as roll preparation. The equipped item is modified immediately.
- **Spare SoS:** transfer onto a spare, keeping the equipped item safe until the
  spare improves. Preparation includes potential rerolls, tier-up, and any flame
  rerolls needed from the spare's recorded score. Already sufficient flames add
  no flame reroll cost.

Each option lists its donor target, resulting SoS stars, post-transfer tapping
where needed, separate roll costs, total spending, score gain, and SoS/Gollux
booms. These are alternatives, not sequential actions. The indicated ranking
option alone contributes to cumulative spending. An unavailable alternative is
shown explicitly. Legacy `restore_trace` checkbox values are accepted but ignored.

Transfers land at least at 22 stars and the equipped SoS star level. The final
item must improve both stars and total score. SoS is never tapped below 22 stars
in transfer mode. After a boom, restore its trace and transfer a rebuilt donor;
ordinary low-star SoS rebuilding is excluded. Preparation happens after Star
Force finishes. The first donor and initial spare are assumed owned, while
subsequent donors are acquired and enhanced from zero at the entered prices.

Routes prioritize fewer SoS booms, then score gain per meso. Gollux booms do not
count as SoS risk, but their costs are included. The chosen route competes with
other equipment by gain per meso. Donor enhancement modes, safeguards, and event
settings follow the SoS settings. This is a bounded policy comparison with
six-star lookahead, not a globally optimal inventory or budget solver.

Only one SoS sequence is projected per calculation. Recalculate afterward with
actual stars, rolls, and remaining inventory. Other equipment continues receiving
recommendations. Standard laddering is unchanged when transfer mode is disabled.
