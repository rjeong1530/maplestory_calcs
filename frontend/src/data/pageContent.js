import { PAGE_PATHS } from './routes.js'

export const SITE_URL = 'https://maplestory-calculator.onrender.com'
export const PAGE_CONTENT = {
  home: {
    title: 'MapleStory Calculator | Star Force, Flames & Potential',
    heading: 'MapleStory upgrade calculators',
    description: 'Compare MapleStory Star Force costs, flame scores, potential probabilities, and equipment upgrade order with configurable stat weights.',
    sections: [
      ['Choose your next upgrade', 'Use Star Force to estimate enhancement costs and booms, Flames to find the odds of a target score, or Potential to estimate how many cubes you need. The equipment planner compares upgrades across your saved gear.'],
      ['Compare costs, not just bigger numbers', 'An upgrade with a larger expected stat gain can still be less efficient if it costs much more. The equipment planner compares weighted score gain per meso; changing your stat weights can change the order.'],
      ['Keep your equipment setup', 'Equipment and recorded stats are saved in this browser. Export JSON to keep a backup or move your setup to another device. Calculator results are estimates, not guaranteed outcomes.'],
    ],
  },
  starforce: {
    title: 'MapleStory Star Force Calculator | Costs, Booms & Strategies',
    heading: 'MapleStory Star Force calculator',
    description: 'Estimate Star Force mesos, attempts, and booms. Compare enhancement strategies, safeguards, replacement costs, and Shining Star Force settings.',
    sections: [
      ['How to estimate Star Force costs', 'Enter your equipment level, current stars, and target stars. Set enhancement modes, applicable safeguards, replacement cost, MVP discount, and event settings to match the scenario you want to compare.'],
      ['Example: compare 17 to 22 stars', 'Choose a level-200 item, set its current stars to 17 and target to 22, then calculate. Compare strategies with the same replacement cost and event settings so that cost and destruction-risk differences are meaningful.'],
      ['What do expected booms and safeguards mean?', 'Expected booms is an average number of destructions across many attempts to reach your target. Recovery and retries contribute to the estimated cost. Applicable safeguards trade additional spending for protection at eligible stars; a fractional boom estimate is an average, not a possible single-run outcome.'],
      ['Expected cost is not a guaranteed budget', 'A result of 10B mesos would mean an average cost of 10B, not certainty of finishing with that budget. Use the budget probability tools to compare chances of success with different spending limits.'],
    ],
  },
  flame: {
    title: 'MapleStory Flame Calculator | Flame Scores & Probabilities',
    heading: 'MapleStory flame calculator',
    description: 'Calculate MapleStory flame-score probabilities for armor and weapons using class stats, flame type, boss status, and custom score weights.',
    sections: [
      ['What is a flame score?', 'Flame score combines relevant stats using your selected weights. Main stat, secondary stat, attack, and all-stat percentage can contribute differently. It is a comparison score, not a direct damage prediction.'],
      ['Example: a 120-point armor flame', 'Select your class, level-150 armor, boss-equipment status, and Black Flames. Set the target score to 120 and review the weights before calculating. Changing the item type, level, or weights changes the probability.'],
      ['How many flames will I need?', 'For independent rolls with success probability p, the average number of rolls until success is 1/p. A hypothetical 1% chance means 100 rolls on average, but only about a 63.4% chance of at least one success in 100 rolls.'],
      ['Armor and weapon flames', 'Weapons use weapon-specific inputs such as base attack or magic attack. Boss-equipment status and flame type also affect the modeled outcomes. Enter the actual item settings before comparing targets.'],
    ],
  },
  potential: {
    title: 'MapleStory Potential Calculator | Cube Odds & Meso Costs',
    heading: 'MapleStory potential and cube calculator',
    description: 'Estimate Legendary potential probabilities, cube counts, and meso budgets for MapleStory equipment with multiple desired stat targets.',
    sections: [
      ['Calculate a potential target', 'Choose your equipment type, level, and cube, then enter the stat requirements you want on one roll. The calculator evaluates the combined target, rather than treating each requested stat as a separate success.'],
      ['Example: a Legendary STR accessory', 'Choose an accessory and enter a total STR-percent target appropriate to your equipment. Compare the cube-count or budget results while keeping the equipment level and target fixed. These calculations start at Legendary and exclude tier-up costs.'],
      ['Probability versus certainty', 'For a hypothetical 1% success chance per independent cube, 100 cubes gives about a 63.4% chance of at least one success: 1 − (1 − 0.01)^100. The average number required and the number needed for a chosen confidence level are different measures.'],
      ['KMS probabilities and GMS values', 'The potential model uses bundled KMS Legendary main-potential probabilities with GMS line-value adjustments. Results are estimates, not independently verified GMS probabilities. Bonus potential and tier-ups are not modeled.'],
    ],
  },
  equipment: {
    title: 'MapleStory Equipment Upgrade Planner | Compare Upgrade Costs',
    heading: 'MapleStory equipment upgrade planner',
    description: 'Save MapleStory gear and compare Star Force, flame, and potential upgrades by expected score gain per meso to plan your next equipment upgrade.',
    sections: [
      ['Find an equipment upgrade order', 'Build your equipment set, save it, and record current stars, flame lines, and potential. Set score weights for your class, calculate, and open Overall to compare the next upgrades across your equipment.'],
      ['Example: compare a ring with an armor upgrade', 'Record a ring at 17 stars and an armor piece with its current flame lines. Enable Star Force and Flames, then calculate. The Overall tab compares the available star upgrades with flame improvements under the same score weights. Rings do not receive flames.'],
      ['Why a larger upgrade may rank lower', 'Efficiency divides expected score gain by expected meso cost. For example, a hypothetical 20-point gain costing 1B is more efficient than a 30-point gain costing 2B. Replacement costs and event settings can change Star Force rankings.'],
      ['Recalculate after actual upgrades', 'This is a greedy projection using expected outcomes, not a globally optimal or guaranteed spending plan. Later steps may start from an average roll that differs from your actual result. Potential calculations assume Legendary and exclude tier-up costs.'],
    ],
  },
  bugs: {
    title: 'Report a Bug | MapleStory Calculator',
    heading: 'Help improve the MapleStory calculator',
    description: 'Report incorrect calculations or problems with MapleStory Calculator. Include your inputs, reproduction steps, and expected results.',
    sections: [],
  },
}

export function pageMetadata(page) {
  const content = PAGE_CONTENT[page]
  return content ? { ...content, canonical: SITE_URL + PAGE_PATHS[page] }
    : { title: 'Page Not Found | MapleStory Calculator', heading: 'Page not found',
        description: 'Choose a MapleStory calculator or the equipment upgrade planner.', canonical: null }
}
